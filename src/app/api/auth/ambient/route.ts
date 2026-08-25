import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adoptAmbient } from "@/lib/bootstrap";
import { sessionUser } from "@/lib/auth";

/**
 * Opt-in adoption of the ambient demo household. Enabled by default on this
 * deployment (disable with VELLUM_AMBIENT=0); skipped if the visitor already
 * signed in or deliberately signed out.
 */
export async function POST() {
  if (process.env.VELLUM_AMBIENT === "0") {
    return NextResponse.json({ ok: false, reason: "disabled" }, { status: 403 });
  }
  const existing = await sessionUser();
  if (existing) {
    return NextResponse.json({ ok: true, already: true });
  }
  const cookieStore = await cookies();
  if (cookieStore.get("vellum_signed_out")) {
    return NextResponse.json({ ok: false, reason: "signed_out" });
  }
  await adoptAmbient();
  return NextResponse.json({ ok: true });
}
