import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, users } from "@/db/schema";
import { canAccess } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

const memberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]),
});

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role === "none") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  return NextResponse.json({ members: rows });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the owner can invite" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = memberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const [user] = await db
    .insert(users)
    .values({ email })
    .onConflictDoNothing()
    .returning();
  const account =
    user ?? (await db.select().from(users).where(eq(users.email, email)))[0];

  await db
    .insert(projectMembers)
    .values({ projectId: id, userId: account.id, role: parsed.data.role })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: { role: parsed.data.role },
    });

  return NextResponse.json({
    member: { userId: account.id, email: account.email, name: account.name, role: parsed.data.role },
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const role = await canAccess(id);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the owner can remove members" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [row] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, parsed.data.userId)
      )
    );
  if (!row || row.role === "owner") {
    return NextResponse.json(
      { error: "The memoir's owner cannot be removed" },
      { status: 400 }
    );
  }

  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, parsed.data.userId)
      )
    );

  return NextResponse.json({ ok: true });
}
