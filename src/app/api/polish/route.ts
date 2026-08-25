import { NextResponse } from "next/server";
import { z } from "zod";
import { polishText } from "@/lib/polish";

export const maxDuration = 60;

const schema = z.object({
  text: z.string().min(1).max(50_000),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }
  const polished = await polishText(parsed.data.text);
  return NextResponse.json({ polished });
}
