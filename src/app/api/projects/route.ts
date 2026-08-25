import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, projectMembers, projects, questions } from "@/db/schema";
import { CHAPTER_TEMPLATES } from "@/lib/templates";
import { currentUser } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  authorName: z.string().min(1).max(120),
  dedication: z.string().max(400).optional().default(""),
  theme: z.enum(["parchment", "ink", "sage"]).optional().default("parchment"),
});

export async function GET() {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt));

  const result = await Promise.all(
    rows.map(async (p) => {
      const chs = await db
        .select()
        .from(chapters)
        .where(eq(chapters.projectId, p.id))
        .orderBy(asc(chapters.orderIndex));
      const chapterIds = new Set(chs.map((c) => c.id));
      const qs = chs.length
        ? await db.select().from(questions)
        : [];
      const projectQuestions = qs.filter((q) => chapterIds.has(q.chapterId));
      const answered = projectQuestions.filter(
        (q) => q.answer.trim().length > 0
      ).length;
      const words =
        chs.reduce((sum, c) => sum + c.content.trim().split(/\s+/).filter(Boolean).length, 0) +
        projectQuestions.reduce(
          (sum, q) => sum + q.answer.trim().split(/\s+/).filter(Boolean).length,
          0
        );
      const complete = chs.filter((c) => c.status === "complete").length;
      return {
        ...p,
        stats: {
          chapters: chs.length,
          complete,
          answered,
          questions: projectQuestions.length,
          words,
        },
      };
    })
  );

  return NextResponse.json({ projects: result });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project data", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, authorName, dedication, theme } = parsed.data;
  const user = await currentUser();

  const project = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({
        title,
        authorName,
        dedication: dedication ?? "",
        theme,
        ownerId: user?.id ?? null,
      })
      .returning();

    if (user) {
      await tx
        .insert(projectMembers)
        .values({ projectId: p.id, userId: user.id, role: "owner" })
        .onConflictDoNothing();
    }

    for (let i = 0; i < CHAPTER_TEMPLATES.length; i++) {
      const t = CHAPTER_TEMPLATES[i];
      const [chapter] = await tx
        .insert(chapters)
        .values({
          projectId: p.id,
          era: t.era,
          title: t.title,
          subtitle: t.subtitle,
          orderIndex: i,
        })
        .returning();

      await tx.insert(questions).values(
        t.questions.map((text, qi) => ({
          chapterId: chapter.id,
          text,
          orderIndex: qi,
        }))
      );
    }

    return p;
  });

  return NextResponse.json({ project }, { status: 201 });
}
