"use client";

import { useEffect, useState } from "react";
import { BookMarked, Check, Download } from "lucide-react";
import EditionPicker from "@/components/edition-picker";
import { EDITIONS, formatUsd } from "@/lib/pricing";

type Order = {
  status: string;
  edition?: string | null;
  quantity?: number | null;
  amountCents?: number | null;
};

const LABELS: Record<string, string> = {
  reserved: "Reserved",
  paid: "Paid — printing next",
  fulfilled: "Printing & shipping",
};

export default function OrderHardcover({ projectId }: { projectId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void fetch(`/api/hardcover?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { order?: Order | null } | null) => setOrder(d?.order ?? null))
      .catch(() => undefined);
  }, [projectId]);

  const editionName =
    order?.edition && order.edition in EDITIONS
      ? EDITIONS[order.edition as keyof typeof EDITIONS].name
      : "Keepsake";

  return (
    <>
      <a
        href={`/api/pdf/interior/${projectId}.pdf?edition=digital&dl=1`}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-[0.78rem] font-semibold transition hover:border-bronze hover:text-bronze-deep"
      >
        <Download className="size-3.5" />
        Free PDF
      </a>

      {order ? (
        <span
          title={`${editionName}${order.quantity && order.quantity > 1 ? ` × ${order.quantity}` : ""}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-moss/40 bg-moss/10 px-4 py-2.5 text-[0.72rem] font-semibold text-moss"
        >
          <Check className="size-3.5" />
          {LABELS[order.status] ?? order.status}
          {order.quantity && order.quantity > 1 ? ` · ${order.quantity} copies` : ""}
          {order.amountCents ? ` · ${formatUsd(order.amountCents)}` : ""}
        </span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-oxblood px-5 py-2.5 text-[0.78rem] font-semibold text-paper shadow-lift transition hover:bg-bronze-deep"
        >
          <BookMarked className="size-3.5" />
          Order a printed edition
        </button>
      )}

      {open && <EditionPicker projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}
