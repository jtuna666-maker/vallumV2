/**
 * VELLUM pricing — editions, bulk discounts, and profit-safe floors.
 *
 * Pure module (no server-only import) so the checkout UI and the Stripe
 * session builder compute identical numbers from one source of truth.
 *
 * ── Strategy ────────────────────────────────────────────────────────────
 * Three editions rather than two, deliberately:
 *
 *  1. DIGITAL ($0)      The funnel. A real, readable PDF with an elegant
 *                       typeset footer that markets the heirloom edition on
 *                       every page. Costs us nothing, earns brand surface.
 *  2. SOFTCOVER ($39)   The bridge — and a price anchor. Its presence makes
 *                       $89 read as "premium" instead of "expensive"
 *                       (classic compromise effect), and it converts the
 *                       price-sensitive buyer who would otherwise buy
 *                       nothing. It is also the natural volume item: six
 *                       paperbacks for the grandchildren beats one hardcover
 *                       nobody is allowed to touch.
 *  3. HEIRLOOM ($89)    The hero. Cloth spine, dust jacket, drop caps,
 *                       archival cream stock, hand-tuned margins.
 *
 * ── Why bulk discounts stay profitable ──────────────────────────────────
 * Print-on-demand unit economics IMPROVE with quantity: the interior is
 * imposed once, copies ship in a single consolidated carton, and per-unit
 * carrier cost falls sharply after the first book. A 20% discount on copy
 * five is cheaper for us to serve than copy one at full price.
 *
 * Every quote is still clamped by `floorCents` — a hard per-unit price that
 * preserves a healthy multiple over landed POD cost. If a discount would
 * ever breach the floor (bad config, future price change), the floor wins.
 */

export type EditionId = "digital" | "softcover" | "heirloom";

export type Edition = {
  id: EditionId;
  name: string;
  tagline: string;
  /** List price per copy, in cents. */
  priceCents: number;
  /** Estimated landed print-on-demand cost per copy (print + freight). */
  baseCostCents: number;
  /** Hard minimum per-unit price after any discount. */
  floorCents: number;
  /** Can this edition be ordered in multiples? */
  physical: boolean;
  features: string[];
  /** Typesetting profile used by the PDF engine. */
  typeset: "simple" | "fine";
};

export const EDITIONS: Record<EditionId, Edition> = {
  digital: {
    id: "digital",
    name: "Standard Digital PDF",
    tagline: "Your whole book, free, forever.",
    priceCents: 0,
    baseCostCents: 0,
    floorCents: 0,
    physical: false,
    typeset: "simple",
    features: [
      "Every chapter, single-spaced and clean",
      "Print at home or read on any device",
      "Chapter titles, photos and captions",
      "Discreet VELLUM footer on each page",
      "Unlimited re-downloads as you write",
    ],
  },
  softcover: {
    id: "softcover",
    name: "Keepsake Softcover",
    tagline: "The one you hand around the table.",
    priceCents: 3900,
    // ~$8 print + ~$5 freight on a 6×9 B&W paperback
    baseCostCents: 1300,
    floorCents: 1950,
    physical: true,
    typeset: "fine",
    features: [
      "Professional book typesetting",
      "Drop caps and tuned margins",
      "Matte laminate cover, cream paper",
      "No watermark, no footer",
      "Perfect for extra family copies",
    ],
  },
  heirloom: {
    id: "heirloom",
    name: "HEIRLOOM Hardcover",
    tagline: "The one that outlives you.",
    priceCents: 8900,
    // ~$22 print + ~$7 freight on a 6×9 cloth-bound case wrap
    baseCostCents: 2900,
    floorCents: 4350,
    physical: true,
    typeset: "fine",
    features: [
      "Cloth-bound spine, name in gold",
      "Custom spine width calculated to your page count",
      "Printed dust jacket with your dedication",
      "Drop caps, era title pages, hand-tuned margins",
      "Heavy cream archival paper (60# / 400 PPI)",
      "Sewn-in ribbon marker",
    ],
  },
};

export const EDITION_ORDER: EditionId[] = ["digital", "softcover", "heirloom"];

/** Volume breaks. Ordered from smallest minimum quantity upward. */
export const BULK_BREAKS = [
  { min: 1, max: 1, rate: 0, label: "Single copy", note: "" },
  {
    min: 2,
    max: 4,
    rate: 0.1,
    label: "Family set",
    note: "10% off every copy — for couples and siblings.",
  },
  {
    min: 5,
    max: Infinity,
    rate: 0.2,
    label: "The Grandkids Stack",
    note: "20% off every copy — one for each branch of the family.",
  },
] as const;

export type BulkBreak = (typeof BULK_BREAKS)[number];

export function breakForQuantity(quantity: number): BulkBreak {
  const q = Math.max(1, Math.floor(quantity));
  return (
    BULK_BREAKS.find((b) => q >= b.min && q <= b.max) ?? BULK_BREAKS[0]
  );
}

export type Quote = {
  editionId: EditionId;
  quantity: number;
  /** Undiscounted list price per copy. */
  listUnitCents: number;
  /** Final price per copy after discount and floor clamp. */
  unitCents: number;
  /** quantity × unitCents. */
  subtotalCents: number;
  /** Money saved versus list, in cents. */
  savingsCents: number;
  /** Discount actually applied (may be below the nominal rate if clamped). */
  effectiveRate: number;
  /** Nominal rate from the volume break. */
  nominalRate: number;
  /** True when the profit floor reduced the discount. */
  floorApplied: boolean;
  break: BulkBreak;
  /** Estimated gross margin across the whole order, in cents. */
  marginCents: number;
};

export function quote(editionId: EditionId, quantityInput: number): Quote {
  const edition = EDITIONS[editionId];
  const quantity = edition.physical
    ? Math.min(500, Math.max(1, Math.floor(quantityInput) || 1))
    : 1;

  const brk = breakForQuantity(quantity);
  const listUnitCents = edition.priceCents;

  const discounted = Math.round(listUnitCents * (1 - brk.rate));
  // Profit-safe clamp: never sell below the edition's floor.
  const unitCents = Math.max(discounted, edition.floorCents);
  const floorApplied = unitCents > discounted;

  const subtotalCents = unitCents * quantity;
  const savingsCents = listUnitCents * quantity - subtotalCents;
  const effectiveRate =
    listUnitCents > 0 ? 1 - unitCents / listUnitCents : 0;
  const marginCents = subtotalCents - edition.baseCostCents * quantity;

  return {
    editionId,
    quantity,
    listUnitCents,
    unitCents,
    subtotalCents,
    savingsCents,
    effectiveRate,
    nominalRate: brk.rate,
    floorApplied,
    break: brk,
    marginCents,
  };
}

/** The next volume break, for nudging ("add 1 more to save 20%"). */
export function nextBreak(quantity: number): BulkBreak | null {
  const q = Math.max(1, Math.floor(quantity));
  return BULK_BREAKS.find((b) => b.min > q) ?? null;
}

export function formatUsd(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function isEditionId(v: string): v is EditionId {
  return v === "digital" || v === "softcover" || v === "heirloom";
}
