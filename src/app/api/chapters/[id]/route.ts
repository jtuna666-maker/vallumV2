import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters } from "@/db/schema";
import { canAccess } from "@/lib/access";

async function guard(chapterId: string, write: boolean) {
  const [c] = await db
    .select({ projectId: chapters.projectId })
    .from(chapters)
    .where(eq(chapters.id, chapterId));
  if (!c) return { status: 404 as const };
  const role = await canAccess(c.projectId);
  if (role === "none") return { status: 404 as const };
  if (write && role === "viewer") return { status: 403 as const };
  return { status: 200 as const };
}

const patchSchema = z.object({
  content: z.string().max(200_000).optional(),
  status: z.enum(["unwritten", "drafting", "complete"]).optional(),
  title: z.string().min(1).max(200).optional(),
  imageUrl: z.string().max(2048).optional(),
  imageCaption: z.string().max(300).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await guard(id, true);
  if (g.status !== 200) {
    return NextResponse.json({ error: g.status === 403 ? "View-only access" : "Not found" }, { status: g.status });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const [updated] = await db
    .update(chapters)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(chapters.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }
  return NextResponse.json({ chapter: updated });
}
