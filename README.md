[![Latest release](https://img.shields.io/github/v/release/dazzling-no-more/rahgozar?display_name=tag&logo=github&label=release&color=blue&cacheSeconds=300)](https://github.com/dazzling-no-more/rahgozar/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dazzling-no-more/rahgozar/total.svg?label=downloads&logo=github&cacheSeconds=300)](https://github.com/dazzling-no-more/rahgozar/releases)
[![CI](https://github.com/dazzling-no-more/rahgozar/actions/workflows/release.yml/badge.svg)](https://github.com/dazzling-no-more/rahgozar/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/dazzling-no-more/rahgozar?color=blue)](LICENSE)
[![Stars](https://img.shields.io/github/stars/dazzling-no-more/rahgozar?style=flat&logo=github)](https://github.com/dazzling-no-more/rahgozar/stargazers)

# rahgozar — bypass censorship for free, with your own Google account

> ## About this fork
>
> **rahgozar** (Persian for *passerby* / *traveler*, رهگذر) is a community-maintained continuation of [therealaleph/MasterHttpRelayVPN-RUST](https://github.com/therealaleph/MasterHttpRelayVPN-RUST) — the original `mhrv-rs` Apps-Script-relay VPN that's a lifeline for users behind heavy censorship.
>
> Upstream went quiet with a queue of unmerged fixes and features piling up. This fork brings that queued work into a usable, releasable state so users have somewhere to get current builds. It's **fully separate** from upstream: different repo, different Android applicationId (`com.dazzlingnomore.mhrv`), different version line (starting at v2.0.0 to avoid colliding with upstream's historical v1.x tags). You can install both side-by-side.
>
> **If the upstream maintainer returns,** this fork will gladly hand work back, fold improvements upstream, or wind down. No hard feelings — just keeping the project usable in the meantime. See the [original repo](https://github.com/therealaleph/MasterHttpRelayVPN-RUST) for the project's roots.
>
> **What's in v2.0.0 that's not in upstream v1.9.25** (all from queued upstream PRs):
> - Apps Script edge-DNS batching + cache `getAll` perf wins
> - YouTube `relay_url_patterns` + SABR strip + exit-node-full SNI
> - Bundled curated CDN fronting groups (Vercel, Fastly, AWS CloudFront, GitHub) with one-tap loader
> - Multi-profile config storage (desktop + Android)
> - Use as upstream proxy for Psiphon / xray (Direct mode)
> - In-app auto-updater

**A small program that runs on your computer and lets you visit blocked websites for free, using a Google Apps Script you deploy in your own free Google account. Your ISP only sees encrypted traffic to `www.google.com` — it can't tell what you're really visiting.**

🇬🇧 [English Quick Start](#quick-start) · [Full Guide (advanced topics)](docs/guide.md)
🇮🇷 [راه‌اندازی سریع فارسی](#راه‌اندازی-سریع) · [راهنمای کامل (مباحث پیشرفته)](docs/guide.fa.md)

---

## What you get

- 🌐 **Bypasses DPI / SNI blocking** by using Google's edge as a relay
- 💯 **Completely free** — runs on your own Google account's free tier
- ⚡ **Lightweight downloads** (CLI ~3 MB, desktop installer ~5 MB, Android ~20 MB per-arch APK), no Python, no Node.js, no dependencies
- 🖥️ **Works on** Mac, Windows, Linux, Android, OpenWRT routers
- 🦊 **Any browser or app** that supports HTTP proxy or SOCKS5

## How it works (the simple picture)

```
   you  →  browser  →  rahgozar  ──┐
                                   │ ISP only sees:  www.google.com
                                   ▼
                          Google's network
                                   │
                                   ▼
              your free Apps Script  fetches  the real site
                                   │
                                   ▼
                Twitter / ChatGPT / blocked-site of your choice
```

ISPs can't read inside encrypted HTTPS. They only see the address — `www.google.com`. The actual page lookup happens inside Google's network, hidden in the encrypted tunnel.

## Quick Start

**About 5 minutes.** You need:

- A free Google account (any Gmail works)
- A computer (Mac, Windows, or Linux)
- Firefox or Chrome

### Step 1 — Make the Google Apps Script (one-time)

1. Go to **[script.google.com](https://script.google.com)**, sign in with your Google account
2. Click **New project** at the top left
3. Delete the default code in the editor
4. Open the file [`assets/apps_script/Code.gs`](assets/apps_script/Code.gs) in this repo, copy all of it, paste into the Apps Script editor (replacing what was there)
5. Find this line near the top:

   ```js
   const AUTH_KEY = "CHANGE_ME_TO_A_STRONG_SECRET";
   ```

   Change `CHANGE_ME_TO_A_STRONG_SECRET` to a long random string of your own. **Keep this string** — you'll paste it into the app in Step 3. Treat it like a password.
6. Click 💾 **Save** (or `Ctrl/Cmd+S`)
7. Click **Deploy** (top right) → **New deployment**
8. Click the gear icon ⚙ next to "Select type" → choose **Web app**
9. Set:
   - **Execute as:** *Me* (your Google account)
   - **Who has access:** *Anyone*
10. Click **Deploy**. Google may ask for permissions — click **Authorize access** and approve
11. Google shows a **Deployment ID** (a long random string). **Copy it** — you'll need it in Step 3.

> **Tip:** if you ever update `Code.gs` later, don't make a new deployment. Edit the code, then go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The Deployment ID stays the same.

### Step 2 — Download rahgozar

Go to the [latest release page](https://github.com/dazzling-no-more/rahgozar/releases/latest) and download the file for your computer:

| You're on | Download this |
|---|---|
| macOS | The `.dmg` installer matching the machine architecture |
| Windows | The `.msi` installer or portable Windows executable |
| Desktop Linux | `.AppImage` or `.deb` package |
| Phone, tablet, or Android TV | Universal APK or the APK matching the device ABI |
| CLI / server / OpenWRT router | The `rahgozar-*` archive matching the architecture and libc |

> **Mac: not sure if Apple Silicon or Intel?** Click  → **About This Mac**. If "Chip" says **Apple**, get arm64. If **Intel**, get amd64.

> **Linux: getting a `GLIBC` error?** Use the `linux-musl-amd64` file instead — it works on any Linux without dependencies.

### Step 3 — Install and open it

- On macOS, open the `.dmg` and drag rahgozar to Applications.
- On Windows, install the `.msi`, or run the portable build directly.
- On Linux, install the `.deb` or mark the `.AppImage` executable and run it.
- On Android, install the APK; see the [Android guide](docs/android.md) for the complete flow.

In `apps_script` and `direct` modes, the CA card in the app offers to install the local MITM certificate when needed. **The certificate and private key are generated on your device and never leave it.** The primary paths for `full`, `drive`, and `local_bypass` do not require that certificate.

The rahgozar window opens. Fill in:

- **Apps Script ID(s)** → paste the **Deployment ID** from Step 1
- **Auth key** → paste the random string you put in `Code.gs`
- Leave everything else at the defaults

Click **Save config**, then **Start**. The status circle goes green if it works.

> **Test it:** click the **Test** button. It sends one request through the relay and tells you if it worked.

### Step 4 — Tell your browser to use rahgozar

#### Firefox (recommended — easiest)

1. Firefox → ☰ menu → **Settings**
2. Search "proxy" in the search box
3. Click **Settings…** under Network Settings
4. Choose **Manual proxy configuration**
5. **HTTP Proxy:** `127.0.0.1` Port: `8085`
6. ☑ Check **"Also use this proxy for HTTPS"**
7. Click **OK**

#### Chrome / Edge

Install the [Proxy SwitchyOmega](https://chromewebstore.google.com/detail/proxy-switchyomega/padekgcemlokbadohgkifijomclgjgif) extension and set proxy to `127.0.0.1:8085`.

#### macOS (whole system)

System Settings → Network → Wi-Fi → Details → **Proxies** → enable both **Web Proxy (HTTP)** and **Secure Web Proxy (HTTPS)**, both pointing to `127.0.0.1:8085`.

### Step 5 — Try it

Open any blocked site in your browser. It should load.

If something doesn't work:

- Click **Test** in the rahgozar window — it pinpoints which step is failing
- Look at the **Recent log** panel at the bottom of the window
- See [Common questions](#common-questions) below

---

## Common questions

**Is this really free?** Yes. Google gives every account 20,000 outbound URL fetches per day on the free tier. That's plenty for one person's normal browsing. For a family of 3–4 sharing the same setup, make 2–3 deployments in different Google accounts and add all the IDs.

**Is it safe?** The certificate stays on your computer — no one else has the private key. Your `auth_key` is your secret. Google sees the websites you visit through the relay (because Apps Script fetches them on your behalf) — same as any hosted proxy. If you're not OK with that, use Full Tunnel mode with your own VPS — see the [full guide](docs/guide.md#full-tunnel-mode).

**YouTube video or the scrolling feed does not work.** In Fronting Groups, load the curated groups and keep `youtube-web` and `google-video` enabled. They route YouTube through the direct camouflage path with HTTP/2 support. If the ISP blocks the destination IP itself, camouflage is insufficient; use Full Tunnel, Drive Mode, or a real upstream tunnel.

**ChatGPT / Claude / Grok shows a Cloudflare CAPTCHA.** Cloudflare flags Google datacenter IPs as bots. Fix: set up an **exit node** — a small TypeScript handler you deploy on a serverless host (Deno Deploy, fly.io, your own VPS) that bridges Apps Script → your exit node → claude.ai. See [`assets/exit_node/README.md`](assets/exit_node/README.md).

**Telegram is unstable.** Telegram uses MTProto, which Apps Script doesn't speak. Pair with [xray](https://github.com/XTLS/Xray-core) on your machine — see [Telegram via xray in the full guide](docs/guide.md#telegram-via-xray).

**ISP blocks `script.google.com` itself.** rahgozar has a `direct` mode that uses only the SNI-rewrite tunnel (no Apps Script). Use it once to access `script.google.com` to deploy your script, then switch to apps_script mode. See [direct mode](docs/guide.md#direct-mode).

**I want to use rahgozar as Psiphon's (or xray's) upstream proxy.** Run rahgozar in `direct` mode and point Psiphon's *upstream proxy* setting at the host:port shown under the Connect button. Unfronted hosts pass through as raw TCP, so Psiphon's bootstrap traffic reaches Psiphon's servers untouched. See [docs/use-as-upstream.md](docs/use-as-upstream.md).

**I want DPI bypass without deploying Apps Script or installing the MITM cert.** Switch to `local_bypass` mode in the Mode dropdown (Android app, desktop UI, or `"mode": "local_bypass"` in `config.json`). Every TLS handshake gets fragmented locally and sent direct to the real destination — no relay, no cert, real cert pinning works. **On Android**, every app's traffic is captured automatically via VpnService. **On desktop**, only apps that honor the system proxy (`127.0.0.1:8085`) benefit — browsers and most system-proxy-aware apps; native apps with hardcoded networking are unchanged. Catch on both platforms: only beats DPI, not IP-level blocks (so `claude.ai` / `x.ai` / sanctions-blocked Google services still need `apps_script` or `full` mode). See [Local Bypass mode](docs/guide.md#local-bypass-mode).

**My Google search shows up without JavaScript.** The Apps Script `User-Agent` is fixed to `Google-Apps-Script` (Google won't let scripts change it), so some sites serve a no-JS fallback. Workaround: add the affected domain to your `hosts` map so it goes through the SNI-rewrite tunnel with your real browser User-Agent. `google.com`, `youtube.com`, `fonts.googleapis.com` are already on this list by default.

**More questions:** [full FAQ in the long guide](docs/guide.md#faq).

## Need help?

- Search [open and closed issues on rahgozar](https://github.com/dazzling-no-more/rahgozar/issues?q=is%3Aissue) — and the larger [upstream archive on therealaleph/MasterHttpRelayVPN-RUST](https://github.com/therealaleph/MasterHttpRelayVPN-RUST/issues?q=is%3Aissue) where most of the project's history lives — your problem might already be answered
- Open a [new issue on rahgozar](https://github.com/dazzling-no-more/rahgozar/issues/new) with: your config (mask `auth_key`!), exactly what you tried, exactly what you saw in the log

## Credits

This fork stands on three upstream projects you should know about and support before considering anything for the fork:

- **[@masterking32/MasterHttpRelayVPN](https://github.com/masterking32/MasterHttpRelayVPN)** — the original Python project where it all started. The Apps Script relay protocol, the proxy architecture, the idea of turning your own free Google account into a relay — all his. Without this, none of the rest exists.
- **[@therealaleph/MasterHttpRelayVPN-RUST](https://github.com/therealaleph/MasterHttpRelayVPN-RUST)** — the Rust port (`mhrv-rs`) this fork continues. therealaleph rewrote the Python project in Rust to ship single-binary clients, built the desktop + Android UIs.
- **[@patterniha/MITM-DomainFronting](https://github.com/patterniha/MITM-DomainFronting)** — the CDN fronting-groups concept (routing specific domains through Vercel / Fastly / CloudFront edges via SNI) that became the curated fronting bundle shipped here. Independent project; the Xray config there inspired our integration. See [`docs/fronting-groups.md`](docs/fronting-groups.md) for the lineage.

Most of the Rust code in this port (including this fork's merge and rebrand work) was written with [Anthropic's Claude](https://claude.com), reviewed by a human on every commit.

## Support these projects

**If you've benefited from this software, send your support upstream — not to this fork.** rahgozar takes no donations and exists only to keep users covered while upstream is inactive. The substantive engineering happened in the three projects above; please support them directly:

- **[@masterking32](https://github.com/masterking32)** — author of the original Python project. Sponsor on GitHub or via any method listed on his profile / repo.
- **[@therealaleph](https://github.com/therealaleph)** — Rust port author. Donate at **[sh1n.org/donate](https://sh1n.org/donate)** (covers hosting / CI / years of maintenance).
- **[@patterniha](https://github.com/patterniha)** — MITM-DomainFronting author. Sponsor on GitHub or via methods listed in his repo.

Starring those three upstream repos also signals their work is worth keeping alive. If upstream `mhrv-rs` resumes, this fork will fold work back and wind down — the goal here is continuity of access for users behind heavy censorship, nothing more.
