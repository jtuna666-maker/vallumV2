import "server-only";
import type PDFDocument from "pdfkit";

export type Doc = InstanceType<typeof PDFDocument>;

/** 72pt = 1in. Trim size 6×9 — the standard memoir format. */
export const PT = 72;
export const TRIM_W = 6 * PT;
export const TRIM_H = 9 * PT;

export const SERIF = "Times-Roman";
export const SERIF_ITALIC = "Times-Italic";
export const SERIF_BOLD = "Times-Bold";

/** Muted palette — the footer must never compete with the memoir text. */
export const INK = "#221b12";
export const INK_SOFT = "#5a4c3d";
export const MUTED = "#a2957f";
export const RULE = "#d8cbb2";
export const CREAM = "#fbf7ee";

export const FOOTER_TEXT =
  "Typeset in VELLUM — Order the heirloom hardcover keepsake at vellum.com";

export type Margins = {
  top: number;
  bottom: number;
  inner: number;
  outer: number;
};

/** Simple = free digital export. Fine = paid, hand-tuned book typesetting. */
export const PROFILES = {
  simple: {
    margins: { top: 0.75 * PT, bottom: 0.85 * PT, inner: 0.75 * PT, outer: 0.75 * PT },
    bodySize: 11,
    leading: 1.28,
    paragraphIndent: 0,
    paragraphGap: 7,
    dropCaps: false,
    justify: false,
    runningHeads: false,
    creamStock: false,
    footer: true,
  },
  fine: {
    // Asymmetric margins: extra gutter so text never dives into the binding.
    margins: { top: 0.8 * PT, bottom: 0.95 * PT, inner: 0.95 * PT, outer: 0.65 * PT },
    bodySize: 11.5,
    leading: 1.44,
    paragraphIndent: 16,
    paragraphGap: 0,
    dropCaps: true,
    justify: true,
    runningHeads: true,
    creamStock: true,
    footer: false,
  },
} as const;

export type ProfileName = keyof typeof PROFILES;
export type Profile = (typeof PROFILES)[ProfileName];

/** Left margin for a page, respecting the binding gutter on verso/recto. */
export function pageLeft(profile: Profile, pageIndex: number): number {
  const recto = pageIndex % 2 === 0; // 0-based: even = right-hand page
  return recto ? profile.margins.inner : profile.margins.outer;
}

export function pageTextWidth(profile: Profile): number {
  return TRIM_W - profile.margins.inner - profile.margins.outer;
}

/**
 * Greedy line breaker with a per-line width callback, so a paragraph can
 * flow around a drop cap (narrow first lines, full width afterwards).
 */
export function wrapText(
  doc: Doc,
  text: string,
  widthFor: (lineIndex: number) => number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let line = 0;

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (!current || doc.widthOfString(trial) <= widthFor(line)) {
      current = trial;
    } else {
      lines.push(current);
      line += 1;
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draws one line with words spread to fill the measure exactly.
 * Skipped for the final line of a paragraph (which stays ragged-right).
 */
export function drawJustifiedLine(
  doc: Doc,
  line: string,
  x: number,
  y: number,
  width: number
): void {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    doc.text(line, x, y, { lineBreak: false });
    return;
  }
  const wordsWidth = words.reduce((sum, w) => sum + doc.widthOfString(w), 0);
  const gap = (width - wordsWidth) / (words.length - 1);
  // Guard against pathological stretching on very short lines.
  if (gap > doc.widthOfString(" ") * 4) {
    doc.text(line, x, y, { lineBreak: false });
    return;
  }
  let cursor = x;
  for (const word of words) {
    doc.text(word, cursor, y, { lineBreak: false });
    cursor += doc.widthOfString(word) + gap;
  }
}

/**
 * The free-tier footer: a hairline rule and one muted line of small caps.
 * Deliberately low-contrast (#a2957f at 7pt) so it reads as a colophon
 * rather than a nag, and never competes with the memoir above it.
 */
export function drawFooter(doc: Doc, profile: Profile, pageIndex: number): void {
  const left = pageLeft(profile, pageIndex);
  const width = pageTextWidth(profile);
  const y = TRIM_H - profile.margins.bottom + 24;

  // Drawing below the bottom margin would make pdfkit paginate; drop the
  // margin for the duration of the stamp, then restore it.
  const keep = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc
    .strokeColor(RULE)
    .lineWidth(0.4)
    .opacity(0.7)
    .moveTo(left + width * 0.28, y - 9)
    .lineTo(left + width * 0.72, y - 9)
    .stroke();
  doc.opacity(1);

  doc.font(SERIF_ITALIC).fontSize(7).fillColor(MUTED);
  doc.text(FOOTER_TEXT, left, y, {
    width,
    align: "center",
    lineBreak: false,
  });
  doc.restore();
  doc.page.margins.bottom = keep;
}

export function drawPageNumber(
  doc: Doc,
  profile: Profile,
  pageIndex: number,
  folio: number
): void {
  const left = pageLeft(profile, pageIndex);
  const width = pageTextWidth(profile);
  const keep = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.font(SERIF).fontSize(9).fillColor(INK_SOFT);
  doc.text(String(folio), left, TRIM_H - profile.margins.bottom + 22, {
    width,
    align: "center",
    lineBreak: false,
  });
  doc.restore();
  doc.page.margins.bottom = keep;
}

export function drawRunningHead(
  doc: Doc,
  profile: Profile,
  pageIndex: number,
  text: string
): void {
  const left = pageLeft(profile, pageIndex);
  const width = pageTextWidth(profile);
  doc.save();
  doc.font(SERIF).fontSize(8).fillColor(MUTED);
  doc.text(text.toUpperCase(), left, profile.margins.top - 26, {
    width,
    align: "center",
    characterSpacing: 1.4,
    lineBreak: false,
  });
  doc.restore();
}

/** Centered ornamental break: ── ✦ ── */
export function drawOrnament(doc: Doc, centerX: number, y: number): void {
  doc.save();
  doc.strokeColor(RULE).lineWidth(0.6);
  doc.moveTo(centerX - 34, y).lineTo(centerX - 12, y).stroke();
  doc.moveTo(centerX + 12, y).lineTo(centerX + 34, y).stroke();
  doc.font(SERIF).fontSize(8).fillColor(MUTED);
  doc.text("✦", centerX - 10, y - 5, { width: 20, align: "center", lineBreak: false });
  doc.restore();
}

export function paintStock(doc: Doc, profile: Profile): void {
  if (!profile.creamStock) return;
  doc.save();
  doc.rect(0, 0, TRIM_W, TRIM_H).fill(CREAM);
  doc.restore();
}

/** Split raw chapter text into clean paragraphs. */
export function paragraphsOf(raw: string): string[] {
  return raw
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Fetch a remote chapter photo for embedding; null on any failure. */
export async function fetchImage(url: string): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/image\/(jpe?g|png)/i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // pdfkit chokes on absurdly large payloads; 12MB is plenty for 6×9.
    return buf.byteLength > 12_000_000 ? null : buf;
  } catch {
    return null;
  }
}
