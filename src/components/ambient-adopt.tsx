"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * On first studio load, silently adopts the ambient demo household session
 * (the showcase account that owns the seeded memoirs) — only when ambient
 * mode is enabled and the visitor has no session and hasn't signed out.
 * Renders nothing.
 */
export default function AmbientAdopt() {
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/auth/ambient", { method: "POST" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; already?: boolean }) => {
        if (d?.ok && !d?.already) router.refresh();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
