import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureDatabaseSchema } from "@/db/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // The preview DB volume may be recreated between app starts. Health is
    // only true after the full schema exists—not merely after SELECT 1.
    await ensureDatabaseSchema();
    await db.execute(sql`select 1 from users limit 1`);
    return Response.json({ ok: true, database: "ready" });
  } catch (error) {
    console.error("[vellum] health bootstrap failed:", error);
    return Response.json({ ok: false, database: "unavailable" }, { status: 500 });
  }
}
