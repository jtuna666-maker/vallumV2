import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { printOrders, projects } from "@/db/schema";
import { canAccess } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { createBookCheckout, isBillingConfigured } from "@/lib/billing";
import { quote } from "@/lib/pricing";

const schema = z.object({
  projectId: z.string().uuid(),
  edition: z.enum(["softcover", "heirloom"]),
  quantity: z.number().int().min(1).max(500).optional().default(1),
});

/**
 * GET  — latest non-pending order for a project (drives the status chip).
 * POST — start an order. Stripe Checkout when configured; otherwise a
 *        recorded reservation so the flow is always demonstrable.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const role = await canAccess(projectId);
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [order] = await db
    .select()
    .from(printOrders)
    .where(and(eq(printOrders.projectId, projectId), ne(printOrders.status, "pending")))
    .orderBy(desc(printOrders.createdAt))
    .limit(1);

  return NextResponse.json({ order: order ?? null });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { projectId, edition: editionId, quantity } = parsed.data;

  const role = await canAccess(projectId);
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authoritative price: recomputed server-side, never trusted from the client.
  const q = quote(editionId, quantity);
  const user = await currentUser();
  const origin = new URL(req.url).origin;

  const [order] = await db
    .insert(printOrders)
    .values({
      projectId,
      userId: user?.id ?? null,
      email: user?.email ?? "",
      edition: editionId,
      quantity: q.quantity,
      unitCents: q.unitCents,
      amountCents: q.subtotalCents,
      discountRate: Math.round(q.effectiveRate * 100),
      status: "pending",
    })
    .returning();

  if (!isBillingConfigured()) {
    await db
      .update(printOrders)
      .set({ status: "reserved", updatedAt: new Date() })
      .where(eq(printOrders.id, order.id));
    return NextResponse.json({
      reserved: true,
      quote: q,
      redirect: `/app/project/${projectId}/preview?order=reserved`,
    });
  }

  try {
    const checkout = await createBookCheckout({
      projectId,
      orderId: order.id,
      editionId,
      quote: q,
      title: project.title,
      authorName: project.authorName,
      email: user?.email,
      origin,
    });
    await db
      .update(printOrders)
      .set({ stripeSessionId: checkout.sessionId, updatedAt: new Date() })
      .where(eq(printOrders.id, order.id));
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[vellum] stripe checkout failed:", err);
    await db
      .update(printOrders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(printOrders.id, order.id));
    return NextResponse.json(
      { error: "Checkout is unavailable right now." },
      { status: 502 }
    );
  }
}

export const runtime = "nodejs";
