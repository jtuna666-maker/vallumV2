"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Check,
  Download,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  BULK_BREAKS,
  EDITIONS,
  EDITION_ORDER,
  formatUsd,
  nextBreak,
  quote,
  type EditionId,
} from "@/lib/pricing";

type Props = {
  projectId: string;
  onClose: () => void;
};

export default function EditionPicker({ projectId, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<EditionId>("heirloom");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edition = EDITIONS[selected];
  const q = useMemo(() => quote(selected, qty), [selected, qty]);
  const upcoming = useMemo(() => (edition.physical ? nextBreak(qty) : null), [qty, edition]);

  function bump(delta: number) {
    setQty((n) => Math.min(500, Math.max(1, n + delta)));
  }

  async function submit() {
    if (busy) return;
    setError(null);

    if (selected === "digital") {
      window.open(
        `/api/pdf/interior/${projectId}.pdf?edition=digital&dl=1`,
        "_blank",
        "noopener"
      );
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/hardcover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, edition: selected, quantity: qty }),
      });
      const data = (await res.json()) as {
        url?: string;
        redirect?: string;
        error?: string;
      };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
        return;
      }
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
    } catch {
      setError("Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="nice-scroll max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-vellum p-7 shadow-book sm:p-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="smallcaps text-[0.65rem] font-semibold text-bronze-deep">
              Choose your edition
            </p>
            <h2 className="display mt-2 text-3xl font-medium tracking-tight">
              How should this life be bound?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full p-1.5 text-ink-faint transition hover:bg-paper-deep hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* editions */}
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {EDITION_ORDER.map((id) => {
            const e = EDITIONS[id];
            const active = selected === id;
            const hero = id === "heirloom";
            return (
              <button
                key={id}
                onClick={() => {
                  setSelected(id);
                  // Quantity only applies to printed copies — reset it when a
                  // digital edition is chosen.
                  // Quantity only applies to printed copies — reset it when a
                  // digital edition is chosen.
                  if (!EDITIONS[id].physical) setQty(1);
                }}
                className={`relative flex h-full cursor-pointer flex-col rounded-xl border p-5 text-left transition ${
                  active
                    ? "border-bronze bg-bronze/10 shadow-lift"
                    : "border-line bg-paper/60 hover:border-bronze/50"
                }`}
              >
                {hero && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-ink px-2.5 py-0.5 text-[0.58rem] font-bold tracking-wide text-[#c9a15c]">
                    MOST GIFTED
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <span
                    className={`grid size-4 place-items-center rounded-full border ${
                      active ? "border-bronze bg-bronze text-paper" : "border-ink/25"
                    }`}
                  >
                    {active && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className="display text-[0.95rem] font-semibold leading-tight">
                    {e.name}
                  </span>
                </span>

                <span className="display mt-3 text-3xl font-medium">
                  {e.priceCents === 0 ? "Free" : formatUsd(e.priceCents)}
                  {e.physical && (
                    <span className="text-xs font-normal text-ink-faint"> /copy</span>
                  )}
                </span>
                <span className="mt-1 text-[0.72rem] italic text-ink-soft">{e.tagline}</span>

                <ul className="mt-4 space-y-1.5">
                  {e.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[0.72rem] leading-snug text-ink-soft">
                      <Check className="mt-0.5 size-3 shrink-0 text-bronze" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* quantity + bulk calculator */}
        {edition.physical ? (
          <div className="mt-7 rounded-xl border border-line bg-paper/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <p className="smallcaps text-[0.62rem] font-bold text-ink-faint">
                  How many copies?
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    onClick={() => bump(-1)}
                    disabled={qty <= 1}
                    className="grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-vellum transition hover:border-bronze disabled:opacity-40"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.min(500, Math.max(1, Number(e.target.value) || 1)))
                    }
                    className="field w-20 text-center text-lg font-semibold"
                  />
                  <button
                    onClick={() => bump(1)}
                    className="grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-vellum transition hover:border-bronze"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <div className="ml-1 flex gap-1.5">
                    {[2, 5, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setQty(n);
                        }}
                        className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-[0.65rem] font-semibold text-ink-soft transition hover:border-bronze hover:text-bronze-deep"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-right">
                {q.effectiveRate > 0 && (
                  <p className="text-[0.7rem] font-semibold text-moss">
                    {Math.round(q.effectiveRate * 100)}% off · {q.break.label}
                  </p>
                )}
                <p className="display text-4xl font-medium leading-none">
                  {formatUsd(q.subtotalCents)}
                </p>
                <p className="mt-1.5 text-[0.7rem] text-ink-faint">
                  {q.quantity} × {formatUsd(q.unitCents)}
                  {q.savingsCents > 0 && (
                    <>
                      {" "}
                      · <span className="text-moss">save {formatUsd(q.savingsCents)}</span>
                    </>
                  )}
                </p>
                {q.savingsCents > 0 && (
                  <p className="text-[0.68rem] text-ink-faint line-through">
                    {formatUsd(q.listUnitCents * q.quantity)}
                  </p>
                )}
              </div>
            </div>

            {/* volume ladder */}
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {BULK_BREAKS.map((b) => {
                const on = q.break.min === b.min;
                return (
                  <div
                    key={b.min}
                    className={`rounded-lg border px-3.5 py-2.5 transition ${
                      on ? "border-bronze bg-bronze/10" : "border-line bg-vellum/60"
                    }`}
                  >
                    <p
                      className={`text-[0.68rem] font-bold ${
                        on ? "text-bronze-deep" : "text-ink-soft"
                      }`}
                    >
                      {b.max === Infinity ? `${b.min}+ copies` : b.min === b.max ? "1 copy" : `${b.min}–${b.max} copies`}
                    </p>
                    <p className="text-[0.66rem] text-ink-faint">
                      {b.rate === 0 ? "Standard price" : `${Math.round(b.rate * 100)}% off each`}
                      {b.label !== "Single copy" && ` · ${b.label}`}
                    </p>
                  </div>
                );
              })}
            </div>

            {upcoming && (
              <p className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] font-medium text-bronze-deep">
                <Sparkles className="size-3.5" />
                Add {upcoming.min - qty} more{" "}
                {upcoming.min - qty === 1 ? "copy" : "copies"} to unlock{" "}
                {Math.round(upcoming.rate * 100)}% off every copy — {upcoming.label}.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-7 rounded-xl border border-line bg-paper/70 p-6">
            <p className="text-sm leading-relaxed text-ink-soft">
              Your free PDF is typeset instantly and carries a small VELLUM line at the foot of
              each page. Upgrade to a printed edition for fine typesetting with no footer.
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-xs text-oxblood">{error}</p>}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xs text-[0.68rem] leading-relaxed text-ink-faint">
            {edition.physical
              ? "Printed on demand and shipped to your door. Your stories remain yours."
              : "No card, no account upgrade — the download starts immediately."}
          </p>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-oxblood px-7 py-3.5 text-sm font-semibold text-paper shadow-lift transition hover:bg-bronze-deep disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : selected === "digital" ? (
              <Download className="size-4" />
            ) : (
              <BookMarked className="size-4" />
            )}
            {busy
              ? "Opening checkout…"
              : selected === "digital"
                ? "Download the free PDF"
                : `Order ${q.quantity > 1 ? `${q.quantity} copies` : "the book"} — ${formatUsd(q.subtotalCents)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
