import "server-only";

/**
 * Fail-safe guard for the runtime mode boundary.
 *
 * In production the demo "ambient household" account must never be silently
 * active for a multi-user deployment. With ambient on (which is the default:
 * `VELLUM_AMBIENT !== "0"`), every visitor is auto-adopted into the shared
 * `vellum.demo@vellum.local` account and — via `claimOrphans` — can claim
 * owner-less projects. That is a privacy/data-visibility boundary, not a
 * demo nicety.
 *
 * The only two safe production states are:
 *   - Public SaaS  -> VELLUM_AMBIENT="0" (real per-user magic-code sign-in).
 *   - Self-hosted  -> VELLUM_SINGLE_USER="1" (the shared household is the point).
 *
 * Local dev / previews intentionally keep ambient on (see docs/runbook.md
 * "Showcase / sandbox"), so this only fires when NODE_ENV === "production".
 */
export function assertSafeProductionMode(): void {
  if (process.env.NODE_ENV !== "production") return;

  const ambientDisabled = process.env.VELLUM_AMBIENT === "0";
  const singleUser = process.env.VELLUM_SINGLE_USER === "1";
  if (ambientDisabled || singleUser) return;

  throw new Error(
    "Unsafe VELLUM runtime mode for production: the ambient demo household is " +
      "active (VELLUM_AMBIENT is not \"0\") but VELLUM_SINGLE_USER is not \"1\". " +
      "Every visitor would be auto-adopted into the shared demo account and " +
      "could claim owner-less projects. Set VELLUM_AMBIENT=0 for a public SaaS " +
      "deploy, or VELLUM_SINGLE_USER=1 for a self-hosted family studio."
  );
}