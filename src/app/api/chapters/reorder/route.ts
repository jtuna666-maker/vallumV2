import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters } from "@/db/schema";
import { canAccess } from "@/lib/access";

const swapSchema = z.object({
  a: z.object({ id: z.string().uuid(), orderIndex: z.number().int().min(0) }),
  b: z.object({ id: z.string().uuid(), orderIndex: z.number().int().min(0) }),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = swapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  const [aChapter] = await db
    .select({ projectId: chapters.projectId })
    .from(chapters)
    .where(eq(chapters.id, parsed.data.a.id));
  if (!aChapter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await canAccess(aChapter.projectId);
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { a, b } = parsed.data;
  await db.transaction(async (tx) => {
    await tx.update(chapters).set({ orderIndex: a.orderIndex }).where(eq(chapters.id, a.id));
    await tx.update(chapters).set({ orderIndex: b.orderIndex }).where(eq(chapters.id, b.id));
  });

  return NextResponse.json({ ok: true });
}
