import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { canAccess } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

/** Owner-only: enable (or rotate) the read-only share link. */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the owner controls sharing" }, { status: 403 });
  }
  const shareToken = randomBytes(24).toString("base64url");
  const [updated] = await db
    .update(projects)
    .set({ shareToken })
    .where(eq(projects.id, id))
    .returning();
  return NextResponse.json({ shareToken: updated.shareToken });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the owner controls sharing" }, { status: 403 });
  }
  await db.update(projects).set({ shareToken: "" }).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
