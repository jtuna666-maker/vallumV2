# VELLUM — Vercel deployment checklist

Copy-paste steps to take the repo from GitHub to a live production deploy.
Anything marked **required** must be set or the app will misbehave in production
(missing `VELLUM_AMBIENT=0` 500s every `/app` visit; `LULU_SANDBOX=0` missing
silently ships orders to the Lulu sandbox and no book is ever printed).

## 0. Before you start

- [ ] Repo is pushed to GitHub (`origin/main` = local `main`).
- [ ] A Postgres database exists (Neon, Supabase, or RDS) and you have its
      connection string. The app self-creates its schema on first boot via
      `/api/health` — no manual migration needed.
- [ ] Stripe account with API keys, and Lulu Print API credentials
      (sandbox keys are fine for the first test deploy).

## 1. Import into Vercel

1. vercel.com → **Add New → Project** → **Import** the VELLUM GitHub repo.
2. Framework is auto-detected as Next.js — leave the defaults.
3. Under **Environment Variables**, add the table below (all values are
   server-side except `NEXT_PUBLIC_APP_URL`; no secrets are committed anywhere).

## 2. Environment variables

| Key | Value | Required? |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require` | **Yes** — app throws at import without it |
| `SESSION_SECRET` | random string, **≥ 32 chars** (e.g. `openssl rand -hex 32`) | **Yes** — seals auth cookies; without it a deterministic preview fallback is used |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` (final domain once set) | **Yes — set before the first build** (baked into metadata/OG/robots/sitemap) |
| `VELLUM_AMBIENT` | `0` (public SaaS) | **Yes** — production refuses to run unless `VELLUM_AMBIENT=0` **or** `VELLUM_SINGLE_USER=1` |
| `VELLUM_SINGLE_USER` | `0` (or `1` for a one-household studio instead of SaaS) | see above |
| `RESEND_API_KEY` | Resend API key | **Yes for SaaS** — sign-in codes are emailed; without it codes only log to console |
| `RESEND_FROM` | `VELLUM <login@yourdomain>` | Yes for SaaS (verified sender) |
| `STRIPE_SECRET_KEY` | `sk_live_...` | **Yes for orders** — without it orders are "reserved" not charged |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the webhook config (step 3) | **Yes for orders** |
| `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` | Lulu Print API credentials | Yes for physical books (optional: orders stay "paid" without it) |
| `LULU_SANDBOX` | `0` in production | **Yes** — `1`/unset sends every order to the Lulu sandbox; the app warns loudly in production but still fulfills to sandbox |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `POLISH_MODEL` | optional | No — deterministic fallbacks run without them |

## 3. Deploy, then configure Stripe

1. Click **Deploy**. First build takes a minute or two.
2. In Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your-app>.vercel.app/api/webhooks/stripe`
   - Event: `checkout.session.completed`
   - Reveal the signing secret and paste it into the Vercel env var
     `STRIPE_WEBHOOK_SECRET`, then **Redeploy** (or Deployments → Redploy) so
     the running app picks it up.

## 4. Post-deploy smoke tests

1. `GET https://<your-app>.vercel.app/api/health` → **200** (creates the schema on first hit).
2. `GET /` and `GET /signin` → **200**, no error text in the page.
3. Sign in with a real email — the magic code arrives by email (check spam).
4. Create a project, write a chapter, hit **Free PDF** — a valid PDF downloads.
5. Order a Keepsake Softcover with Stripe test card `4242 4242 4242 4242`,
   any future expiry, any CVC. Complete checkout.
6. Back on the project preview page, the order chip shows **Paid — printing
   next**, and the `print_orders` row has a `lulu_job_id` once the webhook runs.
7. Vercel → project → **Logs**: no `Unsafe VELLUM runtime mode` lines and no
   `LULU_SANDBOX is not "0" in production` warning (both mean a misconfig).

## 5. Going live (orders → real books)

- First, validate the whole order flow on a **preview deployment** with
  `LULU_SANDBOX=1` (Vercel previews use the same env as production unless
  overridden) — confirm the webhook fires and a sandbox print job is created.
- Then set `LULU_SANDBOX=0` (production env) and redeploy. Lulu env vars are
  read at runtime, so no rebuild concerns.
- Put a real card through a real (small) order and confirm the order chip
  reaches **Printing & shipping**.
- Everyday updates: push to `main` → Vercel auto-redeploys. `DATABASE_URL`
  changes are runtime; `NEXT_PUBLIC_APP_URL` changes need a fresh build
  (any redeploy rebuilds).
