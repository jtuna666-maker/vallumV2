import { asc, desc, eq, inArray, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chapters, projectMembers, projects, questions, type Chapter, type Project, type Question } from "@/db/schema";
import { countWords } from "@/lib/words";
import { currentUser } from "@/lib/auth";
import { canAccess } from "@/lib/access";

export async function listProjectSummaries() {
  const user = await currentUser();
  if (!user) return [];

  const memberships = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id));
  const memberIds = memberships.map((m) => m.projectId);

  const rows = await db
    .select()
    .from(projects)
    .where(
      or(
        eq(projects.ownerId, user.id),
        memberIds.length > 0 ? inArray(projects.id, memberIds) : undefined,
        isNull(projects.ownerId) // legacy inherited rows are visible to the ambient account
      )
    )
    .orderBy(desc(projects.updatedAt));

  const roleById = new Map(memberships.map((m) => [m.projectId, m.role]));
  if (rows.length === 0) return [];

  const allChapters = await db
    .select()
    .from(chapters)
    .where(inArray(chapters.projectId, rows.map((r) => r.id)));
  const allQuestions = await db
    .select()
    .from(questions)
    .where(inArray(questions.chapterId, allChapters.length ? allChapters.map((c) => c.id) : ["__none__"]));

  return rows.map((p) => {
    const chs = allChapters.filter((c) => c.projectId === p.id);
    const ids = new Set(chs.map((c) => c.id));
    const qs = allQuestions.filter((q) => ids.has(q.chapterId));
    const answered = qs.filter((q) => q.answer.trim().length > 0).length;
    const words =
      chs.reduce((s, c) => s + countWords(c.content), 0) +
      qs.reduce((s, q) => s + countWords(q.answer), 0);
    return {
      ...p,
      myRole: roleById.get(p.id) ?? (p.ownerId === user.id ? "owner" : "owner"),
      stats: {
        chapters: chs.length,
        complete: chs.filter((c) => c.status === "complete").length,
        answered,
        questions: qs.length,
        words,
      },
    };
  });
}

/** Last N days of writing activity, scoped to the signed-in user's projects. */
export async function getMomentum(days = 14): Promise<boolean[]> {
  const summaries = await listProjectSummaries();
  const ids = summaries.map((s) => s.id);
  if (ids.length === 0) return Array.from({ length: days }, () => false);

  const chs = await db
    .select({ updatedAt: chapters.updatedAt })
    .from(chapters)
    .where(inArray(chapters.projectId, ids));
  const qs = await db
    .select({ answeredAt: questions.answeredAt })
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .where(inArray(chapters.projectId, ids));

  const activeDays = new Set<string>();
  const stamp = (d: Date | null) => {
    if (d) activeDays.add(d.toISOString().slice(0, 10));
  };
  chs.forEach((c) => stamp(c.updatedAt));
  qs.forEach((q) => stamp(q.answeredAt));

  const out: boolean[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    out.push(activeDays.has(day));
  }
  return out;
}

export type ChapterWithQuestions = Chapter & { questions: Question[] };

export type ProjectDetail = {
  project: Project;
  chapters: ChapterWithQuestions[];
};

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const role = await canAccess(projectId);
  if (role === "none") return null;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const chs = await db
    .select()
    .from(chapters)
    .where(eq(chapters.projectId, projectId))
    .orderBy(asc(chapters.orderIndex));

  if (chs.length === 0) {
    return { project, chapters: [] as ChapterWithQuestions[] };
  }

  const qs = await db
    .select()
    .from(questions)
    .where(inArray(questions.chapterId, chs.map((c) => c.id)))
    .orderBy(asc(questions.orderIndex));

  const byChapter = new Map<string, typeof qs>();
  for (const q of qs) {
    const list = byChapter.get(q.chapterId) ?? [];
    list.push(q);
    byChapter.set(q.chapterId, list);
  }

  return {
    project,
    chapters: chs.map<ChapterWithQuestions>((c) => ({
      ...c,
      questions: byChapter.get(c.id) ?? [],
    })),
  };
}
