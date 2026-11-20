# Security Policy

OpenAdKit is a local-first, bring-your-own-key tool. There are no OpenAdKit accounts, no cloud database and no telemetry, so the attack surface is much smaller than a typical SaaS — but not zero.

## Threat model — what OpenAdKit does and doesn't protect

**What OpenAdKit protects against:**
- Server-side data breaches — there is no OpenAdKit cloud server holding your data.
- Account takeover — there are no accounts.
- Token-stealing telemetry — there is no telemetry.
- API keys leaking through the sync file — keys and the key vault are never written to `snapshot.json` (`isSyncablePrefKey` in `lib/local-sync.ts`).
- Tampered downloads — `install.sh` and `install.ps1` check the release against `SHA256SUMS.txt` (and `install.sh` checks Node.js against nodejs.org's checksums); the in-app Windows updater checks the Setup's SHA-256 and only downloads from GitHub hosts.
- Other websites driving the local sidecar — the sidecar only listens on `127.0.0.1`, accepts state-changing requests only from this install's own ports, and checks the `Host` header against DNS rebinding.
- Server-side request forgery through brand extraction — the URL reader (sidecar and hosted `/api/ingest`) blocks private, loopback, link-local and other reserved addresses and pins the checked DNS answer.

**What OpenAdKit does NOT protect against:**
- A compromised computer — anything in the app's browser storage (`localStorage`, IndexedDB) is reachable, including your API keys.
- Plain-text keys at rest — keys are stored unencrypted in `localStorage` unless you turn on the optional **key vault** (PBKDF2 + AES-GCM, unlocked once per session). Even with the vault, a script running while it is unlocked can read the key, because the app has to send it to the provider.
- Shared or public computers — don't use OpenAdKit on machines you don't trust.
- Malicious browser extensions — they can read the app's storage when it runs in your browser.
- Other programs on your own computer — the local server and sidecar have no login; anything running locally as you can talk to them. Don't expose them to a network.
- A malicious build — only install from this repo's releases, your own fork, or your own Docker build.
- **The Windows installer is not code-signed yet.** Verify it against `SHA256SUMS.txt` on the release page, or use the PowerShell installer, which does that for you.

## Reporting a vulnerability

**Please don't file a public GitHub issue** for security problems. Instead:

- Open a [GitHub Security Advisory](https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/security/advisories/new) (private to maintainers), or
- Email **[contact@dicecodes.com](mailto:contact@dicecodes.com)** with "OpenAdKit security" in the subject.

Include:
- A clear description of the vulnerability
- Steps to reproduce
- The impact (what an attacker can do)
- A suggested fix if you have one

We aim to acknowledge within **3 days** and patch high-severity issues within **14 days**.

## Scope

In scope:
- The OpenAdKit source code in this repo, including the MCP server (`mcp/`)
- The release assets (Windows installer, `OpenAdKit-app.tar.gz`) and the install scripts (`install.sh`, `install.ps1`)
- The update mechanism (release checks and the Windows one-click updater)
- Documented install paths (installers, source, Docker, Vercel deploy)

Out of scope:
- An AI provider's own API (report it to that provider — Anthropic, OpenAI, Google, Groq, etc.)
- Vulnerabilities in browsers, operating systems, WebView2 or third-party extensions
- Social engineering against contributors
- Issues that require physical access to a user's device

## Disclosure

We follow coordinated disclosure. Once a fix is shipped:
1. We publish the GitHub Security Advisory describing the issue.
2. We credit the reporter (unless they prefer not to be named).
3. We note the fix in the release notes.

## Supported versions

Only the latest release (and `main`) is supported. We don't backport security fixes to older versions — installed apps show an update notice when a new release is out.

## What's NOT a security issue

- Your API key being visible in DevTools — that's how browser storage works; OpenAdKit is BYOK by design. Use the key vault for encryption at rest.
- Generated copy that breaks an ad platform's policy — your AI provider and the ad platforms enforce their own policies; OpenAdKit does not pre-moderate.
- AI spend — set spending limits with your provider, and use OpenAdKit's monthly budget hard stop in Settings.
