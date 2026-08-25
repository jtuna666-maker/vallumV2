import type { CapacitorConfig } from "@capacitor/cli";

/**
 * VELLUM is a hosted Next.js app; the iOS shell loads it in a WKWebView.
 *
 * - Preview: the checked-in fallback points at the current managed HTTPS preview.
 * - Production: set VELLUM_WEB_URL (preferred) or NEXT_PUBLIC_APP_URL before
 *   `npx cap sync ios`, e.g.
 *   VELLUM_WEB_URL=https://vellum.com npx cap sync ios
 *
 * Never ship localhost: on a physical iPhone it means the phone itself.
 */
const webUrl =
  process.env.VELLUM_WEB_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://3000-i5igzksv8i9j2g9m2dqbo.e2b.app";

const config: CapacitorConfig = {
  appId: "com.vellum.app",
  appName: "VELLUM",
  webDir: "public",
  server: {
    url: webUrl,
    // Never opt into App Transport Security exceptions for HTTPS previews or production.
    cleartext: webUrl.startsWith("http://"),
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#f6efe1",
    preferredContentMode: "mobile",
  },
};

export default config;
