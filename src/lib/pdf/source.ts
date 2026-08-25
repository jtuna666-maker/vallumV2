import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chapters, projects, questions } from "@/db/schema";
import { canAccess } from "@/lib/access";
import type { Chapter, Project } from "@/db/schema";

/**
 * Deterministic print key so the print-on-demand vendor can fetch a book's
 * PDFs without a session. Derived from SESSION_SECRET — no schema, no
 * storage, revocable by rotating the secret.
 */
export function printKey(projectId: string): string {
  const secret = process.env.SESSION_SECRET ?? "vellum-dev-secret";
  return createHmac("sha256", secret)
    .update(`pdf:${projectId}`)
    .digest("hex")
    .slice(0, 32);
}

export function printKeyValid(projectId: string, provided: string | null): boolean {
  if (!provided) return false;
  const expected = printKey(projectId);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export type BookSource = {
  project: Project;
  chapters: (Chapter & { answers: string[] })[];
};

/** Loads a project's chapters with answers, for PDF rendering. */
export async function loadBook(projectId: string): Promise<BookSource | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const chs = await db
    .select()
    .from(chapters)
    .where(eq(chapters.projectId, projectId))
    .orderBy(asc(chapters.orderIndex));

  if (chs.length === 0) return { project, chapters: [] };

  const qs = await db
    .select()
    .from(questions)
    .where(inArray(questions.chapterId, chs.map((c) => c.id)))
    .orderBy(asc(questions.orderIndex));

  return {
    project,
    chapters: chs.map((c) => ({
      ...c,
      answers: qs.filter((q) => q.chapterId === c.id).map((q) => q.answer.trim()).filter(Boolean),
    })),
  };
}

/**
 * A request may read a book's PDF if the caller has project access, or
 * presents the valid print key (vendor fetch), or the project's share token.
 */
export async function mayRenderPdf(
  projectId: string,
  key: string | null
): Promise<boolean> {
  if (printKeyValid(projectId, key)) return true;
  const role = await canAccess(projectId);
  if (role !== "none") return true;
  if (key) {
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (p && p.shareToken && p.shareToken === key) return true;
  }
  return false;
}

/** Strips a trailing .pdf and validates the UUID shape. */
export function idFromFile(file: string): string | null {
  const id = file.replace(/\.pdf$/i, "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}
