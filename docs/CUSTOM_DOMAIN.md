# Custom local domain for OpenAdKit

Want `http://openadkit.localhost:<port>` instead of `http://127.0.0.1:<port>`? This guide is for people running OpenAdKit in a browser (macOS, Linux, or a source checkout). The Windows app opens in its own window, so there's no address bar to tidy up.

> **Read this first: browser data belongs to one address.** Your browser stores OpenAdKit's clients, history and API keys separately for every address — `127.0.0.1:41573`, `localhost:41573` and `openadkit.localhost:41573` are three different stores. When you switch address, the app starts empty there: your clients come back from the sync file (if the sidecar is running), but **you'll need to paste your API keys again**, because keys are never written to the sync file. Pick one address and stick with it.

## Which port does my copy use?

| Install | Where the port is saved |
|---|---|
| macOS / Linux installer | `ports` file in the app folder (`~/Library/Application Support/OpenAdKit/runtime/ports` or `~/.local/share/openadkit/ports`) — first number is the web app |
| Windows app | `%LOCALAPPDATA%\OpenAdKit\ports.txt` |
| Source checkout | `PORT=` in `.env.local` (`npm run dev` uses 3005) |

The installers pick a free pair in the 41573+ range on first launch and keep it. Below, replace `<port>` with yours.

---

## Option 1 · `*.localhost` · zero setup, recommended

Modern browsers (Chrome, Firefox, Safari, Edge, Brave, Arc) resolve any name ending in `.localhost` to your own computer. No hosts-file edits, no admin rights.

```
http://openadkit.localhost:<port>/
```

OpenAdKit treats `*.localhost` as local, so folder sync and the local website reader keep working.

**Pros:** instant, no admin, no system changes
**Cons:** the port is still visible; it's a new address, so re-enter your API keys once

This is what most people want.

---

## Option 2 · Hosts-file entry (`openadkit.local`) · advanced

You can add a hosts-file entry so `openadkit.local` points to your computer:

- **Windows:** right-click `scripts\set-domain.bat` → **Run as administrator**
- **Mac / Linux:** `sudo bash scripts/set-domain.sh`

This adds one line to your hosts file:

```
127.0.0.1   openadkit.local
```

**Important limitation:** OpenAdKit only treats `localhost`, `127.0.0.1` and `*.localhost` as local. At `openadkit.local` it behaves like a hosted copy — **folder sync and the local website reader are switched off** and your work lives only in that browser. If you want sync, use Option 1.

Hiding the port as well (`http://openadkit.local/`) would mean running the web app on port 80, which needs admin rights every time and isn't supported by the installers. A reverse proxy (Option 3) is a cleaner way to do that.

### Undo the hosts entry

- **Windows:** from an administrator Command Prompt in the OpenAdKit folder, run `scripts\set-domain.bat remove` — or edit `C:\Windows\System32\drivers\etc\hosts` in Notepad (run as administrator) and delete the `openadkit.local` line.
- **Mac / Linux:** `sudo bash scripts/set-domain.sh remove`

---

## Option 3 · Reverse proxy via Caddy or nginx (advanced)

If you already run a local reverse proxy:

```
# Caddyfile
openadkit.localhost {
  reverse_proxy 127.0.0.1:<port>
}
```

Using a `.localhost` name keeps sync working (see Option 2's limitation). This is overkill for most people but handy if you already route other local projects this way.

---

## Recommendation

- **Most people:** `http://openadkit.localhost:<port>/` — or just keep the address the app opened with.
- **Never switch addresses casually** — each one has its own browser storage.

## What about HTTPS?

You don't need it. Everything runs on your own computer, and your API key only travels to your chosen AI provider, which always uses HTTPS.
