# Custom local domain for OpenAdKit

Want `http://openadkit.local:3005` instead of `http://localhost:3005`? You have three options, ranked easiest first.

---

## Option 1 · `*.localhost` · zero setup, recommended

**All modern browsers** (Chrome, Firefox, Safari, Edge, Brave, Arc) automatically resolve any hostname ending in `.localhost` to `127.0.0.1`. No hosts-file edits, no DNS config, no admin privileges. RFC 6761 compliant.

So you can open these RIGHT NOW with no setup:

```
http://openadkit.localhost:3005/
http://acme.localhost:3005/
http://anything-you-want.localhost:3005/
```

Substitute your port if you changed it.

**Pros:** instant, no admin, no machine changes
**Cons:** you still see the port number; some weird command-line tools (curl on macOS) might need extra args

This is what most people want.

---

## Option 2 · Hosts-file entry · pretty URL with no port

Want `http://openadkit.local/` (no port at all)? You need two things:
1. **A hosts-file entry** mapping `openadkit.local` → `127.0.0.1`
2. **The web app running on port 80** (browser's default for HTTP)

Port 80 needs root/admin privileges to bind. So this requires admin rights, every time you start.

### Set up the hosts entry (one time, admin/sudo)

**Windows:**
1. Right-click `scripts\set-domain.bat`
2. Choose **"Run as administrator"**
3. Confirm the UAC prompt

**Mac / Linux:**
```bash
sudo bash scripts/set-domain.sh
```

This adds one line to your hosts file:
```
127.0.0.1   openadkit.local
```

### Run OpenAdKit on port 80

```bash
# .env.local
PORT=80
```

Then start with admin/sudo:
- Windows: right-click `scripts\start.bat` → Run as administrator
- Mac/Linux: `sudo bash scripts/start.sh`

Open `http://openadkit.local/` and you're in.

**Pros:** clean URL, no port shown
**Cons:** needs admin to start every time (port 80 is privileged); hosts file is global to your machine; one entry per app

### Undo the hosts entry

**Windows:**
1. Right-click Notepad → "Run as administrator"
2. Open `C:\Windows\System32\drivers\etc\hosts`
3. Delete the line containing `openadkit.local`

**Mac / Linux:**
```bash
sudo sed -i.bak '/openadkit\.local/d' /etc/hosts
```

---

## Option 3 · Reverse proxy via Caddy or nginx (advanced)

If you already run a local reverse proxy:

```
# Caddyfile
openadkit.local {
  reverse_proxy localhost:3005
}
```

Then `caddy run` from this folder, open `https://openadkit.local/` (Caddy auto-issues a local cert). Same pattern with nginx.

This is overkill for most people but lovely if you already use a local reverse proxy for other projects.

---

## Recommendation

- **Just starting?** Use `openadkit.localhost:3005`. Done.
- **Want it pretty for a demo or daily use?** Hosts entry + port 80.
- **Run lots of local projects?** Set up Caddy once, route everything.

---

## What about HTTPS?

OpenAdKit's runtime doesn't need HTTPS — everything runs locally and the API keys are localStorage-only, never sent over the network except to your chosen LLM provider (which IS HTTPS). For a polished demo, Caddy (option 3) gives you trusted local HTTPS automatically.
