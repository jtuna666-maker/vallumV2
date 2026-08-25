/** Canonical site branding and URLs for metadata, sitemaps, and social cards. */
export const SITE = {
  name: "VELLUM",
  title: "VELLUM — Your life, beautifully written",
  description:
    "VELLUM turns spoken memories into a memoir worth keeping. Guided chapters, voice capture, fine typesetting — and a cloth heirloom hardcover. Start free.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ogImage: "/og-cover.png",
  tagline: "Your life, beautifully written.",
} as const;
