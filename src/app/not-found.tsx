import Link from "next/link";
import { BookOpen, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-center">
      <span className="grid size-14 place-items-center rounded-xl bg-ink text-paper shadow-lift">
        <BookOpen className="size-7" strokeWidth={1.5} />
      </span>
      <p className="smallcaps mt-8 text-[0.68rem] font-semibold text-bronze-deep">
        Chapter not found
      </p>
      <h1 className="display mt-3 text-5xl font-medium tracking-tight md:text-6xl">
        This page isn&apos;t written <span className="display-wonk italic text-bronze-deep">yet.</span>
      </h1>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-soft">
        The best stories take a few drafts. This address points nowhere — but your shelf and your
        memoirs are exactly where you left them.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold transition hover:border-bronze hover:text-bronze-deep"
        >
          <Home className="size-4" /> Start at the beginning
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-bronze-deep"
        >
          <BookOpen className="size-4" /> Open the studio
        </Link>
      </div>
    </main>
  );
}
