import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chapters, questions } from "@/db/schema";
import { canAccess } from "@/lib/access";

const createSchema = z.object({
  projectId: z.string().uuid(),
  era: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional().default(""),
  question: z.string().max(400).optional().default(""),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chapter data" }, { status: 400 });
  }
  const { projectId, era, title, subtitle, question } = parsed.data;

  const role = await canAccess(projectId);
  if (role === "none") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "viewer") return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const chapter = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(asc(chapters.orderIndex));

    const eraOrders = existing.filter((c) => c.era === era).map((c) => c.orderIndex);
    const insertAt =
      eraOrders.length > 0 ? Math.max(...eraOrders) + 1 : existing.length;

    // open a slot: shift every chapter at/after insertAt
    await tx.execute(
      sql`UPDATE chapters SET order_index = order_index + 1
          WHERE project_id = ${projectId} AND order_index >= ${insertAt}`
    );

    const [created] = await tx
      .insert(chapters)
      .values({ projectId, era, title, subtitle, orderIndex: insertAt })
      .returning();

    if (question.trim()) {
      await tx.insert(questions).values({
        chapterId: created.id,
        text: question.trim(),
        orderIndex: 0,
      });
    }

    return created;
  });

  return NextResponse.json({ chapter }, { status: 201 });
}
