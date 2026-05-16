# Desktop app

The boilerplate ships a Tauri 2 wrapper that bundles the same web SPA as a native binary for macOS / Windows / Linux. The wrapper is a thin webview pointing at your deployed Cloudflare Worker — no separate auth, no separate frontend bundle. Same SPA, same Worker, same everything as the browser.

## Prerequisites

- Node 22+, pnpm 9+ (you already have these for the web product)
- **Rust toolchain** — install from https://rustup.rs/
- Platform-specific:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Visual Studio Build Tools with the "Desktop development with C++" workload
  - **Linux**: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

## Build a binary for your deployment

1. Open `src-tauri/tauri.conf.json`.
2. Replace `"REPLACE_WITH_YOUR_WORKER_URL"` with the URL of your deployed Worker (e.g. `https://admin.your-domain.com` or `https://admin-boilerplate.your-name.workers.dev`).
3. Update `productName` and `identifier` (`com.yourcompany.your-app-name`) to match your fork.
4. (Optional but recommended for shipped apps) replace `src-tauri/icons/*` with your own — Tauri ships placeholder Tauri logo icons.
5. Build:

   ```bash
   pnpm desktop:build
   ```

   First build takes 1–3 minutes (Rust dependencies compile). Subsequent builds are seconds.

The output lands in `src-tauri/target/release/bundle/`:

- macOS: `macos/<productName>.app` — drag to Applications
- Windows: `msi/<productName>_<version>_x64.msi`
- Linux: `deb/<productName>_<version>_amd64.deb` and `appimage/<productName>_<version>_amd64.AppImage`

**Note: DMG is intentionally NOT in the default targets.** Tauri's `bundle_dmg.sh` fails on recent macOS versions due to AppleScript / hdiutil permission prompts. If you want a DMG for distribution, add `"dmg"` to `bundle.targets` in `tauri.conf.json` AND make sure your build environment has the relevant permissions granted (Disk Utility, Automation).

## Dev mode

```bash
pnpm desktop:dev
```

Opens a Tauri window loading `http://localhost:5173` (Vite dev server). Run `pnpm dev:worker` in another terminal so the Worker is up on `:8787` — Vite proxies `/api/*` through.

## ⚠️ Known limitation: magic-link sign-in opens in the browser, not the desktop app

This is the v1 remote-URL wrapper's biggest UX wart. **The flow today:**

1. User opens desktop app → SPA loads → shows /sign-in
2. User submits email → magic link is sent
3. User clicks the magic link in their email → the OS opens the link in the **default browser**, not the desktop app
4. The browser completes `/auth/callback`, the cookie lands in the **browser's** cookie jar
5. The desktop app's webview has its own isolated cookie jar — it's still on /sign-in

This is fundamental to the remote-URL pattern (the OS routes `https://` clicks to the registered URL-scheme handler, which is the browser by default — not your app). It's fixable. Two paths:

### Fix A: Deep-link wiring on top of the remote URL (smaller change)

- Register a custom URL scheme (e.g. `admin-boilerplate://callback`) in the Tauri config + macOS Info.plist
- Worker generates magic links using that scheme when the request came from the desktop app (detect via a header set by the desktop wrapper)
- macOS routes the `admin-boilerplate://...` click to your desktop app
- Tauri's [deep-link plugin](https://v2.tauri.app/plugin/deep-link/) catches it, navigates the webview to `your-worker.com/auth/callback?token=...` — cookie lands in the right jar

About 5–6 tasks. The smaller fix.

### Fix B: Bearer-token auth (the bigger Phase 2 path)

The magic link still opens in the browser. The browser completes auth and returns a one-time exchange code via deep link to the desktop app. The desktop app trades the code for a long-lived API token, stores it in Tauri's keychain plugin, and sends `Authorization: Bearer <token>` on all `/api/*` calls.

This is the same "local SPA + bearer tokens" path that also unlocks offline mode, native filesystem access, and faster cold-start. Larger plan (~14–18 tasks) but a foundation for real native-app features.

**For now, the v1 workaround:** in the desktop app, after submitting your email, leave the desktop window open. Open the magic link in your **browser** to sign in there. Then either (a) use the browser for now while keeping the desktop window as a chrome shell, or (b) accept that the desktop window stays signed-out until the proper fix lands.

For internal teams who mostly live in the browser anyway, this limitation is annoying but not blocking. For a polished consumer-feeling app, you want Fix A or Fix B.

## Code signing + distribution

**macOS:** Without an Apple Developer ID cert ($99/yr), users see Gatekeeper "can't verify developer" on first launch. They can right-click → Open → Open to bypass. For broader distribution, see the [Tauri code-signing docs](https://v2.tauri.app/distribute/sign/macos/).

**Windows:** Without an Authenticode cert, users see SmartScreen warnings. Same story — see [Tauri Windows signing docs](https://v2.tauri.app/distribute/sign/windows/).

**Linux:** No signing model; binaries just run.

For internal team distribution, unsigned binaries with right-click-to-open are acceptable. For external distribution, plan for signing.

## Auto-updates

Not wired in this v1. Tauri has an official [updater plugin](https://v2.tauri.app/plugin/updater/) — you point it at a manifest URL, it checks for updates on startup, downloads and installs in the background, prompts the user to restart. Add it when you start shipping releases.

## What's NOT in this wrapper

- **No offline mode.** The window is blank until the Worker URL loads.
- **No local file access.** The remote-URL Tauri model deliberately restricts native command access to the loaded webpage for security. If you need filesystem APIs, dialog pickers, notifications, etc., upgrade to the "local SPA + bearer-token auth" pattern (Fix B above).
- **No in-app update prompts.** See above.
- **No DMG by default.** See note in the build section.

## Phase 2: local SPA upgrade

When a fork needs offline capability, local file access, or instant-shell cold-start:

1. Add a `POST /auth/desktop-token` endpoint that exchanges a session for a long-lived API token (with revocation in D1).
2. Store the token in Tauri's [stronghold plugin](https://v2.tauri.app/plugin/stronghold/) (cross-platform keychain).
3. Update the SPA's `api.ts` to send `Authorization: Bearer <token>` when running inside Tauri (detect via `window.__TAURI__`).
4. Update the Worker's `attachSession` middleware to accept either the cookie OR the bearer token.
5. Configure CORS on the Worker for the Tauri origin.
6. Change Tauri to load `dist/index.html` locally instead of the remote URL (`tauri.conf.json` → `app.windows[0].url` removed, `build.frontendDist` retained).

That's the rough shape. The boilerplate's current architecture keeps the door open for this upgrade — no code in Plans 1–6 prevents it.
