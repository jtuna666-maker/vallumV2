import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getProjectDetail } from "@/lib/projects";
import { countWords, formatCompact } from "@/lib/words";
import PrintButton from "@/components/print-button";
import ShareButton from "@/components/share-button";
import OrderHardcover from "@/components/order-hardcover";

export const dynamic = "force-dynamic";

const COVERS: Record<string, { bg: string; gold: string; name: string }> = {
  parchment: { bg: "#6e3a2a", gold: "#d8b06a", name: "Parchment edition" },
  ink: { bg: "#1c1a17", gold: "#c9a15c", name: "Ink edition" },
  sage: { bg: "#3d4a35", gold: "#cbb172", name: "Sage edition" },
};

const ERA_LINES: Record<string, string> = {
  Roots: "Everything before the leaving.",
  Becoming: "The years of choosing.",
  "Turning Points": "The days that decided everything.",
  Legacy: "What remains, on purpose.",
};

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { id } = await params;
  const { order } = await searchParams;
  const detail = await getProjectDetail(id);
  if (!detail) notFound();

  const { project } = detail;
  const chapters = [...detail.chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const cover = COVERS[project.theme] ?? COVERS.parchment;

  const chapterBody = (c: (typeof chapters)[number]): string[] => {
    const raw =
      c.content.trim().length > 0
        ? c.content
        : c.questions.map((q) => q.answer.trim()).filter(Boolean).join("\n\n");
    return raw
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  };

  const totalWords = chapters.reduce((s, c) => s + countWords(chapterBody(c).join(" ")), 0);
  const eras: { era: string; chapters: typeof chapters }[] = [];
  for (const ch of chapters) {
    const last = eras[eras.length - 1];
    if (last && last.era === ch.era) last.chapters.push(ch);
    else eras.push({ era: ch.era, chapters: [ch] });
  }

  return (
    <main className="min-h-screen bg-[#e8e0cf]">
      {/* screen toolbar */}
      <div className="no-print sticky top-0 z-40 border-b border-line/70 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link
            href={`/app/project/${project.id}`}
            className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-soft transition hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Back to writing
          </Link>
          <span className="hidden items-center gap-2 text-[0.7rem] font-medium text-ink-faint sm:flex">
            <BookOpen className="size-3.5 text-bronze" />
            {formatCompact(totalWords)} words · {cover.name}
          </span>
          <span className="flex items-center gap-2.5">
            <ShareButton
              title={project.title}
              text={`"${project.title}" — a memoir by ${project.authorName}`}
              shareToken={project.shareToken}
            />
            <PrintButton />
            <OrderHardcover projectId={project.id} />
          </span>
        </div>
      </div>

      {order === "success" && (
        <div className="no-print mx-auto -mt-2 max-w-3xl px-4 sm:px-6">
          <div className="rounded-xl border border-moss/40 bg-moss/10 px-6 py-4 text-center">
            <p className="display text-lg font-medium text-moss">
              The keepsake is on its way to the press.
            </p>
            <p className="mt-1 text-[0.78rem] text-ink-soft">
              Payment received — when the printer accepts the job, this will say &ldquo;printing
              &amp; shipping.&rdquo;
            </p>
          </div>
        </div>
      )}
      {order === "reserved" && (
        <div className="no-print mx-auto -mt-2 max-w-3xl px-4 sm:px-6">
          <div className="rounded-xl border border-bronze/40 bg-bronze/10 px-6 py-4 text-center">
            <p className="display text-lg font-medium text-bronze-deep">
              Your hardcover is reserved.
            </p>
            <p className="mt-1 text-[0.78rem] text-ink-soft">
              Online checkout isn&apos;t switched on for this deployment yet — we&apos;ve recorded
              your reservation and will reach out to arrange printing.
            </p>
          </div>
        </div>
      )}
      {order === "cancelled" && (
        <div className="no-print mx-auto -mt-2 max-w-3xl px-4 sm:px-6">
          <div className="rounded-xl border border-line bg-vellum px-6 py-4 text-center">
            <p className="text-[0.78rem] text-ink-soft">
              Checkout was cancelled — the book is still right here whenever you&apos;re ready.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
        {/* ===== cover ===== */}
        <section
          className="book-page book-cover grain relative mx-auto aspect-[3/4.1] max-w-xl overflow-hidden rounded-r-xl rounded-l-sm shadow-book"
          style={{ background: cover.bg }}
        >
          <div className="absolute inset-y-0 left-0 w-5 bg-black/35" />
          <div
            className="absolute inset-x-10 inset-y-8 rounded-sm border opacity-60"
            style={{ borderColor: cover.gold }}
          />
          <div className="relative flex h-full flex-col items-center justify-between px-12 py-14 text-center">
            <p
              className="smallcaps text-[0.6rem] font-semibold tracking-[0.3em]"
              style={{ color: cover.gold }}
            >
              A Memoir
            </p>
            <div>
              <h1
                className="display text-4xl font-medium leading-tight sm:text-5xl"
                style={{ color: "#efe6d0" }}
              >
                {project.title}
              </h1>
              <div
                className="mx-auto mt-6 h-px w-20"
                style={{ background: cover.gold }}
              />
              <p
                className="display mt-6 text-lg italic"
                style={{ color: cover.gold }}
              >
                by {project.authorName}
              </p>
            </div>
            <p className="smallcaps text-[0.55rem] tracking-[0.25em] text-white/50">
              VELLUM Press
            </p>
          </div>
        </section>

        {/* ===== title & dedication ===== */}
        <section className="book-page mx-auto max-w-xl rounded-lg border border-line bg-vellum p-14 text-center shadow-lift sm:p-20">
          <p className="smallcaps text-[0.6rem] font-semibold text-ink-faint">{cover.name}</p>
          <h2 className="display mt-8 text-4xl font-medium">{project.title}</h2>
          <p className="display mt-3 text-lg italic text-ink-soft">by {project.authorName}</p>
          <div className="mx-auto my-10 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-bronze/50" />
            <span className="text-bronze">✦</span>
            <span className="h-px w-12 bg-bronze/50" />
          </div>
          {project.dedication ? (
            <p className="display mx-auto max-w-xs text-lg italic leading-relaxed text-ink-soft">
              {project.dedication}
            </p>
          ) : (
            <p className="display mx-auto max-w-xs text-lg italic leading-relaxed text-ink-faint">
              For the ones who come after.
            </p>
          )}
        </section>

        {/* ===== eras & chapters ===== */}
        {eras.map((group, gi) => (
          <div key={group.era} className="space-y-10">
            {/* era divider */}
            <section className="book-page book-cover mx-auto grid max-w-xl place-items-center rounded-lg border border-line bg-vellum px-10 py-24 text-center shadow-lift">
              <div>
                <p className="smallcaps text-[0.62rem] font-semibold text-bronze-deep">
                  Part {["One", "Two", "Three", "Four", "Five", "Six"][gi] ?? gi + 1}
                </p>
                <h2 className="display mt-3 text-5xl font-medium">{group.era}</h2>
                <p className="display mt-4 text-lg italic text-ink-soft">
                  {ERA_LINES[group.era] ?? ""}
                </p>
                <div className="mx-auto mt-8 h-px w-16 bg-bronze/50" />
              </div>
            </section>

            {group.chapters.map((ch) => {
              const body = chapterBody(ch);
              return (
                <article
                  key={ch.id}
                  className="book-page book-chapter mx-auto max-w-xl rounded-lg border border-line bg-vellum p-10 shadow-lift sm:p-14"
                >
                  <header className="mb-9 text-center">
                    <p className="smallcaps text-[0.6rem] font-semibold text-ink-faint">
                      Chapter {chapters.indexOf(ch) + 1}
                    </p>
                    <h3 className="display mt-2 text-3xl font-semibold">{ch.title}</h3>
                    <p className="display mt-1.5 text-sm italic text-ink-faint">{ch.subtitle}</p>
                    <div className="mx-auto mt-6 flex items-center justify-center gap-2.5">
                      <span className="h-px w-8 bg-bronze/50" />
                      <span className="text-[0.6rem] text-bronze">✦</span>
                      <span className="h-px w-8 bg-bronze/50" />
                    </div>
                  </header>
                  {ch.imageUrl && (
                    <figure className="mx-auto mb-10 max-w-md">
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
                  {body.length > 0 ? (
                    <div className="prose-book">
                      {body.map((para, i) => (
                        <p key={i} className={i === 0 ? "dropcap" : undefined}>
                          {para}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="display text-center italic text-ink-faint">
                      This chapter is still being gathered.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ))}

        {/* ===== colophon ===== */}
        <section className="book-page mx-auto max-w-xl rounded-lg border border-line bg-vellum p-14 text-center shadow-lift">
          <p className="display text-2xl italic text-ink-soft">Here the book rests — for now.</p>
          <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-ink-faint">
            Set in Fraunces and pressed by VELLUM. These {formatCompact(totalWords)} words belong
            to {project.authorName}, forever.
          </p>
          <Link
            href={`/app/project/${project.id}`}
            className="no-print mt-8 inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-xs font-semibold transition hover:border-bronze hover:text-bronze-deep"
          >
            <ArrowLeft className="size-3.5" /> Keep writing
          </Link>
        </section>
      </div>
    </main>
  );
}
