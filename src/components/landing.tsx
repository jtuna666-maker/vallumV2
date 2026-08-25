"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Library,
  Lock,
  Map,
  Mic,
  PenLine,
  Printer,
  Quote,
  Sparkles,
} from "lucide-react";
import {
  BULK_BREAKS,
  EDITIONS,
  EDITION_ORDER,
  formatUsd,
  quote,
} from "@/lib/pricing";

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="smallcaps flex items-center gap-3 text-[0.7rem] font-semibold text-bronze-deep">
      <span className="inline-block h-px w-8 bg-bronze/60" />
      {children}
    </p>
  );
}

/* ---------------- Nav ---------------- */
function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-md bg-ink text-paper">
            <BookOpen className="size-4" strokeWidth={1.8} />
          </span>
          <span className="display text-xl font-semibold tracking-tight">VELLUM</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[0.82rem] font-medium text-ink-soft md:flex">
          <a href="#how" className="transition hover:text-ink">How it works</a>
          <a href="#sample" className="transition hover:text-ink">A sample chapter</a>
          <a href="#book" className="transition hover:text-ink">The book</a>
          <a href="#pricing" className="transition hover:text-ink">Pricing</a>
          <a href="#faq" className="transition hover:text-ink">FAQ</a>
        </nav>
        <Link
          href="/app"
          className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[0.8rem] font-semibold text-paper transition hover:bg-bronze-deep"
        >
          Open the studio
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
const ERA_TAGS = ["Roots", "Becoming", "Turning Points", "Legacy"];

function HeroBook() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 1.2, delay: 0.35, ease }}
      className="relative mx-auto w-full max-w-[340px]"
    >
      <div className="shadow-book relative aspect-[3/4.1] rounded-r-xl rounded-l-sm border border-[#3a2c1c] bg-[#2b2118]">
        {/* spine */}
        <div className="absolute inset-y-0 left-0 w-[18px] rounded-l-sm bg-gradient-to-r from-black/50 to-transparent" />
        <div className="absolute inset-y-6 left-[5px] w-px bg-white/10" />
        {/* cover art */}
        <div className="absolute inset-0 flex flex-col items-center justify-between px-8 py-10 text-center">
          <div className="mt-2">
            <p className="smallcaps text-[0.55rem] text-paper/60">A memoir in twelve chapters</p>
          </div>
          <div>
            <div className="mx-auto mb-5 size-14 rounded-full border border-[#c9a15c]/50 p-1.5">
              <div className="grid size-full place-items-center rounded-full border border-[#c9a15c]/30">
                <Sparkles className="size-5 text-[#c9a15c]" strokeWidth={1.4} />
              </div>
            </div>
            <p className="display text-3xl leading-tight font-medium text-[#e8dcc2]">
              The Way<br />It Was
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-[#c9a15c]/50" />
            <p className="display mt-4 text-sm italic text-[#c9a15c]">as told by you</p>
          </div>
          <p className="smallcaps text-[0.55rem] text-paper/50">VELLUM Press</p>
        </div>
      </div>

      {/* floating cards */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.9, ease }}
        className="shadow-lift absolute -left-16 top-16 hidden w-52 -rotate-6 rounded-lg border border-line bg-vellum p-4 sm:block"
      >
        <div className="flex items-center gap-2 text-[0.62rem] font-semibold text-bronze-deep">
          <Mic className="size-3" /> VOICE NOTE · 03:12
        </div>
        <p className="display mt-2 text-[0.82rem] italic leading-snug text-ink-soft">
          “…she was laughing at something, didn&apos;t have a coat. I gave her mine…”
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 1.1, ease }}
        className="shadow-lift absolute -right-14 bottom-20 hidden w-48 rotate-3 rounded-lg border border-line bg-vellum p-4 sm:block"
      >
        <div className="text-[0.62rem] font-semibold text-bronze-deep">CHAPTER SEVEN</div>
        <p className="display mt-1.5 text-[0.95rem] font-medium leading-snug">The Coat, 1976</p>
        <div className="mt-2.5 space-y-1.5">
          <div className="h-1 rounded bg-ink/15" />
          <div className="h-1 w-4/5 rounded bg-ink/15" />
          <div className="h-1 w-3/5 rounded bg-ink/15" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 1.3, ease }}
        className="absolute -right-4 -top-5 grid size-24 place-items-center rounded-full border border-bronze/40 bg-paper text-center shadow-lift"
      >
        <div>
          <p className="display text-xl font-semibold text-bronze-deep">8<span className="text-sm">/12</span></p>
          <p className="text-[0.52rem] font-semibold tracking-wide text-ink-soft">CHAPTERS DONE</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="paper-edge grain relative overflow-hidden pb-24 pt-36 md:pt-44">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Reveal>
            <div className="flex flex-wrap items-center gap-2">
              {ERA_TAGS.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-vellum px-3 py-1 text-[0.68rem] font-semibold text-ink-soft"
                >
                  {t}
                </span>
              ))}
              <span className="text-[0.68rem] italic text-ink-faint">— the four eras of a life</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-7 text-5xl font-medium leading-[1.04] tracking-tight md:text-[4.6rem]">
              Your life,
              <br />
              <span className="display-wonk italic text-bronze-deep">beautifully</span> written.
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
              VELLUM is a private memoir studio. Twelve guided chapters carry you from childhood to
              legacy — answer warm interview questions out loud, and watch your story become a book
              worth handing down. No blank page. No writing required.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="group inline-flex items-center gap-2.5 rounded-full bg-oxblood px-7 py-3.5 text-sm font-semibold text-paper shadow-lift transition hover:bg-bronze-deep"
              >
                Start your memoir free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#sample"
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3.5 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze-deep"
              >
                Read a sample chapter
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 text-[0.78rem] font-medium text-ink-soft">
              <span className="flex items-center gap-1.5"><Check className="size-3.5 text-bronze" /> Free to start</span>
              <span className="flex items-center gap-1.5"><Mic className="size-3.5 text-bronze" /> Voice-first, no typing</span>
              <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-bronze" /> Private by default</span>
              <span className="flex items-center gap-1.5"><Printer className="size-3.5 text-bronze" /> Print-ready anytime</span>
            </div>
          </Reveal>
        </div>
        <HeroBook />
      </div>
    </section>
  );
}

/* ---------------- Marquee ---------------- */
const FRAGMENTS = [
  "the kitchen on Sunday mornings",
  "dad's old truck, rust and all",
  "Buffalo, winter of '76",
  "the day I almost didn't go",
  "eight cents an hour",
  "the house on Willow Lane",
  "an apology forty years late",
  "mother's handwriting",
  "the war nobody mentioned",
  "first light on the water",
  "what the wrench taught me",
  "the sister I chose",
];

function Marquee() {
  const items = [...FRAGMENTS, ...FRAGMENTS];
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink py-4">
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
        {items.map((f, i) => (
          <span key={i} className="display flex items-center gap-10 text-lg italic text-paper/80">
            {f}
            <span className="text-bronze not-italic">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Upgrades ---------------- */
const FEATURES = [
  {
    icon: Map,
    title: "A map of your whole life",
    body: "Twelve chapters across four eras — Roots, Becoming, Turning Points, Legacy. You always know where you are and what remains. Other apps hand you a loose pile of topics; VELLUM hands you a spine.",
  },
  {
    icon: Mic,
    title: "Speak, don't type",
    body: "Every prompt has a microphone. Tell the story the way you'd tell it at the kitchen table — your words appear as you talk. Rambling is welcome; shape comes later.",
  },
  {
    icon: BookOpen,
    title: "Your book, live as you write",
    body: "Watch the memoir typeset itself. The manuscript grows beside your answers, and a print-ready preview is always one click away — not locked behind a checkout.",
  },
  {
    icon: PenLine,
    title: "Every word is yours to edit",
    body: "Nothing is sealed. Rewrite any answer, expand any chapter, mark it complete when it feels true. The book wears your voice, not ours.",
  },
  {
    icon: Library,
    title: "Progress you can feel",
    body: "Completion rings, word counts and a twelve-chapter goal keep momentum honest. Most memoirists finish in about five hours of talking — ten minutes at a time.",
  },
  {
    icon: Lock,
    title: "Private, portable, permanent",
    body: "Your stories are never sold, never shown, never fed to an ad. Export or print everything, whenever you like, even if you leave.",
  },
];

function Features() {
  return (
    <section id="how" className="relative py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <Eyebrow>Why VELLUM</Eyebrow>
          <h2 className="display mt-4 text-4xl font-medium leading-tight md:text-5xl">
            Built for the storyteller in you —{" "}
            <span className="italic text-bronze-deep">even if you never write.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={0.06 * i}>
              <div className="group shadow-lift h-full rounded-xl border border-line bg-vellum p-7 transition-transform duration-300 hover:-translate-y-1">
                <div className="grid size-11 place-items-center rounded-lg bg-paper-deep text-bronze-deep transition-colors group-hover:bg-bronze group-hover:text-paper">
                  <f.icon className="size-5" strokeWidth={1.7} />
                </div>
                <h3 className="display mt-5 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2.5 text-[0.9rem] leading-relaxed text-ink-soft">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Sample chapter ---------------- */
function Sample() {
  return (
    <section id="sample" className="grain relative border-y border-line bg-paper-deep py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <Eyebrow>From memory to page</Eyebrow>
          <h2 className="display mt-4 text-4xl font-medium leading-tight md:text-5xl">
            Four minutes of talking.{" "}
            <span className="italic text-bronze-deep">A chapter you&apos;re proud of.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <Reveal delay={0.1}>
            <div className="shadow-lift h-full rounded-xl border border-line bg-ink p-8 text-paper">
              <p className="smallcaps text-[0.65rem] font-semibold text-paper/50">What you said · out loud</p>
              <div className="mt-6 space-y-5 text-[0.95rem] leading-relaxed">
                <div>
                  <p className="display text-[0.8rem] italic text-bronze">VELLUM asks —</p>
                  <p className="mt-1 text-paper/85">
                    You said you met Eleanor in Buffalo. Set the scene. What month, what was the weather doing?
                  </p>
                </div>
                <div className="rounded-lg border border-paper/15 bg-paper/5 p-4">
                  <p className="smallcaps text-[0.6rem] text-paper/40"><Mic className="mr-1 inline size-3" /> transcribed as you spoke</p>
                  <p className="display mt-2 italic text-paper/90">
                    “winter. &apos;76 i think. outside the chippewa street diner, snow coming down sideways.”
                  </p>
                </div>
                <div>
                  <p className="display text-[0.8rem] italic text-bronze">VELLUM asks —</p>
                  <p className="mt-1 text-paper/85">And Eleanor. What&apos;s the first thing you noticed about her?</p>
                </div>
                <div className="rounded-lg border border-paper/15 bg-paper/5 p-4">
                  <p className="display italic text-paper/90">
                    “she was laughing at something. didn&apos;t have a coat. i gave her mine and she kept it a week.”
                  </p>
                </div>
                <p className="text-[0.72rem] text-paper/45">End of session · about 4 minutes</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="shadow-book relative h-full rounded-lg border border-line bg-vellum p-10 md:p-12">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-bronze/40 to-transparent" />
              <p className="smallcaps text-[0.65rem] font-semibold text-ink-faint">The chapter it becomes</p>
              <h3 className="display mt-4 text-3xl font-semibold">The Coat</h3>
              <div className="mx-auto my-6 flex items-center gap-3">
                <span className="h-px w-10 bg-bronze/50" />
                <span className="text-bronze">✦</span>
                <span className="h-px w-10 bg-bronze/50" />
              </div>
              <div className="prose-book text-[1.02rem]">
                <p className="dropcap">
                  It was the winter of 1976, and the snow on Chippewa Street came down sideways, the
                  way it only does in Buffalo. I had my collar up and nowhere in particular to be.
                </p>
                <p>
                  That was when I saw Eleanor. She was laughing at something I couldn&apos;t hear,
                  standing in the cold without a coat as if the weather were someone else&apos;s
                  problem. So I gave her mine. She kept it a week. I like to think I never really
                  got it back.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.3}>
          <p className="display mt-10 text-center text-lg italic text-ink-soft">
            You never write a word. You just talk — and your life becomes the book.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Steps / eras ---------------- */
const STEPS = [
  {
    n: "01",
    title: "Open your life map",
    body: "Your memoir arrives pre-structured: twelve chapters across four eras, each with three or four warm interview questions. Start anywhere; pick up effortlessly.",
  },
  {
    n: "02",
    title: "Talk it through",
    body: "Tap the microphone or type. Ten minutes answers a question; an evening finishes an era. Every word saves itself the moment you pause.",
  },
  {
    n: "03",
    title: "Hold the book",
    body: "Chapters become pages the moment you finish them. Print at home, hand it to your local binder, or order the cloth hardcover when the story feels done.",
  },
];

function Steps() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="display mt-4 text-4xl font-medium leading-tight md:text-5xl">
            A whole life story, in about <span className="italic text-bronze-deep">five hours of talking.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={0.08 * i}>
              <div className="rule-double relative h-full pt-8">
                <span className="display text-5xl font-light text-bronze/60">{s.n}</span>
                <h3 className="display mt-4 text-2xl font-semibold">{s.title}</h3>
                <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Book ---------------- */
function BookSection() {
  return (
    <section id="book" className="grain relative border-y border-line bg-ink py-28 text-paper">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="smallcaps text-[0.7rem] font-semibold text-[#c9a15c]">The keepsake</p>
            <h2 className="display mt-4 text-4xl font-medium leading-tight md:text-5xl">
              Some things shouldn&apos;t live <span className="italic text-[#c9a15c]">on a screen.</span>
            </h2>
            <p className="mt-6 max-w-lg leading-relaxed text-paper/70">
              When your twelfth chapter settles, VELLUM typesets your memoir into a cloth hardcover
              — your name on the spine, a dedication page, each era opening on its own leaf. It is
              the kind of object grandchildren rescue first.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <ul className="mt-8 space-y-3.5 text-[0.92rem] text-paper/85">
              {[
                "Cloth-bound hardcover, embossed in gold",
                "Dedication page written in your words",
                "Era title pages — Roots, Becoming, Turning Points, Legacy",
                "Print-ready PDF included, forever",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#c9a15c]" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="shadow-book aspect-[3/4] -rotate-2 rounded-r-lg rounded-l-sm border border-[#3a2c1c] bg-[#2b2118] p-8">
              <div className="absolute inset-y-0 left-0 w-4 rounded-l-sm bg-black/40" />
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="smallcaps text-[0.55rem] text-paper/50">VELLUM Press · Volume I</p>
                <p className="display mt-6 text-4xl font-medium text-[#e8dcc2]">A Life<br/>in Eras</p>
                <div className="mt-5 h-px w-14 bg-[#c9a15c]/60" />
                <p className="display mt-5 text-sm italic text-[#c9a15c]">your name, in gold</p>
              </div>
            </div>
            <div className="shadow-lift absolute -bottom-8 -right-4 w-48 rotate-2 rounded-lg border border-line bg-vellum p-4 text-ink">
              <p className="text-[0.62rem] font-semibold text-bronze-deep"><Printer className="mr-1 inline size-3" /> PRINT-READY</p>
              <p className="display mt-1 text-sm italic leading-snug text-ink-soft">
                One click typesets the whole memoir for your home printer or bookbinder.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */
function Pricing() {
  return (
    <section id="pricing" className="py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Simple pricing</Eyebrow>
          <h2 className="display mt-4 text-4xl font-medium leading-tight md:text-5xl">
            Free to write. <span className="italic text-bronze-deep">Pay only for the object.</span>
          </h2>
          <p className="mt-5 text-ink-soft">
            The studio costs nothing and the digital book is free forever. Choose a printed
            edition only when the story feels finished — and order a stack for the family at a
            real discount.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {EDITION_ORDER.map((id, i) => {
            const e = EDITIONS[id];
            const hero = id === "heirloom";
            return (
              <Reveal key={id} delay={0.06 * i}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-8 ${
                    hero
                      ? "border-[#3a2c1c] bg-[#2b2118] text-paper shadow-book"
                      : "border-line bg-vellum shadow-lift"
                  }`}
                >
                  {hero && (
                    <span className="absolute -top-3 left-8 rounded-full bg-[#c9a15c] px-3 py-1 text-[0.6rem] font-bold tracking-wide text-ink">
                      THE HEIRLOOM
                    </span>
                  )}
                  <p
                    className={`smallcaps text-[0.68rem] font-semibold ${
                      hero ? "text-[#c9a15c]" : "text-ink-faint"
                    }`}
                  >
                    {e.name}
                  </p>
                  <p className="display mt-4 text-5xl font-medium">
                    {e.priceCents === 0 ? "$0" : formatUsd(e.priceCents)}
                    {e.physical && (
                      <span
                        className={`text-base font-normal ${hero ? "text-paper/60" : "text-ink-faint"}`}
                      >
                        {" "}
                        /copy
                      </span>
                    )}
                  </p>
                  <p className={`mt-2 text-sm italic ${hero ? "text-paper/70" : "text-ink-soft"}`}>
                    {e.tagline}
                  </p>
                  <ul
                    className={`mt-7 flex-1 space-y-3 text-[0.88rem] ${
                      hero ? "text-paper/85" : ""
                    }`}
                  >
                    {e.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className={`mt-0.5 size-4 shrink-0 ${hero ? "text-[#c9a15c]" : "text-bronze"}`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/app"
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition ${
                      hero
                        ? "bg-[#c9a15c] text-ink hover:bg-[#dcb87e]"
                        : "border border-ink/20 hover:border-bronze hover:text-bronze-deep"
                    }`}
                  >
                    {e.priceCents === 0 ? "Start writing free" : `Choose ${e.name.split(" ").slice(-1)[0]}`}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* volume ladder */}
        <Reveal delay={0.2}>
          <div className="mt-10 rounded-2xl border border-line bg-paper-deep/50 p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Volume pricing</Eyebrow>
                <h3 className="display mt-3 text-2xl font-medium">
                  One for every branch of the family.
                </h3>
              </div>
              <p className="max-w-sm text-[0.82rem] leading-relaxed text-ink-soft">
                Printing several copies costs us less per book, so we pass it straight on. The
                discount applies to every copy in the order.
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {BULK_BREAKS.map((b) => (
                <div
                  key={b.min}
                  className="rounded-xl border border-line bg-vellum px-6 py-5 text-center"
                >
                  <p className="display text-3xl font-medium text-bronze-deep">
                    {b.rate === 0 ? "—" : `${Math.round(b.rate * 100)}%`}
                  </p>
                  <p className="mt-1.5 text-[0.78rem] font-semibold">
                    {b.max === Infinity
                      ? `${b.min}+ copies`
                      : b.min === b.max
                        ? "Single copy"
                        : `${b.min}–${b.max} copies`}
                  </p>
                  <p className="mt-1 text-[0.72rem] text-ink-faint">
                    {b.rate === 0 ? "Standard price" : b.note}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-[0.72rem] text-ink-faint">
              Example — five HEIRLOOM hardcovers:{" "}
              <span className="font-semibold text-ink-soft">
                {formatUsd(quote("heirloom", 5).unitCents)} each,{" "}
                {formatUsd(quote("heirloom", 5).subtotalCents)} total
              </span>{" "}
              (save {formatUsd(quote("heirloom", 5).savingsCents)}).
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */
const QUOTES = [
  {
    quote:
      "I talked about my mother for eleven minutes in the car park outside a grocery store. When I read the chapter back, I cried there too.",
    name: "Margaret D.",
    role: "finished in six evenings",
  },
  {
    quote:
      "The questions are better than the ones my own kids ask me. It remembered that I said 'snow' and asked what the snow sounded like.",
    name: "Tomás R.",
    role: "age 71, first-time writer",
  },
  {
    quote:
      "I printed the preview every Sunday and left it on my father's kitchen table. He filled the margins. That book is the best thing we've made together.",
    name: "Priya S.",
    role: "wrote it for her dad",
  },
];

function Testimonials() {
  return (
    <section className="border-t border-line bg-paper-deep/60 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <Eyebrow>In their words</Eyebrow>
          <h2 className="display mt-4 text-4xl font-medium leading-tight md:text-5xl">
            Lives worth telling, <span className="italic text-bronze-deep">told at last.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={0.08 * i}>
              <figure className="shadow-lift flex h-full flex-col rounded-xl border border-line bg-vellum p-8">
                <Quote className="size-6 text-bronze" strokeWidth={1.5} />
                <blockquote className="display mt-5 flex-1 text-lg italic leading-relaxed text-ink-soft">
                  “{q.quote}”
                </blockquote>
                <figcaption className="mt-6 border-t border-line pt-4">
                  <p className="text-sm font-semibold">{q.name}</p>
                  <p className="text-xs text-ink-faint">{q.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const FAQS = [
  {
    q: "How is VELLUM different from other memoir apps?",
    a: "Two things. Structure: your memoir is mapped into twelve chapters across four life eras, so you always know what's next and what's left. And freedom: the print-ready book is yours on day one — we don't hold your own story behind a checkout page.",
  },
  {
    q: "Do I have to be a good writer?",
    a: "No. Most memoirists never type a word — they tap the microphone and talk the way they'd talk to a friend. Your spoken answers become your chapter draft, and every word stays editable forever.",
  },
  {
    q: "How long does a whole memoir take?",
    a: "About five hours of talking, spread however you like. A question takes ten minutes; a chapter, a quiet evening. Small, steady sessions beat heroic ones.",
  },
  {
    q: "Is it private?",
    a: "Completely. Your stories are never sold, never shared, and never used for advertising. There are no ads at all. Export or delete everything at any time.",
  },
  {
    q: "What does it cost?",
    a: "The studio is free — every chapter, every question, voice capture, and a complete typeset PDF of your book. Printed editions are optional: the Keepsake Softcover is $39 and the HEIRLOOM Hardcover is $89, with 10% off two to four copies and 20% off five or more.",
  },
  {
    q: "Can I write it for someone else — a parent, a grandparent?",
    a: "That's one of the most common ways VELLUM is used. Sit beside them, press record, and let them talk. Many families pass the printed draft around and fill the margins together.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="border-t border-line py-28">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal className="text-center">
          <Eyebrow>Everything you&apos;re wondering</Eyebrow>
          <h2 className="display mt-4 text-4xl font-medium md:text-5xl">Questions, answered.</h2>
        </Reveal>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {FAQS.map((f, i) => (
            <div key={f.q}>
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left"
              >
                <span className="display text-lg font-medium">{f.q}</span>
                <ChevronDown
                  className={`size-5 shrink-0 text-bronze transition-transform duration-300 ${
                    open === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <motion.div
                initial={false}
                animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }}
                transition={{ duration: 0.4, ease }}
                className="overflow-hidden"
              >
                <p className="pb-6 pr-10 text-[0.92rem] leading-relaxed text-ink-soft">{f.a}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- CTA + footer ---------------- */
function FinalCta() {
  return (
    <section className="grain relative overflow-hidden bg-ink py-28 text-center text-paper">
      <div className="relative mx-auto max-w-3xl px-5">
        <Reveal>
          <p className="smallcaps text-[0.7rem] font-semibold text-[#c9a15c]">Begin tonight</p>
          <h2 className="display mt-5 text-5xl font-medium leading-tight md:text-6xl">
            Someday is not <span className="display-wonk italic text-[#c9a15c]">a day of the week.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl leading-relaxed text-paper/70">
            Everyone means to write it all down. Start with one question tonight — the one about
            the kitchen, or the coat, or the day you left — and see your life take shape.
          </p>
          <Link
            href="/app"
            className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-[#c9a15c] px-8 py-4 text-sm font-semibold text-ink transition hover:bg-[#dcb87e]"
          >
            Start your memoir free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="mt-5 text-xs text-paper/50">Free forever · your stories stay yours</p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-paper/10 bg-ink px-5 py-10 text-paper/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-[0.78rem] sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-paper/10">
            <BookOpen className="size-3.5" />
          </span>
          <span className="display text-base font-semibold text-paper/80">VELLUM</span>
          <span>— a private memoir studio</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how" className="transition hover:text-paper">How it works</a>
          <a href="#pricing" className="transition hover:text-paper">Pricing</a>
          <Link href="/app" className="transition hover:text-paper">Studio</Link>
        </div>
        <p>© {new Date().getFullYear()} VELLUM. Your stories are yours.</p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <main>
      <Nav />
      <Hero />
      <Marquee />
      <Features />
      <Sample />
      <Steps />
      <BookSection />
      <Pricing />
      <Testimonials />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}
