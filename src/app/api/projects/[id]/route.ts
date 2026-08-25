import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { canAccess } from "@/lib/access";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  authorName: z.string().min(1).max(120).optional(),
  dedication: z.string().max(400).optional(),
  theme: z.enum(["parchment", "ink", "sage"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") return NextResponse.json({ error: "View-only access" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const [updated] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete a memoir" }, { status: 403 });
  }
  const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
