import type { ReactNode } from "react";
import { ensureBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Layout-level bootstrap: runs for every studio route, not just /app. */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  await ensureBootstrap();
  return <>{children}</>;
}
