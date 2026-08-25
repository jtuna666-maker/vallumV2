import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { loginCodes, users } from "@/db/schema";
import { claimOrphans, clearLoginCodes, hashCode } from "@/lib/access";
import { saveSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().max(120).optional().default(""),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sign-in code" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const [record] = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, email),
        isNull(loginCodes.usedAt),
        gt(loginCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (!record) {
    return NextResponse.json(
      { error: "Code expired — request a fresh one." },
      { status: 400 }
    );
  }

  if (record.attempts >= 5) {
    await db.delete(loginCodes).where(eq(loginCodes.id, record.id));
    return NextResponse.json(
      { error: "Too many wrong attempts — request a new code." },
      { status: 429 }
    );
  }

  if (record.codeHash !== hashCode(email, parsed.data.code)) {
    await db
      .update(loginCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(loginCodes.id, record.id));
    return NextResponse.json({ error: "That code isn't right." }, { status: 400 });
  }

  await clearLoginCodes(email);

  let [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ email, name: parsed.data.name ?? "" })
      .onConflictDoNothing()
      .returning();
    user =
      created ?? (await db.select().from(users).where(eq(users.email, email)))[0];
  }

  await claimOrphans(user.id);
  await saveSession(user.id);

  return NextResponse.json({ ok: true, user });
}
