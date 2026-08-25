import { NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginCodes } from "@/db/schema";
import { clearLoginCodes, hashCode } from "@/lib/access";

const schema = z.object({ email: z.string().email() });

/** Sends a six-digit sign-in code. In dev (no RESEND_API_KEY configured) the
 * code is logged to the server console and returned so the browser can pick
 * it up — in production it only travels over email. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginCodes)
    .where(eq(loginCodes.email, email));
  if (count >= 5) {
    return NextResponse.json(
      { error: "Too many requests — check your inbox for a recent code." },
      { status: 429 }
    );
  }

  await clearLoginCodes(email);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await db.insert(loginCodes).values({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const resendKey = process.env.RESEND_API_KEY;
  let sent = false;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const from = process.env.RESEND_FROM ?? "VELLUM <login@vellum.app>";
      const { error } = await resend.emails.send({
        from,
        to: email,
        subject: `${code} — your VELLUM sign-in code`,
        text: `Your VELLUM sign-in code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.\n\n— VELLUM, a private memoir studio`,
      });
      sent = !error;
    } catch {
      sent = false;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[vellum] sign-in code for ${email}: ${code}\n`);
    return NextResponse.json({ ok: true, delivered: sent, devCode: code });
  }
  return NextResponse.json({ ok: true, delivered: sent });
}
