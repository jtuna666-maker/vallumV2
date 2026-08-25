import "server-only";
import { createHash } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chapters, loginCodes, projectMembers, projects, questions } from "@/db/schema";
import { currentUser } from "@/lib/auth";

export type AccessRole = "none" | "viewer" | "editor" | "owner";

export async function canAccess(projectId: string): Promise<AccessRole> {
  const user = await currentUser();
  if (!user) return "none";

  const [row] = await db
    .select({
      ownerId: projects.ownerId,
      role: projectMembers.role,
    })
    .from(projects)
    .leftJoin(
      projectMembers,
      and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, user.id))
    )
    .where(eq(projects.id, projectId));

  if (!row) return "none";
  const legacyUnowned = row.ownerId === null;
  if (row.ownerId === user.id || legacyUnowned) return "owner";
  if (row.role === "editor") return "editor";
  if (row.role === "viewer") return "viewer";
  return "none";
}

/** Claim any orphan (owner-less) projects for this user, then grant a membership row. */
export async function claimOrphans(userId: string): Promise<number> {
  const orphans = await db.select({ id: projects.id }).from(projects).where(
    sql`${projects.ownerId} IS NULL`
  );
  if (orphans.length === 0) return 0;

  const ids = orphans.map((o) => o.id);
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ ownerId: userId })
      .where(sql`${projects.id} = ANY(${ids})`);
    await tx
      .insert(projectMembers)
      .values(ids.map((id) => ({ projectId: id, userId, role: "owner" as const })))
      .onConflictDoNothing();
  });
  return orphans.length;
}

export async function projectById(projectId: string) {
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  return p ?? null;
}

export async function chapterBelongsToProject(chapterId: string, projectId: string) {
  const [c] = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId)));
  return !!c;
}

export async function questionBelongsToProject(questionId: string, projectId: string) {
  const [row] = await db
    .select({ id: questions.id })
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .where(and(eq(questions.id, questionId), eq(chapters.projectId, projectId)));
  return !!row;
}

export function clearLoginCodes(email: string) {
  return db.delete(loginCodes).where(eq(loginCodes.email, email.toLowerCase().trim()));
}

export function hashCode(email: string, code: string): string {
  // Six-digit, expiring, rate-limited codes — a SHA-256 digest is sufficient;
  // the point is simply to never store plaintext codes.
  return createHash("sha256")
    .update(`${email.toLowerCase().trim()}|${code}`)
    .digest("hex");
}
