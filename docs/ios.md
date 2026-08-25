# Shipping VELLUM on iOS

VELLUM is a hosted Next.js app; the native shell (`ios/`) is a Capacitor
WKWebView wrapper pointing at the deployed web app. Native voice capture is
bridged in (see below).

## Requirements

- macOS with Xcode 26+
- CocoaPods (`sudo gem install cocoapods`) — required because
  `@capacitor-community/speech-recognition` ships a podspec. The iOS platform
  was created with `npx cap add ios --packagemanager CocoaPods`.

## Workflow

```bash
# 1. Point the shell at a reachable HTTPS deployment and sync web assets +
#    native deps (runs `pod install` on macOS). Never use localhost on-device:
#    it means the iPhone itself, not your Mac or the web preview.
VELLUM_WEB_URL=https://your-production-url.com npx cap sync ios

# 2. Open the WORKSPACE (not the .xcodeproj) in Xcode
npx cap open ios
```

After changing `VELLUM_WEB_URL`, stop the app, run **Product ▸ Clean Build
Folder** in Xcode, and reinstall it on the simulator/device. The URL lives in
the compiled app bundle, so an already-installed build can keep the old
`localhost` configuration until it is rebuilt.

## Info.plist keys already configured

| Key | Value | Why |
| --- | --- | --- |
| `ITSAppUsesNonExemptEncryption` | `NO` | App uses only standard HTTPS — exempt from export compliance, so TestFlight/App Store Connect stops asking after every build. (Set via Target ▸ Info ▸ "App Uses Non-Exempt Encryption" in Xcode.) |
| `NSMicrophoneUsageDescription` | string | Voice capture for interview answers (required by the speech plugin). |
| `NSSpeechRecognitionUsageDescription` | string | On-device `SFSpeechRecognizer` transcription (required by iOS). |

## Voice capture architecture

`src/lib/speech.ts` is a unified dictation layer used by the interview UI:

- **Inside the iOS shell** → streams live transcripts from Apple's
  `SFSpeechRecognizer` via `@capacitor-community/speech-recognition`
  (registered in `capacitor.config.json` → `packageClassList`, and listed as a
  pod in `ios/App/Podfile`). Permissions are requested on first mic tap,
  partial results render live into the answer, and silence auto-ends a session
  via the plugin's `listeningState` event.
- **In browsers** → falls back to the Web Speech API where available; mic
  buttons only appear when a recognizer exists.

## Interface mode: Storyboard (intentionally)

The Capacitor template's `Main.storyboard` exists only to host the
`WKWebView` — the web app is the entire UI. Choosing SwiftUI as the interface
would buy nothing and require rewriting the generated
`AppDelegate`/`SceneDelegate`. Introduce SwiftUI later only for genuinely
native surfaces (paywall, settings, share extension); SwiftUI scenes coexist
fine with the Storyboard shell.

## Keepsake ordering (Stripe → Lulu)

Set these server env vars to enable real ordering; without them the app
records a free **reservation** instead of charging (deploy-safe default):

| Var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Enables Stripe Checkout for the $89 hardcover (collects shipping). |
| `STRIPE_WEBHOOK_SECRET` | Verifies `POST /api/webhooks/stripe` → marks orders paid, stores the address, dispatches print. |
| `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` | Print-on-demand fulfillment. Use **sandbox** creds until ready: `LULU_SANDBOX=1` (default). |
| `LULU_PACKAGE_ID` | Override the default 6×9 case-laminate hardcover package. |

Flow: preview toolbar → `POST /api/hardcover` → Stripe Checkout (or reserve) →
webhook `checkout.session.completed` → order marked **paid** + address saved →
if Lulu creds exist, `POST /print-jobs/` with hosted interior/cover PDF URLs →
order becomes **fulfilled** with `lulu_job_id`. Failures in fulfillment never
fail the webhook — paid orders can be re-dispatched by hand.

## Other notes

- Also bridged for the native shell: `@capacitor/haptics` (tactile tap on
  record start/stop, chapter completion) and `@capacitor/share` (native share
  sheet on the book preview), both wired in `ios/App/Podfile` and degrading
  silently on web.
- Bundle id: `com.vellum.app` — change in `capacitor.config.ts` before syncing.
- Icons/splash: source masters live in `assets-src/`, normalized inputs in
  `assets/`; regenerate the iOS catalog with
  `npx @capacitor/assets generate --ios` (AppIcon + light/dark launch
  screens are already generated into `Assets.xcassets`).
- Never edit `node_modules/`-referenced pods directly; run `npx cap sync ios`
  after adding/removing plugins.
