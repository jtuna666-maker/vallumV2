import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/bootstrap";
import { projectMembers, projects, users } from "@/db/schema";

import { claimOrphans } from "@/lib/access";
import { saveSession } from "@/lib/auth";
import { ensureDemoSeed } from "@/lib/seed";

let bootstrapped = false;

/**
 * Runs once per process, on dashboard load:
 * 1. In VELLUM_SINGLE_USER mode, assigns the ambient account and claims all
 *    persisted projects (perfect for self-hosting and sandbox demos).
 * 2. Otherwise, if projects exist but the demo account doesn't, create it,
 *    foster the orphan showcase into it, and sign the visitor in so the
 *    studio is never empty or locked out.
 *
 * Skips while unauthenticated requests come from non-browser agents (curl,
 * health checks) to avoid surprise cookie writes in automation.
 */
export async function ensureBootstrap(canWriteCookies = false): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    await ensureDatabaseSchema();

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects);

    const single = process.env.VELLUM_SINGLE_USER === "1";
    const ambient = process.env.VELLUM_AMBIENT !== "0";
    if (count === 0 && !single && !ambient) return;
    const [demo] = await db
      .select()
      .from(users)
      .where(eq(users.email, "vellum.demo@vellum.local"));

    if (!demo) {
      const [created] = await db
        .insert(users)
        .values({ email: "vellum.demo@vellum.local", name: "The VELLUM Household" })
        .onConflictDoNothing()
        .returning();

      const account =
        created ??
        (
          await db.select().from(users).where(eq(users.email, "vellum.demo@vellum.local"))
        )[0];
      if (!account) return;

      await claimOrphans(account.id);
      await backfillMissingOwnerRows(account.id);
      // Fall through to seeding — cookie sealing happens in the ambient
      // route handler, never during an RSC render.
      await ensureDemoSeed();
      if (single && canWriteCookies) await adoptAmbient();
      return;
    }

    await claimOrphans(demo.id);
    await backfillMissingOwnerRows(demo.id);
    await ensureDemoSeed();
    // RSC renders can't write cookies; the ambient adoption component
    // (route handler) or this flag covers sealing.
    if (single && canWriteCookies) {
      await adoptAmbient();
    }
  } catch (err) {
    bootstrapped = false;
    console.error("[vellum] bootstrap failed:", err);
  }
}

/**
 * Sign the requester into the ambient demo account. Called from the ambient
 * adoption route (full cookie powers) and bootstrap.
 */
export async function adoptAmbient(): Promise<void> {
  // Direct API calls can arrive before /app or /api/health.
  await ensureBootstrap(false);
  await ensureDatabaseSchema();

  const [demo] = await db
    .select()
    .from(users)
    .where(eq(users.email, "vellum.demo@vellum.local"));
  if (!demo) return;
  await claimOrphans(demo.id);
  await backfillMissingOwnerRows(demo.id);
  await saveSession(demo.id);
}

/** Ensure every project has a project_members owner row for its ownerId. */
async function backfillMissingOwnerRows(ownerId: string): Promise<void> {
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, ownerId));
  if (owned.length === 0) return;
  await db
    .insert(projectMembers)
    .values(owned.map((p) => ({ projectId: p.id, userId: ownerId, role: "owner" as const })))
    .onConflictDoNothing();
}
