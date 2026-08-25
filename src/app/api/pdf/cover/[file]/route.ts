import { NextResponse } from "next/server";
import { renderInterior } from "@/lib/pdf/interior";
import { renderCover } from "@/lib/pdf/cover";
import { idFromFile, loadBook, mayRenderPdf } from "@/lib/pdf/source";
import { EDITIONS, isEditionId } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ file: string }> };

/**
 * GET /api/pdf/cover/<projectId>.pdf?edition=heirloom|softcover
 *
 * Renders the full print wrap. The interior is typeset first purely to get an
 * exact page count, which drives the cloth spine width.
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

  const editionParam = url.searchParams.get("edition") ?? "heirloom";
  const editionId = isEditionId(editionParam) ? editionParam : "heirloom";
  const edition = EDITIONS[editionId];

  const book = await loadBook(projectId);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { pages } = await renderInterior(
    {
      project: book.project,
      chapters: book.chapters,
      editionLabel: edition.name,
    },
    { profile: edition.typeset, writtenOnly: true }
  );

  const buffer = await renderCover({
    project: book.project,
    pageCount: pages,
    binding: editionId === "softcover" ? "softcover" : "hardcover",
  });

  const safeTitle =
    book.project.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "memoir";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeTitle}-cover.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
