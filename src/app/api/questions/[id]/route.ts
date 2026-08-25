import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, questions } from "@/db/schema";
import { canAccess } from "@/lib/access";

const patchSchema = z.object({
  answer: z.string().max(100_000),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [q] = await db
    .select({ chapterId: questions.chapterId })
    .from(questions)
    .where(eq(questions.id, id));
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [ch] = await db
    .select({ projectId: chapters.projectId })
    .from(chapters)
    .where(eq(chapters.id, q.chapterId));
  const role = ch ? await canAccess(ch.projectId) : "none";
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const hasAnswer = parsed.data.answer.trim().length > 0;
  const [updated] = await db
    .update(questions)
    .set({
      answer: parsed.data.answer,
      answeredAt: hasAnswer ? new Date() : null,
    })
    .where(eq(questions.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  return NextResponse.json({ question: updated });
}
