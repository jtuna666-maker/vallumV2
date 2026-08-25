"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export default function ShareButton({
  title,
  text,
  shareToken = "",
}: {
  title: string;
  text: string;
  shareToken?: string;
}) {
  const [done, setDone] = useState(false);

  async function share() {
    const url = shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* cancelled or failed — fall back to copying the link */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2200);
    } catch {
      /* clipboard denied */
    }
  }

  return (
    <button
      onClick={share}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-[0.78rem] font-semibold transition hover:border-bronze hover:text-bronze-deep"
    >
      {done ? <Check className="size-3.5 text-moss" /> : <Share2 className="size-3.5" />}
      {done ? "Link copied" : "Share"}
    </button>
  );
}
