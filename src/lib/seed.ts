import "server-only";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { chapters, projects, users } from "@/db/schema";
import { CHAPTER_TEMPLATES } from "@/lib/templates";

const PHOTO_URL =
  "https://images.pexels.com/photos/35179833/pexels-photo-35179833.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200";

const CH1 =
  "The house on Willow Lane had a lean to it, the way old dogs lean against your leg. My grandmother swore it was the wind's fault, forty winters of pushing from the lake, but I think the house was simply tired of standing straight.\n\nThe kitchen smelled of chicory coffee and whatever my mother had decided to burn that morning. I did not know we were poor until I was twelve and someone at school told me. Poverty, it turns out, is something other people tell you about your own happiness.";

const CH2 =
  "My mother was small hands and quick judgments, and she was right so often that I spent my twenties trying to catch her being wrong.";

const CH9 =
  "Winter of '76, outside the Chippewa Street diner, snow coming down sideways. She was laughing at something I could not hear, standing in the cold without a coat as if the weather were someone else's problem. So I gave her mine. She kept it a week.\n\nShe is why I believe some things are decided before you are consulted.";

const CONTENT: Record<string, { content: string; status: string; imageUrl?: string; imageCaption?: string }> = {
  "Where You Began": {
    content: CH1,
    status: "complete",
    imageUrl: PHOTO_URL,
    imageCaption: "The kitchen on Willow Lane, more or less as I remember it.",
  },
  "The People Who Raised You": { content: CH2, status: "drafting" },
  "What You Believe Now": { content: CH9, status: "complete" },
};

/**
 * Idempotent showcase seeding: if the ambient demo household exists and no
 * projects do, plant the flagship memoir so the studio is never empty
 * (fresh sandboxes, first boots, demo links).
 */
export async function ensureDemoSeed(): Promise<void> {
  const [demo] = await db
    .select()
    .from(users)
    .where(eq(users.email, "vellum.demo@vellum.local"));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects);
  if (!demo || count > 0) return;

  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({
        title: "A Life in Eras",
        authorName: "Eleanor Whitfield",
        dedication: "For the ones who come after.",
        theme: "ink",
        ownerId: demo.id,
        shareToken: randomBytes(24).toString("base64url"),
      })
      .returning();

    for (let i = 0; i < CHAPTER_TEMPLATES.length; i++) {
      const t = CHAPTER_TEMPLATES[i];
      const extra = CONTENT[t.title] ?? { content: "", status: "unwritten" };
      await tx.insert(chapters).values({
        projectId: p.id,
        era: t.era,
        title: t.title,
        subtitle: t.subtitle,
        orderIndex: i,
        content: extra.content,
        status: extra.status,
        imageUrl: extra.imageUrl ?? "",
        imageCaption: extra.imageCaption ?? "",
      });
    }

    await tx.execute(
      sql`INSERT INTO project_members (project_id, user_id, role)
          VALUES (${p.id}, ${demo.id}, 'owner')
          ON CONFLICT DO NOTHING`
    );
  });

  console.log("[vellum] seeded the showcase memoir for the demo household");
}
