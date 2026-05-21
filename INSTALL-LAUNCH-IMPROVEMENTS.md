# Install + Launch UX — current state + recommendations

## Current state (what works today)

- **Windows**: Double-click `AdForge.bat` → first-run installs deps, writes `.env.local`, creates Desktop shortcut. Subsequent runs: port resolver picks a free pair, sidecar starts hidden, browser opens to launcher.
- **macOS / Linux**: Double-click `AdForge.command` → same flow.
- **Online install**: `curl …/install.sh | bash` or `iwr …/install.ps1 | iex` clones the repo + runs the launcher.
- **Port resolver** (`scripts/resolve-ports.cjs`): handles 5 conflict cases (reuse / restart_stale / shifted / start / error) and walks **3010 → 5010** in pairs (even/odd) looking for a free pair.

### What's still rough (real user pain points)

| # | Problem | Why it bites |
|---|---|---|
| 1 | **Port defaults are 3005/3006** — the most-collided ports in dev (every Next.js app uses 3000-3010). | New users hit port conflicts immediately, fall through to "shifted" path. Their saved bookmark / Desktop shortcut may go stale. |
| 2 | **Walks 3010 → 5010 sequentially** — predictable, so a 2nd AdForge install always lands at 3010 and a 3rd at 3012, never far from contested space. | Same as above — collision-prone. |
| 3 | **No Node detection on first run** — user double-clicks, sees a stack trace, doesn't know what's missing. | Currently the .bat does check, the .command doesn't. |
| 4 | **`.command` files don't always run on macOS** — Gatekeeper blocks unsigned scripts; user has to right-click → Open → Confirm the first time. | Newcomer doesn't know this and assumes "it's broken." |
| 5 | **No graphical installer** — every install path requires command line or shell file. Non-technical users can't onboard. | Limits audience. |
| 6 | **Browser doesn't refresh open tabs** when the user runs the launcher a second time. | They see a stale page from a previous session, think it's broken. |
| 7 | **Desktop shortcut is a `.lnk` to a `.bat`** — runs in a CMD window for ~2s on every launch. Not "click → app opens" feel. | Looks janky. Also: shortcut points at a fixed path; if user moves the install folder, shortcut breaks. |
| 8 | **No version / update check on launch** — user runs an old version without knowing newer one exists. | Stale install drift. Auto-update endpoint exists but only fires from the launcher UI, not on launch. |
| 9 | **No "is this thing already running?" check before spawning** — port resolver handles it, but there's no fast-path for "user just clicked AdForge.bat twice in 2 seconds." Both processes try to write to .env.local. | Theoretical race. |
| 10 | **Settings + saved data live in the install folder** (`data/snapshot.json`, `.env.local`). If user upgrades by re-cloning into a new folder, their data doesn't follow. | Migration friction. |
| 11 | **No "uninstall" path** — leaves the Desktop shortcut, IndexedDB data (which is per-origin, so per-port → multiple stale entries if port shifted multiple times). | Cleanup debt. |
| 12 | **Browser opens to the launcher control panel, not the app** by default. User has to click "Open Web App" then. | One extra click every launch. |

---

## Recommendations — ranked by impact vs effort

### Tier 1 — Ship now (high impact, small change)

#### R1. Move default ports out of the 3000-range entirely
**Change:** Default to `41573` (web) + `41574` (sync), or another high-numbered pair (40000–49999 range is least-collided IANA registered-but-rarely-used).
- Tradeoff: less guessable, but the launcher already shows the URL clearly.
- Implementation: `scripts/resolve-ports.cjs` default + `AdForge.bat` / `AdForge.command` initial `.env.local` writers.
- **Bonus**: deterministically derive the default port from the install folder path (`hash(cwd) % 10000 + 40000`) so two installs in different folders start at different bases without ever colliding.

#### R2. Use OS-assigned random ports on first run
**Change:** When `.env.local` doesn't exist, ask the OS for two ephemeral free ports (bind to `:0`, read back the assigned port, immediately release) → write THOSE to `.env.local`. Zero chance of collision because the OS just told us the port is free at that moment.
- Tradeoff: same install gets a different port next time the OS hands a different ephemeral. So: only do this ONCE (first run), then persist.
- Implementation: ~10 lines in `resolve-ports.cjs`.

#### R3. Add browser tab refresh trigger on launch
**Change:** Sidecar `/health` endpoint already returns when it starts. Have the launcher write a "session ID" the page can check via `EventSource` or simple polling; when it changes, force a soft reload.
- Better UX: user clicks AdForge.bat → existing tab in their browser reloads itself, no new tab opened.

#### R4. Fix the `.command` Gatekeeper issue
**Change:** Add a `chmod +x AdForge.command` + a one-page README chunk explaining the macOS first-launch right-click flow. Ideally bundle a `.app` (see Tier 2).

### Tier 2 — High effort, transformative UX

#### R5. Real native installer / `.app` / `.exe` wrapper
**Options:**

- **Tauri** (Rust+web — produces a tiny native binary, ~10MB):
  ```
  npx create-tauri-app
  ```
  Wraps the Next.js export in a webview, runs the sidecar as a child process, auto-detects ports. Native menu bar / system tray.
- **Electron** (heavier, ~100MB) — more battle-tested but big.
- **Nativefier / pake** (zero-code wrapper) — fast hack, ugly result.

**My recommendation: Tauri.** Three reasons:
1. The app IS already a static-export-ready Next.js build — Tauri loads it from disk.
2. Bundle size matters when distributing to users who'll run AdForge locally; Electron's 100MB-per-install is overkill.
3. Tauri's child-process API can launch + supervise the sidecar without spawning a visible CMD window.

After Tauri integration:
- User downloads `AdForge.dmg` (Mac) or `AdForge.msi` (Windows) or `.AppImage` (Linux)
- Double-clicks installer → drag to Applications / Next-Next-Finish
- Icon on desktop / Launchpad → click → app opens in its own native window (or system browser if user prefers)
- Auto-update via Tauri's built-in updater pulling from GitHub releases
- Zero CMD/terminal windows ever

#### R6. Move data out of install folder → user-level config dir
**Change:** Use OS conventions:
- Windows: `%APPDATA%\AdForge\`
- macOS: `~/Library/Application Support/AdForge/`
- Linux: `~/.config/adforge/`

So updating AdForge = replace the binary, data follows the user. Aligns with what every native app does.

- Implementation: change `DATA_DIR` resolution in `scripts/local-sync.cjs` to a per-OS path with fallback to project-local for dev.

#### R7. Auto-update on launch (silent or prompted)
**Change:** On launcher start, hit GitHub API for latest release. If newer than current, show a one-click "Update + Restart" button in the launcher control panel. Don't auto-apply (audit said branch lock / dirty-tree lock — those are correct). Surface it.
- The auto-update endpoint already exists. Just need to fire the check on launch.

### Tier 3 — Polish that compounds

#### R8. Single-instance lock
**Change:** Before resolve-ports.cjs runs, take a file lock (`data/.adforge.lock`). If lock is held, just open the browser to the running sidecar and exit. Skips the entire spawn-twice-in-2-seconds race.

#### R9. Health check + status icon
**Change:** Sidecar exposes `/health` already. Tauri tray icon could be:
- Green dot — sidecar healthy
- Yellow — starting up
- Red — error (click to see logs)

#### R10. First-run wizard inside the app, not in the terminal
**Change:** Instead of `npm install` running visibly during first launch (~30s of scrolling logs), show a splash screen ("Setting up — first launch only…") while the install runs in the background.

#### R11. Uninstaller
**Change:** Native installers come with one. For the manual route, add an `AdForge-uninstall.bat` / `.command` that:
- Kills the sidecar
- Removes the Desktop shortcut
- Optionally wipes `%APPDATA%\AdForge\` (with confirm)
- Tells user to drag the install folder to trash

#### R12. "Open Web App" button → direct deep link to brand list, not launcher
**Change:** Skip the launcher HTML on launch; go straight to `http://127.0.0.1:<port>/brand`. User who already onboarded doesn't need to see the launcher every time. Add a tray-menu / hotkey "Open AdForge launcher" for the sidecar controls.

---

## Recommended implementation order (next 4 commits, today-shippable)

### Commit A — Defaults (R1 + R2, ~20 lines)
1. Default port range bumped from `3010-5010` → `41573-49999`.
2. On first `.env.local` creation, ask the OS for free ports.

### Commit B — Single-instance + browser refresh (R3 + R8, ~30 lines)
1. File-lock on launch.
2. Bumping the version stamp triggers existing tab reload.

### Commit C — Per-user data dir (R6, ~20 lines + migration)
1. Read DATA_DIR from OS conventions, write a one-time migration of existing `./data/` contents.

### Commit D — Tauri wrapper (R5, half-day project)
1. `npx create-tauri-app` in a subfolder.
2. Configure Tauri to spawn `scripts/local-sync.cjs` as a child process.
3. Build per-OS installers + add a GitHub Actions release job.

After Commit D: the README install instruction becomes literally "Download AdForge.dmg, drag to Applications. Done."

---

## My actual recommendation right now

**Do A + B + C today (~70 lines total).** That gets you 80% of the polish with zero new dependencies. The user-facing improvement is:
- New users → never hit port conflict (R1 + R2)
- Returning users → existing tabs auto-refresh on relaunch (R3)
- Multi-install scenarios → can't race themselves (R8)
- Updates / reinstalls → data persists across folder changes (R6)

**Tauri (D) is a separate decision** — it's the right long-term answer but it changes the project from "BYOK browser-only web app" to "downloadable desktop app." That's a positioning decision, not a technical one. If you say yes, I can wire it. If you'd rather keep the "browser-only, self-hosted" identity, A + B + C is plenty.

What do you want to do?
