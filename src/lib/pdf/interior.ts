import "server-only";
import PDFDocument from "pdfkit";
import type { Chapter, Project } from "@/db/schema";
import {
  CREAM,
  Doc,
  INK,
  INK_SOFT,
  MUTED,
  PROFILES,
  PT,
  RULE,
  SERIF,
  SERIF_BOLD,
  SERIF_ITALIC,
  TRIM_H,
  TRIM_W,
  drawFooter,
  drawJustifiedLine,
  drawOrnament,
  drawPageNumber,
  drawRunningHead,
  fetchImage,
  pageLeft,
  pageTextWidth,
  paintStock,
  paragraphsOf,
  wrapText,
  type Profile,
  type ProfileName,
} from "@/lib/pdf/typeset";

export type InteriorOptions = {
  profile: ProfileName;
  /** Include only chapters that have prose. */
  writtenOnly?: boolean;
};

const ERA_LINES: Record<string, string> = {
  Roots: "Everything before the leaving.",
  Becoming: "The years of choosing.",
  "Turning Points": "The days that decided everything.",
  Legacy: "What remains, on purpose.",
};

const PART_WORDS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];

/** Body text for a chapter: the manuscript, or its answers as a fallback. */
export function chapterProse(ch: Chapter & { answers?: string[] }): string {
  const manuscript = ch.content.trim();
  if (manuscript) return manuscript;
  return (ch.answers ?? []).filter(Boolean).join("\n\n").trim();
}

type Ctx = {
  doc: Doc;
  profile: Profile;
  pageIndex: number;
  folio: number;
  runningHead: string;
};

function newPage(ctx: Ctx, opts?: { blankRunningHead?: boolean }): void {
  ctx.doc.addPage();
  ctx.pageIndex += 1;
  ctx.folio += 1;
  paintStock(ctx.doc, ctx.profile);
  // Footers and folios are stamped in a final pass over every buffered page
  // (see stampEveryPage) so that pages pdfkit creates implicitly — when a
  // block of text overflows — are never missed.
  if (ctx.profile.runningHeads && !opts?.blankRunningHead && ctx.runningHead) {
    drawRunningHead(ctx.doc, ctx.profile, ctx.pageIndex, ctx.runningHead);
  }
}

/**
 * Stamps the VELLUM footer (free edition) and folios onto every page in the
 * buffer — including any pdfkit created on its own.
 */
function stampEveryPage(doc: Doc, profile: Profile): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (profile.footer) drawFooter(doc, profile, i);
    // Folios on body pages only; the title page stays clean.
    if (profile.runningHeads && i > 0) {
      drawPageNumber(doc, profile, i, i + 1);
    }
  }
}

/**
 * Renders one paragraph, optionally with a three-line drop cap, and paginates
 * as needed. Returns the y cursor after the paragraph.
 */
function renderParagraph(
  ctx: Ctx,
  text: string,
  y: number,
  opts: { dropCap: boolean; indent: boolean }
): number {
  const { doc, profile } = ctx;
  const measure = pageTextWidth(profile);
  const lineHeight = profile.bodySize * profile.leading;
  const bottomLimit = TRIM_H - profile.margins.bottom;

  doc.font(SERIF).fontSize(profile.bodySize).fillColor(INK);

  let capChar = "";
  let capWidth = 0;
  let capLines = 0;
  const capGap = 5;

  if (opts.dropCap && text.length > 1) {
    capChar = text[0];
    capLines = 3;
    doc.font(SERIF_BOLD).fontSize(profile.bodySize * 3.1);
    capWidth = doc.widthOfString(capChar) + capGap;
    doc.font(SERIF).fontSize(profile.bodySize);
  }

  const body = capChar ? text.slice(1) : text;
  const firstIndent = !capChar && opts.indent ? profile.paragraphIndent : 0;

  const widthFor = (i: number) => {
    let w = measure;
    if (capChar && i < capLines) w -= capWidth;
    if (i === 0) w -= firstIndent;
    return w;
  };

  const lines = wrapText(doc, body, widthFor);

  let cursor = y;
  let capDrawn = false;

  for (let i = 0; i < lines.length; i++) {
    if (cursor + lineHeight > bottomLimit) {
      newPage(ctx);
      cursor = profile.margins.top;
    }

    const left = pageLeft(profile, ctx.pageIndex);
    let x = left;
    let w = measure;

    if (capChar && i < capLines) {
      x += capWidth;
      w -= capWidth;
    }
    if (i === 0 && firstIndent) {
      x += firstIndent;
      w -= firstIndent;
    }

    // Draw the drop cap once, aligned to the first line's baseline block.
    if (capChar && !capDrawn) {
      doc.save();
      doc
        .font(SERIF_BOLD)
        .fontSize(profile.bodySize * 3.1)
        .fillColor("#7c4d19");
      doc.text(capChar, left, cursor - 2, { lineBreak: false });
      doc.restore();
      doc.font(SERIF).fontSize(profile.bodySize).fillColor(INK);
      capDrawn = true;
    }

    const isLast = i === lines.length - 1;
    if (profile.justify && !isLast) {
      drawJustifiedLine(doc, lines[i], x, cursor, w);
    } else {
      doc.text(lines[i], x, cursor, { lineBreak: false });
    }
    cursor += lineHeight;
  }

  return cursor + profile.paragraphGap;
}

function titlePage(ctx: Ctx, project: Project, editionLabel: string): void {
  const { doc, profile } = ctx;
  const left = pageLeft(profile, ctx.pageIndex);
  const width = pageTextWidth(profile);
  const centerX = left + width / 2;

  doc.font(SERIF).fontSize(9).fillColor(MUTED);
  doc.text("A MEMOIR", left, TRIM_H * 0.2, {
    width,
    align: "center",
    characterSpacing: 3,
  });

  doc.font(SERIF_BOLD).fontSize(30).fillColor(INK);
  doc.text(project.title, left, TRIM_H * 0.3, { width, align: "center" });

  drawOrnament(doc, centerX, TRIM_H * 0.43);

  doc.font(SERIF_ITALIC).fontSize(14).fillColor(INK_SOFT);
  doc.text(`as told by ${project.authorName}`, left, TRIM_H * 0.47, {
    width,
    align: "center",
  });

  if (project.dedication) {
    doc.font(SERIF_ITALIC).fontSize(11).fillColor(INK_SOFT);
    doc.text(project.dedication, left + width * 0.15, TRIM_H * 0.68, {
      width: width * 0.7,
      align: "center",
    });
  }

  doc.font(SERIF).fontSize(8).fillColor(MUTED);
  doc.text(editionLabel.toUpperCase(), left, TRIM_H - profile.margins.bottom - 14, {
    width,
    align: "center",
    characterSpacing: 2,
  });
}

function eraPage(ctx: Ctx, era: string, partIndex: number): void {
  const { doc, profile } = ctx;
  newPage(ctx, { blankRunningHead: true });
  const left = pageLeft(profile, ctx.pageIndex);
  const width = pageTextWidth(profile);
  const centerX = left + width / 2;

  doc.font(SERIF).fontSize(9).fillColor(MUTED);
  doc.text(`PART ${(PART_WORDS[partIndex] ?? String(partIndex + 1)).toUpperCase()}`, left, TRIM_H * 0.36, {
    width,
    align: "center",
    characterSpacing: 2.5,
  });

  doc.font(SERIF_BOLD).fontSize(26).fillColor(INK);
  doc.text(era, left, TRIM_H * 0.42, { width, align: "center" });

  const line = ERA_LINES[era];
  if (line) {
    doc.font(SERIF_ITALIC).fontSize(12).fillColor(INK_SOFT);
    doc.text(line, left, TRIM_H * 0.5, { width, align: "center" });
  }
  drawOrnament(doc, centerX, TRIM_H * 0.58);
}

async function chapterPages(
  ctx: Ctx,
  ch: Chapter & { answers?: string[] },
  number: number,
  prose: string
): Promise<void> {
  const { doc, profile } = ctx;
  ctx.runningHead = ch.title;
  newPage(ctx, { blankRunningHead: true });

  const left = pageLeft(profile, ctx.pageIndex);
  const width = pageTextWidth(profile);
  const centerX = left + width / 2;

  // Chapter opener sits a third of the way down — a classic book drop.
  let y = profile.margins.top + TRIM_H * 0.1;

  doc.font(SERIF).fontSize(9).fillColor(MUTED);
  doc.text(`CHAPTER ${number}`, left, y, {
    width,
    align: "center",
    characterSpacing: 2.5,
  });
  y += 24;

  doc.font(SERIF_BOLD).fontSize(19).fillColor(INK);
  doc.text(ch.title, left, y, { width, align: "center" });
  y += doc.heightOfString(ch.title, { width, align: "center" }) + 6;

  if (ch.subtitle) {
    doc.font(SERIF_ITALIC).fontSize(10.5).fillColor(MUTED);
    doc.text(ch.subtitle, left, y, { width, align: "center" });
    y += 20;
  }

  drawOrnament(doc, centerX, y + 8);
  y += 30;

  // Chapter photograph, if the author added one.
  if (ch.imageUrl) {
    const img = await fetchImage(ch.imageUrl);
    if (img) {
      try {
        const maxW = width * 0.82;
        const maxH = TRIM_H * 0.3;
        doc.image(img, left + (width - maxW) / 2, y, {
          fit: [maxW, maxH],
          align: "center",
        });
        y += maxH + 10;
        if (ch.imageCaption) {
          doc.font(SERIF_ITALIC).fontSize(9).fillColor(MUTED);
          doc.text(ch.imageCaption, left, y, { width, align: "center" });
          y += doc.heightOfString(ch.imageCaption, { width }) + 12;
        }
      } catch {
        /* unreadable image — continue without it */
      }
    }
  }

  const paras = paragraphsOf(prose);
  if (paras.length === 0) {
    doc.font(SERIF_ITALIC).fontSize(11).fillColor(MUTED);
    doc.text("This chapter is still being gathered.", left, y + 20, {
      width,
      align: "center",
    });
    return;
  }

  for (let i = 0; i < paras.length; i++) {
    y = renderParagraph(ctx, paras[i], y, {
      dropCap: profile.dropCaps && i === 0,
      indent: i > 0,
    });
  }
}

function colophon(ctx: Ctx, project: Project, words: number, editionLabel: string): void {
  const { doc, profile } = ctx;
  ctx.runningHead = "";
  newPage(ctx, { blankRunningHead: true });
  const left = pageLeft(profile, ctx.pageIndex);
  const width = pageTextWidth(profile);
  const centerX = left + width / 2;

  drawOrnament(doc, centerX, TRIM_H * 0.42);

  doc.font(SERIF_ITALIC).fontSize(13).fillColor(INK_SOFT);
  doc.text("Here the book rests — for now.", left, TRIM_H * 0.47, {
    width,
    align: "center",
  });

  doc.font(SERIF).fontSize(9.5).fillColor(MUTED);
  doc.text(
    `Set in Times and typeset by VELLUM. These ${words.toLocaleString()} words belong to ${project.authorName}, forever.`,
    left + width * 0.1,
    TRIM_H * 0.55,
    { width: width * 0.8, align: "center" }
  );

  doc.font(SERIF).fontSize(8).fillColor(MUTED);
  doc.text(editionLabel.toUpperCase(), left, TRIM_H * 0.68, {
    width,
    align: "center",
    characterSpacing: 2,
  });
}

export type InteriorInput = {
  project: Project;
  chapters: (Chapter & { answers?: string[] })[];
  editionLabel: string;
};

export type InteriorResult = {
  buffer: Buffer;
  /** Physical leaf count — feeds the cover's spine calculator. */
  pages: number;
};

/** Builds the interior PDF and resolves to its bytes plus page count. */
export async function renderInterior(
  input: InteriorInput,
  options: InteriorOptions
): Promise<InteriorResult> {
  const profile = PROFILES[options.profile];

  const doc = new PDFDocument({
    size: [TRIM_W, TRIM_H],
    margins: {
      top: profile.margins.top,
      bottom: profile.margins.bottom,
      left: profile.margins.inner,
      right: profile.margins.outer,
    },
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: input.project.title,
      Author: input.project.authorName,
      Creator: "VELLUM",
      Producer: "VELLUM — vellum.com",
      Subject: `${input.editionLabel} — a memoir typeset by VELLUM`,
    },
  }) as Doc;

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const bytes = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const ctx: Ctx = { doc, profile, pageIndex: 0, folio: 1, runningHead: "" };

  paintStock(doc, profile);
  titlePage(ctx, input.project, input.editionLabel);

  const chapters = options.writtenOnly
    ? input.chapters.filter((c) => chapterProse(c).length > 0)
    : input.chapters;

  let words = 0;
  let lastEra = "";
  let partIndex = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const prose = chapterProse(ch);
    words += prose.split(/\s+/).filter(Boolean).length;

    if (profile.runningHeads && ch.era && ch.era !== lastEra) {
      eraPage(ctx, ch.era, partIndex);
      partIndex += 1;
      lastEra = ch.era;
    }
    await chapterPages(ctx, ch, i + 1, prose);
  }

  colophon(ctx, input.project, words, input.editionLabel);
  stampEveryPage(doc, profile);

  const pages = doc.bufferedPageRange().count;
  doc.end();
  return { buffer: await bytes, pages };
}
