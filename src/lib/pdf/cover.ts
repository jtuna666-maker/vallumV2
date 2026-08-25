import "server-only";
import PDFDocument from "pdfkit";
import type { Project } from "@/db/schema";
import {
  Doc,
  MUTED,
  PT,
  SERIF,
  SERIF_BOLD,
  SERIF_ITALIC,
  TRIM_H,
  TRIM_W,
} from "@/lib/pdf/typeset";

/**
 * ── Cloth spine calculator ──────────────────────────────────────────────
 * Spine width is a function of the real page count and the paper's caliper
 * (pages-per-inch), plus board thickness for a hardcover case.
 *
 *   softcover spine = pages / PPI
 *   hardcover spine = pages / PPI + 2 × board + hinge allowance
 *
 * 60# cream archival stock runs ~400 PPI. Binder boards are ~0.088" each,
 * with ~0.03" of hinge play on a case wrap.
 */
export const PPI_CREAM_60 = 400;
const BOARD = 0.088;
const HINGE = 0.03;

/** Case wrap needs bleed to fold around the boards. */
const WRAP_HARD = 0.75;
const BLEED_SOFT = 0.125;

export type Binding = "softcover" | "hardcover";

export type SpineSpec = {
  binding: Binding;
  pages: number;
  spineIn: number;
  spinePt: number;
  coverWidthPt: number;
  coverHeightPt: number;
  wrapPt: number;
  /** Too thin to letter a spine legibly (industry rule of thumb: <0.25"). */
  spineTextAllowed: boolean;
};

export function calculateSpine(pageCount: number, binding: Binding): SpineSpec {
  // Printers impose in signatures of 4; never fewer than 32 pages.
  const pages = Math.max(32, Math.ceil(pageCount / 4) * 4);
  const paper = pages / PPI_CREAM_60;
  const spineIn =
    binding === "hardcover" ? paper + 2 * BOARD + HINGE : paper;

  const wrapIn = binding === "hardcover" ? WRAP_HARD : BLEED_SOFT;
  const wrapPt = wrapIn * PT;
  const spinePt = spineIn * PT;

  return {
    binding,
    pages,
    spineIn,
    spinePt,
    // full wrap = back cover + spine + front cover + wrap on both sides
    coverWidthPt: TRIM_W * 2 + spinePt + wrapPt * 2,
    coverHeightPt: TRIM_H + wrapPt * 2,
    wrapPt,
    spineTextAllowed: spineIn >= 0.25,
  };
}

const CLOTH: Record<string, { bg: string; foil: string }> = {
  parchment: { bg: "#6e3a2a", foil: "#d8b06a" },
  ink: { bg: "#1c1a17", foil: "#c9a15c" },
  sage: { bg: "#3d4a35", foil: "#cbb172" },
};

export type CoverInput = {
  project: Project;
  pageCount: number;
  binding: Binding;
  /** Blurb for the back panel (usually the dedication or an excerpt). */
  blurb?: string;
};

/**
 * Full print-ready wrap: back panel, lettered spine, front panel — sized to
 * the calculated spine so the cloth folds exactly where it should.
 */
export function renderCover(input: CoverInput): Promise<Buffer> {
  const spec = calculateSpine(input.pageCount, input.binding);
  const cloth = CLOTH[input.project.theme] ?? CLOTH.parchment;

  const doc = new PDFDocument({
    size: [spec.coverWidthPt, spec.coverHeightPt],
    margin: 0,
    info: {
      Title: `${input.project.title} — cover`,
      Author: input.project.authorName,
      Creator: "VELLUM",
      Producer: "VELLUM — vellum.com",
    },
  }) as Doc;

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const W = spec.coverWidthPt;
  const H = spec.coverHeightPt;
  const wrap = spec.wrapPt;

  // Cloth field across the entire wrap (bleed included).
  doc.rect(0, 0, W, H).fill(cloth.bg);

  const backX = wrap;
  const spineX = wrap + TRIM_W;
  const frontX = wrap + TRIM_W + spec.spinePt;

  /* ── front panel ─────────────────────────────────────────────── */
  const fCenter = frontX + TRIM_W / 2;
  const inset = 0.55 * PT;

  doc
    .rect(frontX + inset, wrap + inset, TRIM_W - inset * 2, TRIM_H - inset * 2)
    .lineWidth(1.1)
    .strokeOpacity(0.55)
    .stroke(cloth.foil);
  doc.strokeOpacity(1);

  doc.font(SERIF).fontSize(9).fillColor(cloth.foil);
  doc.text("A MEMOIR", frontX, wrap + TRIM_H * 0.16, {
    width: TRIM_W,
    align: "center",
    characterSpacing: 3.5,
  });

  doc.font(SERIF_BOLD).fontSize(28).fillColor("#efe6d0");
  doc.text(input.project.title, frontX + 0.5 * PT, wrap + TRIM_H * 0.3, {
    width: TRIM_W - PT,
    align: "center",
  });

  doc
    .moveTo(fCenter - 30, wrap + TRIM_H * 0.52)
    .lineTo(fCenter + 30, wrap + TRIM_H * 0.52)
    .lineWidth(0.8)
    .stroke(cloth.foil);

  doc.font(SERIF_ITALIC).fontSize(13).fillColor(cloth.foil);
  doc.text(input.project.authorName, frontX + 0.5 * PT, wrap + TRIM_H * 0.57, {
    width: TRIM_W - PT,
    align: "center",
  });

  doc.font(SERIF).fontSize(7.5).fillColor("#efe6d0");
  doc.fillOpacity(0.6);
  doc.text("VELLUM PRESS", frontX, wrap + TRIM_H - 0.9 * PT, {
    width: TRIM_W,
    align: "center",
    characterSpacing: 2.5,
  });
  doc.fillOpacity(1);

  /* ── spine ───────────────────────────────────────────────────── */
  if (spec.spineTextAllowed) {
    doc.save();
    // Rotate into the spine: read top-to-bottom on a shelved book.
    doc.rotate(90, { origin: [spineX + spec.spinePt / 2, H / 2] });
    const sw = TRIM_H * 0.8;
    const sx = spineX + spec.spinePt / 2 - sw / 2;
    const sy = H / 2 - 6;

    doc.font(SERIF_BOLD).fontSize(Math.min(12, spec.spinePt * 0.42)).fillColor("#efe6d0");
    doc.text(input.project.title.toUpperCase(), sx, sy - 4, {
      width: sw * 0.62,
      align: "left",
      lineBreak: false,
      characterSpacing: 1.2,
    });

    doc.font(SERIF).fontSize(Math.min(9, spec.spinePt * 0.32)).fillColor(cloth.foil);
    doc.text(input.project.authorName.toUpperCase(), sx + sw * 0.66, sy - 2, {
      width: sw * 0.34,
      align: "right",
      lineBreak: false,
      characterSpacing: 1,
    });
    doc.restore();
  }

  /* ── back panel ──────────────────────────────────────────────── */
  const blurb = (input.blurb || input.project.dedication || "").trim();
  if (blurb) {
    doc.font(SERIF_ITALIC).fontSize(11).fillColor("#efe6d0");
    doc.fillOpacity(0.9);
    doc.text(blurb, backX + PT, wrap + TRIM_H * 0.3, {
      width: TRIM_W - PT * 2,
      align: "center",
      lineGap: 4,
    });
    doc.fillOpacity(1);
  }

  doc
    .moveTo(backX + TRIM_W / 2 - 24, wrap + TRIM_H * 0.62)
    .lineTo(backX + TRIM_W / 2 + 24, wrap + TRIM_H * 0.62)
    .lineWidth(0.7)
    .stroke(cloth.foil);

  doc.font(SERIF).fontSize(8).fillColor(cloth.foil);
  doc.text(
    `Typeset in VELLUM · ${spec.pages} pages · spine ${spec.spineIn.toFixed(3)}"`,
    backX + PT * 0.5,
    wrap + TRIM_H - 1.05 * PT,
    { width: TRIM_W - PT, align: "center" }
  );

  doc.font(SERIF).fontSize(7).fillColor("#efe6d0");
  doc.fillOpacity(0.5);
  doc.text("vellum.com", backX + PT * 0.5, wrap + TRIM_H - 0.72 * PT, {
    width: TRIM_W - PT,
    align: "center",
    characterSpacing: 1.5,
  });
  doc.fillOpacity(1);

  doc.end();
  return done;
}
