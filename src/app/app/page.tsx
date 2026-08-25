import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Feather, Library, PenLine, Quote, Users } from "lucide-react";
import { getMomentum, listProjectSummaries } from "@/lib/projects";
import { formatCompact } from "@/lib/words";
import { currentUser, saveSession } from "@/lib/auth";
import { ensureBootstrap } from "@/lib/bootstrap";
import NewProjectForm from "@/components/new-project-form";
import UserMenu from "@/components/user-menu";
import AmbientAdopt from "@/components/ambient-adopt";
import { sessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-bronze to-bronze-deep transition-all"
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

export default async function DashboardPage() {
  await ensureBootstrap();
  // An unsealed visit falls back to the ambient demo account via
  // currentUser(); AmbientAdopt (below) quietly seals that session so the
  // requester is durably signed in going forward.
  const user = await currentUser();
  if (!user) redirect("/signin");
  const sealed = await sessionUser();
  const summaries = await listProjectSummaries();
  const momentum = await getMomentum(14);
  const activeDays = momentum.filter(Boolean).length;
  const totals = summaries.reduce(
    (acc, p) => ({
      words: acc.words + p.stats.words,
      complete: acc.complete + p.stats.complete,
      answered: acc.answered + p.stats.answered,
    }),
    { words: 0, complete: 0, answered: 0 }
  );

  return (
    <main className="grain relative min-h-screen bg-paper">
      {!sealed && <AmbientAdopt />}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-ink text-paper">
              <BookOpen className="size-4" strokeWidth={1.8} />
            </span>
            <span className="display text-xl font-semibold tracking-tight">VELLUM</span>
            <span className="smallcaps mt-0.5 hidden text-[0.6rem] font-semibold text-ink-faint sm:inline">
              The Studio
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-[0.8rem] font-medium text-ink-soft">
            <Link href="/" className="transition hover:text-ink">Home</Link>
            <UserMenu email={user.email} name={user.name} />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="smallcaps text-[0.68rem] font-semibold text-bronze-deep">Your shelf</p>
            <h1 className="display mt-2 text-4xl font-medium tracking-tight md:text-5xl">
              Memoirs in progress
            </h1>
          </div>
          {summaries.length > 0 && (
            <div className="flex items-center gap-8 rounded-xl border border-line bg-vellum px-6 py-4 shadow-lift">
              <div>
                <p className="display text-2xl font-semibold">{formatCompact(totals.words)}</p>
                <p className="text-[0.65rem] font-semibold tracking-wide text-ink-faint">WORDS REMEMBERED</p>
              </div>
              <div className="h-9 w-px bg-line" />
              <div>
                <p className="display text-2xl font-semibold">{totals.complete}</p>
                <p className="text-[0.65rem] font-semibold tracking-wide text-ink-faint">CHAPTERS DONE</p>
              </div>
              <div className="h-9 w-px bg-line" />
              <div>
                <p className="display text-2xl font-semibold">{totals.answered}</p>
                <p className="text-[0.65rem] font-semibold tracking-wide text-ink-faint">PROMPTS ANSWERED</p>
              </div>
              <div className="h-9 w-px bg-line" />
              <div>
                <div className="flex h-7 items-end gap-1">
                  {momentum.map((on, i) => (
                    <span
                      key={i}
                      className={`w-2 rounded-[3px] transition ${
                        on ? "h-6 bg-bronze" : "h-2 bg-ink/10"
                      } ${i === momentum.length - 1 ? "ring-1 ring-bronze/50" : ""}`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[0.65rem] font-semibold tracking-wide text-ink-faint">
                  {activeDays}/14 DAYS WRITING
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* New memoir */}
          <section className="h-fit rounded-2xl border border-line bg-vellum p-7 shadow-lift lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-paper-deep text-bronze-deep">
                <Feather className="size-5" strokeWidth={1.7} />
              </span>
              <div>
                <h2 className="display text-xl font-semibold">Begin a new memoir</h2>
                <p className="text-xs text-ink-faint">Twelve guided chapters, ready in seconds.</p>
              </div>
            </div>
            <NewProjectForm />
          </section>

          {/* Shelf */}
          <section>
            {summaries.length === 0 ? (
              <div className="grid min-h-[380px] place-items-center rounded-2xl border border-dashed border-line bg-vellum/60 p-12 text-center">
                <div className="max-w-sm">
                  <Library className="mx-auto size-10 text-bronze/60" strokeWidth={1.4} />
                  <h3 className="display mt-5 text-2xl font-semibold">The shelf is empty — for now</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    Every bestselling life started with one answered question. Create your memoir on
                    the left and your twelve chapters appear instantly.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2">
                {summaries.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/app/project/${p.id}`}
                      className="group block h-full rounded-2xl border border-line bg-vellum p-6 shadow-lift transition-all duration-300 hover:-translate-y-1 hover:shadow-book"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="smallcaps text-[0.6rem] font-semibold text-bronze-deep">
                            {p.theme === "ink" ? "Ink edition" : p.theme === "sage" ? "Sage edition" : "Parchment edition"}
                            {p.myRole !== "owner" && (
                              <span className="ml-2 inline-flex -translate-y-px items-center gap-1 rounded-full bg-bronze/15 px-2 py-0.5 normal-case tracking-normal">
                                <Users className="size-2.5" /> shared · {p.myRole}
                              </span>
                            )}
                          </p>
                          <h3 className="display mt-2 text-2xl font-semibold leading-tight">
                            {p.title}
                          </h3>
                          <p className="mt-1 text-sm italic text-ink-soft">
                            as told by {p.authorName}
                          </p>
                        </div>
                        <PenLine className="size-4 shrink-0 text-ink-faint transition group-hover:text-bronze-deep" />
                      </div>

                      {p.dedication && (
                        <p className="mt-4 flex items-start gap-2 text-xs italic text-ink-faint">
                          <Quote className="size-3 shrink-0" />
                          {p.dedication}
                        </p>
                      )}

                      <div className="mt-6">
                        <div className="mb-2 flex items-center justify-between text-[0.68rem] font-semibold text-ink-faint">
                          <span>
                            {p.stats.complete}/{p.stats.chapters} chapters
                          </span>
                          <span>
                            {p.stats.answered}/{p.stats.questions} prompts · {formatCompact(p.stats.words)} words
                          </span>
                        </div>
                        <ProgressBar value={p.stats.complete} max={p.stats.chapters} />
                      </div>

                      <p className="mt-4 text-[0.68rem] text-ink-faint">
                        Last touched{" "}
                        {new Date(p.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
