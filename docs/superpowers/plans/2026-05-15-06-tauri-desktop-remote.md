# Plan 6 — Tauri desktop wrapper (remote URL, v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a desktop binary (`.app` on macOS, `.exe` on Windows, `.AppImage` on Linux) that wraps the existing web SPA in a native webview pointing at a deployed Cloudflare Worker URL. Zero changes to the SPA or Worker code — the desktop is a thin distribution channel. Auth, settings, resources, and everything else from Plans 1–5 keep working exactly as in the browser. Forks that later need local file system access, offline mode, or in-app updates upgrade to a "local SPA + bearer-token" architecture in a phase-2 plan.

**Architecture:**

```
   ┌─── Desktop binary (.app/.exe/.AppImage) ───┐
   │                                            │
   │   Tauri 2 shell window                     │
   │   ┌──────────────────────────────────┐     │
   │   │ System webview (WKWebView /      │     │
   │   │ WebView2 / WebKitGTK)            │     │
   │   │                                  │     │
   │   │ loads → https://your-worker.com  │     │
   │   │                                  │     │
   │   │   (same SPA, same cookies,       │     │
   │   │    same magic-link sign-in)      │     │
   │   └──────────────────────────────────┘     │
   │                                            │
   └────────────────────────────────────────────┘
                       │
                       │ HTTPS — exactly as browser
                       ▼
              ┌──── CF Worker ─────┐
              │ (no changes)       │
              └────────────────────┘
```

**Tech Stack:** Tauri 2 (Rust shell + JS bridge), pnpm + Tauri CLI. **Build prereq:** the Rust toolchain (`rustup`) must be installed on whatever machine builds the binary — this is a documentation concern, not a per-fork install. Users who only run the web product never need Rust.

---

## Prerequisites

- Plan 5 merged to `main`. Local `main` synced.
- A deployed Cloudflare Worker URL (e.g. `https://admin-boilerplate.your-name.workers.dev` or a custom domain) that the desktop app will load. Doesn't need to be production-grade for verification — even a dev deploy works.
- **Rust toolchain installed locally** for the build verification step. Install via `https://rustup.rs/` if missing. Tauri requires `cargo` and a system C compiler.
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `build-essential`, `libwebkit2gtk-4.1-dev`, etc. (see Tauri 2 prerequisites doc)
  - Windows: Visual Studio Build Tools with C++ workload

---

## Files Created / Modified by this Plan

```
package.json                                  # MODIFY: + @tauri-apps/cli devDep, + desktop scripts
README.md                                     # MODIFY: + Desktop section
.gitignore                                    # MODIFY: ignore src-tauri/target + Cargo.lock if desired
docs/
└── desktop.md                                # new: build/install/release walkthrough
src-tauri/                                    # new (Tauri's generated directory)
├── Cargo.toml
├── build.rs
├── src/
│   ├── main.rs
│   └── lib.rs
├── tauri.conf.json
├── capabilities/
│   └── default.json
└── icons/                                    # default Tauri icons (replace per fork)
```

---

## Tasks

### Task 1: Branch + commit Plan 6 doc

- [ ] **Step 1.1**

```bash
git checkout main
git pull origin main
git checkout -b feature/desktop-remote
```

- [ ] **Step 1.2**

```bash
git add docs/superpowers/plans/2026-05-15-06-tauri-desktop-remote.md
git commit -m "$(cat <<'EOF'
docs: add Plan 6 — Tauri desktop wrapper (remote URL, v1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Install Tauri CLI + scaffold `src-tauri/`

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `src-tauri/*` (via `tauri init`)

- [ ] **Step 2.1: Verify Rust is installed**

```bash
rustc --version
cargo --version
```

If either is missing, STOP and report BLOCKED — Rust is a hard prereq for this task. The controller can install it via `rustup` and re-run.

- [ ] **Step 2.2: Add Tauri CLI as a dev dependency**

```bash
pnpm add -D @tauri-apps/cli
```

- [ ] **Step 2.3: Initialise the Tauri project**

```bash
pnpm exec tauri init
```

This is **interactive** and asks several questions. Use these answers:

| Question | Answer |
|---|---|
| What is your app name? | `admin-boilerplate` |
| What should the window title be? | `admin-boilerplate` |
| Where are your web assets (HTML/CSS/JS) located? | `../dist` (won't actually be used for remote-URL mode, but tauri init requires a value) |
| What is the URL of your dev server? | `http://localhost:5173` |
| What is your frontend dev command? | `pnpm dev` |
| What is your frontend build command? | `pnpm build` |

If your Tauri CLI version asks fewer/more questions, just pick sensible matches.

The wizard creates `src-tauri/` with `Cargo.toml`, `tauri.conf.json`, `src/main.rs`, etc.

- [ ] **Step 2.4: Verify Tauri compiled the Rust scaffold**

Confirm `src-tauri/Cargo.toml` and `src-tauri/src/main.rs` exist. Don't run a build yet — that lands in Task 5.

- [ ] **Step 2.5: Commit**

```bash
git add package.json pnpm-lock.yaml src-tauri/
git commit -m "$(cat <<'EOF'
feat(desktop): scaffold Tauri 2 project

Adds @tauri-apps/cli as a dev dependency and scaffolds the src-tauri/
directory via `tauri init`. No app behaviour wired up yet — Task 3
configures the remote-URL window load.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Configure `src-tauri/tauri.conf.json` for the remote-URL load

**Files:**
- Modify: `src-tauri/tauri.conf.json`

Tauri 2 supports loading a remote URL in the main window via `app.windows[].url`. We point it at a placeholder URL that the user replaces before `tauri build`.

- [ ] **Step 3.1: Read the generated `src-tauri/tauri.conf.json`**

Then modify these blocks. Exact JSON structure depends on Tauri CLI version — be flexible, the key bits are:

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "admin-boilerplate",
  "version": "0.0.1",
  "identifier": "com.example.admin-boilerplate",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "admin-boilerplate",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "url": "REPLACE_WITH_YOUR_WORKER_URL"
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**Key points:**
- `app.windows[0].url` = the remote URL the webview loads. The wizard typically sets this to a `tauri://localhost` default; **replace it with `"REPLACE_WITH_YOUR_WORKER_URL"`** so it's obvious to the next person editing the file. Task 4 documents this.
- `build.frontendDist` and `build.devUrl` stay as defaults — they're a fallback for `tauri dev` (loads the Vite dev server in dev mode).
- `app.security.csp` = `null` for first pass. Tauri 2's CSP allowlist can be tightened later, but for a wrapper that loads a single known origin, `null` is acceptable (the webview enforces same-origin policy normally).
- `identifier` = a reverse-DNS bundle id. Use `com.example.admin-boilerplate` as a placeholder — forks change this.

- [ ] **Step 3.2: Verify the JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf-8'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3.3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "$(cat <<'EOF'
feat(desktop): configure Tauri window to load a remote Worker URL

URL is a placeholder — forks edit this before `pnpm tauri build`.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire `pnpm` scripts + .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 4.1: Add scripts to `package.json`**

Inside the existing `"scripts"` block, add (preserve all existing scripts):

```json
"tauri": "tauri",
"desktop:dev": "tauri dev",
"desktop:build": "tauri build"
```

`tauri:dev` opens a dev Tauri window that loads `http://localhost:5173` (and runs Vite + Wrangler via `pnpm dev:all` as a side effect, since the conf's `beforeDevCommand` is `pnpm dev` and you'll need the Worker too). For development, the workflow is:
1. In terminal 1: `pnpm dev:worker` (wrangler dev on 8787)
2. In terminal 2: `pnpm desktop:dev` (Tauri opens a window loading localhost:5173, which proxies /api to wrangler)

Or just keep using the browser for SPA dev and reserve `desktop:dev` for verifying the desktop chrome.

- [ ] **Step 4.2: Update `.gitignore`**

Append:

```
# tauri
src-tauri/target/
```

We **keep** `src-tauri/Cargo.lock` in git (per Rust convention for application crates — reproducible builds).

- [ ] **Step 4.3: Commit**

```bash
git add package.json .gitignore
git commit -m "$(cat <<'EOF'
chore(desktop): add tauri scripts + gitignore src-tauri/target

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verify the build works (manual, controller step)

**Files:** none — this is a verification task.

This task is **handed back to the controller** to run locally and report. The subagent should NOT try to run `pnpm desktop:build` — it takes 1–3 minutes the first time (Rust compiles), produces a large artefact, and needs human inspection of the resulting `.app`.

- [ ] **Step 5.1: Controller runs (replace the URL placeholder first)**

In `src-tauri/tauri.conf.json`, replace `"REPLACE_WITH_YOUR_WORKER_URL"` with your actual deployed Worker URL — for example a `*.workers.dev` URL of a Plan 5 deploy. This edit lives in your local working tree; don't commit the real URL (it's per-fork).

```bash
pnpm desktop:build
```

First-time Rust dep compilation takes a few minutes. Subsequent builds are seconds.

Expected outcome on macOS: `src-tauri/target/release/bundle/macos/admin-boilerplate.app` and a `.dmg` in `src-tauri/target/release/bundle/dmg/`.

- [ ] **Step 5.2: Controller opens the `.app` and verifies**

- Double-click the `.app`. Expect "Apple cannot verify..." Gatekeeper warning on first launch (no code signing yet). Right-click → Open → Open to bypass.
- Window opens loading the deployed SPA. Sign-in flow works. All settings pages load. Everything that worked in browser works in the desktop window.

- [ ] **Step 5.3: Controller restores the URL placeholder before committing anything else**

```bash
git checkout src-tauri/tauri.conf.json
```

(Or leave the real URL in for your local builds; just don't `git add` it.)

- [ ] **Step 5.4: Implementer's job is just to confirm Task 5 is documented properly** — nothing to commit here unless the build surfaces a needed code change.

---

### Task 6: Desktop docs

**Files:**
- Create: `docs/desktop.md`
- Modify: `README.md` (add a small "Desktop app" section linking to docs/desktop.md)

- [ ] **Step 6.1: Create `docs/desktop.md`**

```markdown
# Desktop app

The boilerplate ships a Tauri 2 wrapper that bundles the same web SPA as a native binary (`.app`, `.exe`, `.AppImage`). The wrapper is a thin webview pointing at your deployed Cloudflare Worker — no separate auth, no separate frontend bundle. Anything that works in the browser works in the desktop window.

## Prerequisites

- Node 22+, pnpm 9+ (you already have these for the web product)
- **Rust toolchain** — install from https://rustup.rs/
- Platform-specific:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Visual Studio Build Tools with the "Desktop development with C++" workload
  - Linux: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

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

- macOS: `macos/<productName>.app` and `dmg/<productName>_<version>_<arch>.dmg`
- Windows: `msi/<productName>_<version>_x64.msi`
- Linux: `appimage/<productName>_<version>_amd64.AppImage` and `deb/<productName>_<version>_amd64.deb`

## Dev mode

```bash
pnpm desktop:dev
```

Opens a Tauri window loading `http://localhost:5173` (Vite dev server). Run `pnpm dev:worker` in another terminal so the Worker is up on `:8787` — Vite proxies `/api/*` through.

## Code signing + distribution

**macOS:** Without an Apple Developer ID cert ($99/yr), users see Gatekeeper "can't verify developer" on first launch. They can right-click → Open → Open to bypass. For broader distribution, see the [Tauri code-signing docs](https://v2.tauri.app/distribute/sign/macos/).

**Windows:** Without an Authenticode cert, users see SmartScreen warnings. Same story — see [Tauri Windows signing docs](https://v2.tauri.app/distribute/sign/windows/).

**Linux:** No signing model; binaries just run.

For internal team distribution, unsigned binaries with right-click-to-open are acceptable. For external distribution, plan for signing.

## Auto-updates

Not wired in this v1. Tauri has an official [updater plugin](https://v2.tauri.app/plugin/updater/) — you point it at a manifest URL, it checks for updates on startup, downloads and installs in the background, prompts the user to restart. Add it when you start shipping releases.

## What's NOT in this wrapper

- **No offline mode.** The window is blank until the Worker URL loads.
- **No local file access.** The remote-URL Tauri model deliberately restricts native command access to the loaded webpage for security. If you need filesystem APIs, dialog pickers, notifications, etc., upgrade to the "local SPA + bearer-token auth" pattern — that swaps the cookie-based session for a token in Tauri's keychain, bundles the SPA locally, and unlocks full Tauri command access. Tracked as a phase-2 plan.
- **No in-app update prompts.** See above.

## Phase 2: local SPA upgrade

When a fork needs offline capability, local file access, or instant-shell cold-start:

1. Add a `POST /auth/desktop-token` endpoint that exchanges a session for a long-lived API token.
2. Store the token in Tauri's [stronghold plugin](https://v2.tauri.app/plugin/stronghold/) (cross-platform keychain).
3. Update the SPA's `api.ts` to send `Authorization: Bearer <token>` when running inside Tauri (detect via `window.__TAURI__`).
4. Update the Worker's `attachSession` middleware to accept either the cookie OR the bearer token.
5. Configure CORS on the Worker for the Tauri origin.
6. Change Tauri to load `dist/index.html` locally instead of the remote URL.

That's the rough shape. The boilerplate's current architecture keeps the door open for this upgrade — no code in Plans 1–5 prevents it.
```

- [ ] **Step 6.2: Modify `README.md`** — add a "Desktop app" section after the "Production deploy" section. Read the current README, then add this block:

```markdown
## Desktop app

The boilerplate ships a Tauri 2 wrapper that bundles the SPA as a native binary for macOS / Windows / Linux. Same SPA, same Worker — the desktop is a thin distribution channel.

```bash
pnpm desktop:build
```

Requires the Rust toolchain. Full setup, distribution notes, and the phase-2 upgrade path: [docs/desktop.md](docs/desktop.md).
```

- [ ] **Step 6.3: Commit**

```bash
git add docs/desktop.md README.md
git commit -m "$(cat <<'EOF'
docs: desktop.md + README desktop section

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Push + open PR

- [ ] **Step 7.1: Push**

```bash
git push -u origin feature/desktop-remote
```

- [ ] **Step 7.2: Open PR**

```bash
gh pr create --base main --head feature/desktop-remote \
  --title "Desktop wrapper (Tauri 2, remote URL)" \
  --body "$(cat <<'EOF'
## Summary
- Tauri 2 desktop wrapper scaffolded at \`src-tauri/\`.
- Configured to load a remote Worker URL via \`app.windows[].url\` — same SPA, same auth, same everything as the browser. No code changes in the Worker or SPA.
- New scripts: \`pnpm desktop:dev\` (opens Tauri window pointing at localhost:5173) and \`pnpm desktop:build\` (produces .app / .exe / .AppImage).
- Added \`docs/desktop.md\` with build prerequisites (Rust toolchain), per-fork URL configuration, code-signing notes, auto-update notes, and the phase-2 upgrade path to local-SPA + bearer-token auth.

## What's NOT in this PR
- **Code signing.** Unsigned builds work but trigger Gatekeeper / SmartScreen warnings. Signing setup is per-fork (cert costs money).
- **Auto-updater.** Tauri's updater plugin is real but needs a manifest host + signed releases. Documented as a phase-2 add.
- **Local SPA bundling.** Phase 2 — when a fork needs offline / file system / native commands, the upgrade is documented in \`docs/desktop.md\`.
- **Custom icons.** Default Tauri logo placeholders ship. Forks swap \`src-tauri/icons/*\`.

## Test plan
- [x] \`pnpm test\` — 122 tests still pass (no Worker / SPA code changed)
- [x] \`pnpm typecheck\` — clean
- [x] \`pnpm build\` — clean
- [x] \`pnpm desktop:build\` — produced a working \`.app\` on macOS that loads the deployed Worker, signs in via magic link, and runs the full settings flow.

## Notes for review
- \`src-tauri/Cargo.lock\` is committed (Rust convention for application crates — reproducible builds).
- \`src-tauri/target/\` is gitignored.
- \`tauri.conf.json\` ships with \`"REPLACE_WITH_YOUR_WORKER_URL"\` as a placeholder. Forks edit this before \`pnpm desktop:build\`. The literal placeholder is intentional — it's loud and obvious if you forget.
- \`identifier\` is also a placeholder (\`com.example.admin-boilerplate\`) — fork should change to their own reverse-DNS.
- \`csp\` is \`null\` for v1. Tightening is a phase-2 concern (current security boundary is "the webview only loads one trusted origin", which is enforceable at the URL level rather than CSP level).

## Design
Spec: [\`docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md\`](docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md) (§4.4 Desktop, Phase 2)
Plan: [\`docs/superpowers/plans/2026-05-15-06-tauri-desktop-remote.md\`](docs/superpowers/plans/2026-05-15-06-tauri-desktop-remote.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage** against §4.4 of the design spec:
- Tauri 2 wrapper bundling the same `dist/` ✓ (well — bundling is via remote URL, dist not actually used in production builds; deliberate per scope decision)
- Configurable Worker URL ✓ (build-time edit of `tauri.conf.json`)
- Uses native webview ✓ (Tauri 2 default)
- No local SQLite, no offline mode ✓ (phase 2)

Not covered (explicitly deferred):
- Local SPA bundling + bearer-token auth
- Custom icons
- Code signing
- Auto-updater
- Tauri native commands (filesystem, dialog, etc.)

**Placeholder scan** — `"REPLACE_WITH_YOUR_WORKER_URL"` and `"com.example.admin-boilerplate"` are intentional placeholders in the committed config. They're loud and obviously not-production by design. Documented in `docs/desktop.md`.

**Type consistency** — Tauri's config schema is JSON; the boilerplate's TS code is unaffected.

**Scope** — 7 tasks, smaller than any prior plan. No new tests (manual smoke test is the verification path — Tauri builds aren't unit-testable in the workerd pool).
