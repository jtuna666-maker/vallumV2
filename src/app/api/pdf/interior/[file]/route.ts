import { NextResponse } from "next/server";
import { renderInterior } from "@/lib/pdf/interior";
import { idFromFile, loadBook, mayRenderPdf } from "@/lib/pdf/source";
import { EDITIONS, isEditionId } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ file: string }> };

/**
 * GET /api/pdf/interior/<projectId>.pdf?edition=digital|softcover|heirloom
 *
 * `digital` is the free export: simple single-spaced typesetting with the
 * VELLUM footer on every page. Paid editions get fine typesetting and no
 * footer. Also serves the print vendor when `?k=<printKey>` is supplied.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { file } = await ctx.params;
  const projectId = idFromFile(file);
  if (!projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("k");
  if (!(await mayRenderPdf(projectId, key))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const editionParam = url.searchParams.get("edition") ?? "digital";
  const editionId = isEditionId(editionParam) ? editionParam : "digital";
  const edition = EDITIONS[editionId];

  const book = await loadBook(projectId);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { buffer } = await renderInterior(
    {
      project: book.project,
      chapters: book.chapters,
      editionLabel: edition.name,
    },
    {
      profile: edition.typeset,
      writtenOnly: url.searchParams.get("all") !== "1",
    }
  );

  const safeTitle =
    book.project.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "memoir";
  const disposition = url.searchParams.get("dl") === "1" ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeTitle}-${editionId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
