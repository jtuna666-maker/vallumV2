"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.78rem] font-semibold text-paper shadow-lift transition hover:bg-bronze-deep"
    >
      <Printer className="size-3.5" />
      Print or save as PDF
    </button>
  );
}
