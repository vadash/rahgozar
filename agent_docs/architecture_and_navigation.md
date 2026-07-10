# Architecture and Navigation

## Component Model

| Component | Entry point | Responsibility |
|---|---|---|
| Core CLI/library | `src/main.rs`, `src/lib.rs` | Configuration, proxy listeners, routing, MITM, domain fronting, transports, updates, and JNI exports |
| Desktop frontend | `desktop/src/main.ts`, `desktop/src/App.svelte` | Svelte/Tailwind configuration and status UI |
| Desktop backend | `desktop/src-tauri/src/main.rs`, `lib.rs`, `commands.rs` | Tauri lifecycle and IPC access to the core library |
| Android application | `MainActivity.kt`, `RahgozarVpnService.kt`, `Native.kt` | Compose UI, VpnService/TUN lifecycle, configuration storage, and Rust JNI calls |
| Drive wire | `drive-wire/src/lib.rs` | Shared encrypted-frame and Drive-filename formats |
| Drive relay | `drive-relay/src/main.rs`, `lib.rs` | Poll Drive, decrypt client frames, dial destinations, and upload replies |
| Tunnel node | `tunnel-node/src/main.rs`, `udpgw.rs` | Full-mode TCP/UDP session bridge and udpgw protocol |
| Server assets | `assets/apps_script/`, `assets/cloudflare/`, `assets/exit_node/` | User-deployed relay and exit components |

The root Cargo workspace contains `rahgozar`, `rahgozar-desktop`, `drive-wire`, and `rahgozar-drive-relay`. `tunnel-node/Cargo.toml` has an empty `[workspace]` table and its own lockfile, so run its Cargo commands inside `tunnel-node/`.

Android is a separate Gradle project. Its Gradle build invokes `cargo ndk` against the root `rahgozar` cdylib for arm64-v8a, armeabi-v7a, x86_64, and x86.

## Operating Modes

`src/config.rs::Mode` is the source of truth.

| Config value | Path |
|---|---|
| `apps_script` | Locally interprets HTTP/HTTPS traffic and relays requests through `Code.gs` or `Code.cfw.gs` |
| `direct` | Uses direct TLS fragmentation for configured Google domains with the existing fronting path as fallback; no Apps Script relay |
| `full` | Carries TCP/UDP session operations through `CodeFull.gs` to `tunnel-node` |
| `local_bypass` | Fragments TLS ClientHello traffic directly to each real destination; no relay or MITM |
| `drive` | Exchanges encrypted frames through a Google Drive folder with `rahgozar-drive-relay` |
| `google_only` | Accepted compatibility alias for `direct` |

Example configurations live at the repository root. The complete schema, defaults, compatibility aliases, and validation are in `src/config.rs`.

## Core Navigation

- `src/proxy_server.rs` — HTTP/SOCKS5 listeners and routing precedence.
- `src/domain_fronter.rs` — Apps Script/domain-fronting connections, relay responses, compression handling, and shared edge logic.
- `src/direct_mode.rs` — TLS-fragmentation direct path and its health/candidate state.
- `src/camouflage.rs`, `src/doh.rs` — force-IP camouflage and the resolver it uses.
- `src/tunnel_client.rs` — Full Tunnel batching, pipelines, sessions, and Apps Script response handling.
- `src/drive_client.rs` — client side of the Drive mailbox transport.
- `src/drive_api.rs`, `drive_oauth.rs`, `drive_crypto.rs` — shared Drive API, OAuth, and cryptographic support.
- `src/mitm.rs`, `src/cert_installer.rs` — local CA creation and platform trust-store operations.
- `src/config.rs`, `src/profiles.rs`, `src/data_dir.rs` — configuration model, profiles, validation, and storage paths.
- `src/android_jni.rs` — exported JNI surface consumed by `android/.../Native.kt`.
- `src/update_check.rs`, `src/update_apply.rs` — CLI/Android update discovery and application.

## Desktop Navigation

- `desktop/src/lib/api.ts` mirrors the Tauri command surface.
- `desktop/src/lib/components/TunnelTab.svelte` is the main configuration screen.
- `FrontingGroupsSection.svelte` and `SniPoolModal.svelte` own their specialized editors.
- `desktop/src/lib/i18n.svelte.ts` contains English and Persian UI strings.
- `desktop/src-tauri/src/commands.rs` is the IPC boundary.
- `state.rs`, `runtime.rs`, and `logbridge.rs` own the live proxy, Tokio runtime, and log transport.

## Android Navigation

- `RahgozarApp.kt` performs per-process initialization, including Android TLS setup.
- `RahgozarVpnService.kt` owns the VPN process and TUN/proxy lifecycle.
- `VpnStateSync.kt` coordinates the separate `:vpn` process with the UI.
- `ConfigStore.kt` and `ProfileStore.kt` own persisted configuration and profiles.
- `ui/HomeScreen.kt` contains most configuration editors.
- `ui/DriveSetupSection.kt` owns Drive OAuth/folder/key setup.
- `CaInstall.kt` handles user-CA export, installation guidance, and verification.

## Protocol-Sensitive Surfaces

Full Tunnel operations cross three implementations:

1. `src/tunnel_client.rs`
2. `assets/apps_script/CodeFull.gs`
3. `tunnel-node/src/main.rs` and `udpgw.rs`

The tunnel node exposes:

- `POST /tunnel`
- `POST /tunnel/batch`
- `GET /health`

Its primary environment contract is `TUNNEL_AUTH_KEY` and optional `PORT`; `MHRV_DIAGNOSTIC` and `MHRV_DISABLE_PREWARM` alter diagnostic/prewarm behavior.

Drive transport formats cross:

1. `drive-wire/`
2. `src/drive_client.rs`
3. `drive-relay/`

Changes to frame encoding, filenames, sequence behavior, session IDs, or encryption must be checked across all three.

Full Tunnel `zc` is a capability bit field negotiated per Apps Script deployment: bit 0 is zstd and bit 1 is safe sequenced TCP-batch replay. Preserve it through `CodeFull.gs`; the edge-DNS splice path must clear only bit 0 while forwarding so it can inspect plain `r[]` without discarding replay negotiation.

## User-Deployed Assets

- `assets/apps_script/Code.gs` — standard Apps Script fetch relay.
- `CodeFull.gs` — Full Tunnel session relay.
- `Code.cfw.gs` plus `assets/cloudflare/worker.js` — Cloudflare Worker variant.
- `assets/exit_node/` — optional non-Google egress for bot-blocked destinations.
- `assets/fronting-groups/curated.json` — canonical curated groups bundled by desktop and Android.
