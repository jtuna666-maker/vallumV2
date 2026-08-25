# VELLUM runbook — modes, environment, deploy

## Modes (choose one per deployment)

| Mode | Env | Behavior |
| --- | --- | --- |
| **Showcase / sandbox** (the preview default) | `VELLUM_AMBIENT=1`, `VELLUM_SINGLE_USER=1` | Visitors are silently signed into the ambient "VELLUM Household" account; the seeded memoirs (`A Life in Eras`, `Wedding Stories & Kitchen Disasters`) are everyone's sandbox shelf. Seeder re-plants the showcase on an empty DB. |
| **The household** (self-hosted for one family) | `VELLUM_SINGLE_USER=1` | First visitor seals the ambient account forever; everyone shares the same studio with no sign-in friction. |
| **The product** (public SaaS) | `VELLUM_AMBIENT=0` | No ambient adoption; `/app` requires a real magic-code sign-in at `/signin`. Set `RESEND_API_KEY` so codes arrive by email. |

Ambience can be disabled at any time without touching user accounts.

## Editions & pricing

Single source of truth: `src/lib/pricing.ts`. The UI and the Stripe session
both compute from it, and the server always recomputes the price — a tampered
request cannot buy below the floor.

| Edition | Price | POD base (est.) | Floor | Typesetting |
| --- | --- | --- | --- | --- |
| Standard Digital PDF | **$0** | — | — | `simple` — single-spaced, VELLUM footer every page |
| Keepsake Softcover | **$39**/copy | ~$13 landed | $19.50 | `fine` — drop caps, tuned margins, no footer |
| HEIRLOOM Hardcover | **$89**/copy | ~$29 landed | $43.50 | `fine` + cloth spine, dust jacket, archival cream |

**Volume breaks** (apply to every copy in the order):

| Quantity | Discount | Heirloom unit | Softcover unit |
| --- | --- | --- | --- |
| 1 | — | $89.00 | $39.00 |
| 2–4 (Family set) | 10% | $80.10 | $35.10 |
| 5+ (The Grandkids Stack) | 20% | $71.20 | $31.20 |

Bulk stays profit-safe for two reasons: print-on-demand unit cost *falls* with
quantity (one imposition, one consolidated carton), and every quote is clamped
by `floorCents`. Worst case in the table above still returns ~59% gross margin.

The middle tier is deliberate: it anchors $89 as the premium choice, converts
buyers who would otherwise take only the free PDF, and is the natural volume
item for large families.

## PDF engine

`src/lib/pdf/` renders print-ready files with pdfkit (kept out of the bundle
via `serverExternalPackages` so its font metrics resolve at runtime).

- `GET /api/pdf/interior/<projectId>.pdf?edition=digital|softcover|heirloom`
- `GET /api/pdf/cover/<projectId>.pdf?edition=heirloom|softcover`

Access: project membership, the project share token, or `?k=<printKey>` — an
HMAC of the project id under `SESSION_SECRET`, which is what the Stripe
webhook hands the print vendor so it can fetch without a session. Rotating
`SESSION_SECRET` revokes every outstanding print URL.

The free footer (`Typeset in VELLUM — Order the heirloom hardcover keepsake at
vellum.com`) is stamped in a final pass over every buffered page at 7pt in
`#a2957f`, so overflow pages are never missed and the text stays muted.

Spine width is computed from the real page count: `pages / 400 PPI`, plus
`2 × 0.088"` board and `0.03"` hinge for hardcover.

## Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `SESSION_SECRET` | ≥32 chars; seals iron-session cookies. |
| `NEXT_PUBLIC_APP_URL` | Canonical origin (e.g. `https://vellum.com`) — drives metadataBase, OG URLs, robots, and the sitemap. |
| `VELLUM_AMBIENT` / `VELLUM_SINGLE_USER` | See modes above. |
| `RESEND_API_KEY` (+ `RESEND_FROM`) | Email delivery for sign-in codes. Without it, codes log to the server console and appear in the dev banner. |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (+ optional `POLISH_MODEL`) | Model-powered prose polish and follow-up question generation; deterministic fallbacks run without it. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Hardcover checkout + payment confirmation. |
| `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` / `LULU_SANDBOX=0` | Print-on-demand fulfillment for paid hardcovers. `LULU_SANDBOX` must be `0` in production — `1` (the default) sends orders to the Lulu sandbox, which marks them fulfilled but never prints a book. |

## Data note (sandboxes)

This sandbox rebuilds its Postgres volume fresh on some restarts. The app is
resilient to that: on an empty DB the bootstrap creates the demo household
and `lib/seed.ts` re-plants the showcase memoir with content, photo chapter,
and a live share link. Real deployments should use managed Postgres with
persistence (Neon, Supabase, RDS).

## Deploy

1. Create Postgres, run `npx drizzle-kit push` against it.
2. Set the env vars per the mode above **before** `next build` (`NEXT_PUBLIC_APP_URL` is baked into the prerendered metadata, sitemap, and robots at build time).
3. Deploy the Next.js app (Vercel or any Node host).
