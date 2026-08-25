import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, questions } from "@/db/schema";
import { generateFollowup } from "@/lib/followups";
import { canAccess } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }
  const role = await canAccess(chapter.projectId);
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const existing = await db
    .select()
    .from(questions)
    .where(eq(questions.chapterId, id))
    .orderBy(asc(questions.orderIndex));

  const text = await generateFollowup(
    chapter.era,
    chapter.title,
    chapter.subtitle,
    existing.map((q) => q.text)
  );

  const nextIndex =
    existing.length > 0 ? existing[existing.length - 1].orderIndex + 1 : 0;

  const [question] = await db
    .insert(questions)
    .values({ chapterId: id, text, orderIndex: nextIndex })
    .returning();

  return NextResponse.json({ question }, { status: 201 });
}
