import "server-only";
import { createHash } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/bootstrap";
import { users, type User } from "@/db/schema";

export type SessionData = {
  userId?: string;
};

let warned = false;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  // The managed preview runtime may intentionally omit user-provided secrets.
  // Derive a stable, deployment-specific key instead of crashing every auth
  // and studio route. Real production must still inject SESSION_SECRET.
  const fallback = createHash("sha256")
    .update(`${process.env.DATABASE_URL ?? "vellum-preview"}|vellum-session-v1`)
    .digest("hex");

  if (!warned) {
    warned = true;
    console.warn(
      "[vellum] SESSION_SECRET is not configured; using a deterministic preview fallback. Set SESSION_SECRET before public deployment."
    );
  }
  return fallback;
}

async function session(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    cookieName: "vellum_session",
    password: getSecret(),
    ttl: 60 * 60 * 24 * 30, // 30 days
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function saveSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("vellum_signed_out");
  const iron = await getIronSession<SessionData>(cookieStore, {
    cookieName: "vellum_session",
    password: getSecret(),
    ttl: 60 * 60 * 24 * 30,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
  iron.userId = userId;
  await iron.save();
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const iron = await getIronSession<SessionData>(cookieStore, {
    cookieName: "vellum_session",
    password: getSecret(),
    ttl: 60 * 60 * 24 * 30,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
  iron.destroy();
  cookieStore.set("vellum_signed_out", "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** The sealed session account only (no ambient fallback). Ambient demo is
 * handled by currentUser(). */
export const sessionUser = cache(async (): Promise<User | null> => {
  const iron = await session();
  const uid = iron.userId;
  if (uid && isUuid(uid)) {
    const [u] = await db.select().from(users).where(eq(users.id, uid));
    if (u) return u;
  }
  return null;
});

/** Reads the sealed session. If its account vanished, fall back to the
 * ambient demo account created by the first-boot seeder so the showcase
 * keeps working even after a sandbox/local cookie reset. Skipped when the
 * visitor deliberately signed out (opt-out cookie). */
export const currentUser = cache(async (): Promise<User | null> => {
  const iron = await session();
  const uid = iron.userId;
  if (uid && isUuid(uid)) {
    const [u] = await db.select().from(users).where(eq(users.id, uid));
    if (u) return u;
  }
  const cookieStore = await cookies();
  if (cookieStore.get("vellum_signed_out")) return null;
  return ambientDemoUser();
});

async function ambientDemoUser(): Promise<User | null> {
  await ensureDatabaseSchema();
  const [demo] = await db
    .select()
    .from(users)
    .where(eq(users.email, "vellum.demo@vellum.local"));
  return demo ?? null;
}

export { isUuid };
