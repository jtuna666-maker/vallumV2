import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { db } from "@/db";
import { chapters, projects } from "@/db/schema";
import { countWords } from "@/lib/words";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "A shared memoir",
  robots: { index: false, follow: false },
};

const ERA_LINES: Record<string, string> = {
  Roots: "Everything before the leaving.",
  Becoming: "The years of choosing.",
  "Turning Points": "The days that decided everything.",
  Legacy: "What remains, on purpose.",
};

export default async function SharedBookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.shareToken, token));
  if (!project || !project.shareToken) notFound();

  const chs = await db
    .select()
    .from(chapters)
    .where(eq(chapters.projectId, project.id))
    .orderBy(asc(chapters.orderIndex));

  const finished = chs.filter((c) => c.content.trim().length > 0);
  const totalWords = finished.reduce((s, c) => s + countWords(c.content), 0);

  return (
    <main className="grain min-h-screen bg-paper">
      <header className="border-b border-line bg-vellum/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-ink text-paper">
              <BookOpen className="size-3.5" />
            </span>
            <span className="display text-lg font-semibold">VELLUM</span>
          </span>
          <span className="text-[0.68rem] font-medium text-ink-faint">
            Read-only · shared privately
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-16">
        <header className="text-center">
          <p className="smallcaps text-[0.65rem] font-semibold text-bronze-deep">A memoir, shared with you</p>
          <h1 className="display mt-4 text-5xl font-medium tracking-tight">{project.title}</h1>
          <p className="display mt-3 text-xl italic text-ink-soft">by {project.authorName}</p>
          {project.dedication && (
            <p className="display mx-auto mt-6 max-w-md text-base italic leading-relaxed text-ink-faint">
              {project.dedication}
            </p>
          )}
          <div className="mx-auto mt-8 flex items-center justify-center gap-3">
            <span className="h-px w-14 bg-bronze/50" />
            <span className="text-bronze">✦</span>
            <span className="h-px w-14 bg-bronze/50" />
          </div>
          <p className="mt-6 text-[0.72rem] font-medium text-ink-faint">
            {finished.length} chapters so far · {totalWords.toLocaleString()} words · still being written
          </p>
        </header>

        <div className="mt-14 space-y-12">
          {finished.map((ch, i) => {
            const prev = finished[i - 1];
            const showEra = !prev || prev.era !== ch.era;
            const paras = ch.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
            return (
              <div key={ch.id}>
                {showEra && (
                  <p className="smallcaps mb-8 text-center text-[0.62rem] font-bold text-bronze-deep">
                    {ch.era} — {ERA_LINES[ch.era] ?? ""}
                  </p>
                )}
                <article className="shadow-book rounded-lg border border-line bg-vellum p-9 sm:p-12">
                  <header className="mb-8 text-center">
                    <p className="smallcaps text-[0.58rem] font-semibold text-ink-faint">
                      Chapter {chs.indexOf(ch) + 1}
                    </p>
                    <h2 className="display mt-2 text-3xl font-semibold">{ch.title}</h2>
                    {ch.subtitle && (
                      <p className="display mt-1.5 text-sm italic text-ink-faint">{ch.subtitle}</p>
                    )}
                    <div className="mx-auto mt-5 flex items-center justify-center gap-2.5">
                      <span className="h-px w-8 bg-bronze/50" />
                      <span className="text-[0.55rem] text-bronze">✦</span>
                      <span className="h-px w-8 bg-bronze/50" />
                    </div>
                  </header>
                  {ch.imageUrl && (
                    <figure className="mx-auto mb-9 max-w-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ch.imageUrl}
                        alt={ch.imageCaption || ch.title}
                        className="w-full rounded-sm border-[6px] border-white object-cover shadow-book"
                      />
                      {ch.imageCaption && (
                        <figcaption className="display mt-3 text-center text-sm italic text-ink-faint">
                          {ch.imageCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}
                  <div className="prose-book">
                    {paras.map((para, pi) => (
                      <p key={pi} className={pi === 0 ? "dropcap" : undefined}>
                        {para}
                      </p>
                    ))}
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        <footer className="mt-16 text-center">
          <p className="display text-lg italic text-ink-soft">
            More pages are coming — check back as the story grows.
          </p>
        </footer>
      </div>
    </main>
  );
}
