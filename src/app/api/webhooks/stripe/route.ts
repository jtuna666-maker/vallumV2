import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { printOrders } from "@/db/schema";
import { constructWebhookEvent } from "@/lib/billing";
import { createPrintJob, isLuluConfigured, type LuluAddress } from "@/lib/lulu";
import { projects } from "@/db/schema";
import { printKey } from "@/lib/pdf/source";

export const dynamic = "force-dynamic";

/** Stripe → VELLUM: payment confirmation, then print-on-demand fulfillment. */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Awaited<ReturnType<typeof constructWebhookEvent>>;
  try {
    event = await constructWebhookEvent(raw, signature);
  } catch (err) {
    console.warn("[vellum] webhook signature rejected:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      metadata?: { orderId?: string };
      customer_details?: {
        email?: string;
        name?: string;
        address?: {
          line1?: string;
          line2?: string | null;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        };
      };
    };

    const sessionId = session.id;
    const orderIdFromMeta = session.metadata?.orderId ?? "";

    const [order] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.stripeSessionId, sessionId))
      .limit(1);

    const targetId = order?.id ?? orderIdFromMeta;
    if (targetId) {
      const addr = session.customer_details?.address;
      const [updated] = await db
        .update(printOrders)
        .set({
          status: "paid",
          email: session.customer_details?.email ?? order?.email ?? "",
          shipName: session.customer_details?.name ?? "",
          shipLine1: addr?.line1 ?? "",
          shipLine2: addr?.line2 ?? "",
          shipCity: addr?.city ?? "",
          shipState: addr?.state ?? "",
          shipPostal: addr?.postal_code ?? "",
          shipCountry: addr?.country ?? "",
          updatedAt: new Date(),
        })
        .where(eq(printOrders.id, targetId))
        .returning();

      if (updated && isLuluConfigured()) {
        try {
          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, updated.projectId));
          if (project) {
            const origin = new URL(req.url).origin;
            const address: LuluAddress = {
              name: updated.shipName || project.authorName,
              street1: updated.shipLine1,
              street2: updated.shipLine2,
              city: updated.shipCity,
              stateCode: updated.shipState,
              postcode: updated.shipPostal,
              countryCode: updated.shipCountry || "US",
            };
            // Signed, sessionless URLs so the print vendor can fetch the
            // print-ready files directly.
            const k = printKey(project.id);
            const ed = updated.edition === "softcover" ? "softcover" : "heirloom";
            const jobId = await createPrintJob({
              orderId: updated.id,
              title: project.title,
              authorName: project.authorName,
              contactEmail: updated.email || session.customer_details?.email || "",
              address,
              quantity: updated.quantity || 1,
              binding: ed,
              interiorUrl: `${origin}/api/pdf/interior/${project.id}.pdf?edition=${ed}&k=${k}`,
              coverUrl: `${origin}/api/pdf/cover/${project.id}.pdf?edition=${ed}&k=${k}`,
            });
            await db
              .update(printOrders)
              .set({ luluJobId: jobId, status: "fulfilled", updatedAt: new Date() })
              .where(eq(printOrders.id, updated.id));
          }
        } catch (err) {
          // Payment is safe; fulfillment can retry manually. Never fail the webhook.
          console.error("[vellum] lulu fulfillment failed:", err);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
