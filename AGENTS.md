# AGENTS.md

## Project

rahgozar is a Rust-based censorship-bypass proxy and community continuation of mhrv-rs. It disguises client traffic as HTTPS to Google and supports Apps Script relay, direct/local DPI bypass, Full Tunnel through a VPS tunnel-node, and an encrypted Google Drive mailbox transport.

Current application version: 2.10.1. The core uses Rust 2021; the desktop app uses Tauri 2, Svelte 5, and Tailwind 4; Android uses Kotlin 2.1, Compose, and the core Rust cdylib through JNI.

## Repository Map

- `src/` — core library and `rahgozar` CLI; start with `src/lib.rs`, `src/main.rs`, `src/config.rs`, and `src/proxy_server.rs`.
- `desktop/` — Svelte frontend plus the Tauri Rust backend in `desktop/src-tauri/`.
- `android/` — Kotlin/Compose application, VpnService, JNI glue, and Gradle-driven `cargo-ndk` builds.
- `drive-wire/` — dependency-light Drive transport frame and filename types.
- `drive-relay/` — VPS-side `rahgozar-drive-relay` binary and systemd assets.
- `tunnel-node/` — standalone Rust crate for Full Tunnel TCP/UDP sessions; it is not in the root Cargo workspace.
- `assets/` — Apps Script, Cloudflare Worker, exit-node, fronting-group, and OpenWRT assets.
- `docs/` — user guides, changelogs, historical task notes, and the partial maintainer knowledge base.

The root Cargo workspace contains the root `rahgozar` package plus `desktop/src-tauri`, `drive-wire`, and `drive-relay`.

## Common Checks

```sh
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

From `desktop/`:

```sh
npm ci
npm run check
npm run build
```

From `tunnel-node/`:

```sh
cargo fmt -- --check
cargo test
cargo clippy --all-targets -- -D warnings
```

See `agent_docs/testing_and_tooling.md` for Android, Apps Script, targeted, and release-build commands.

## Working Rules

- Treat manifests, source, and workflows as authoritative when documentation disagrees.
- Never commit real auth keys, deployment IDs, OAuth tokens, CA private keys, updater signing keys, or user `config.json`.
- Full Tunnel protocol changes may require coordinated edits in `src/tunnel_client.rs`, `assets/apps_script/CodeFull.gs`, and `tunnel-node/src/`.
- Drive wire-format changes may require coordinated edits in `drive-wire/`, `src/drive_client.rs`, and `drive-relay/`.
- `rahgozar` with no subcommand starts the proxy. Explicit subcommands are `test`, `scan-ips`, `scan-sni`, and `test-sni`.

## Progressive Disclosure

- `agent_docs/architecture_and_navigation.md` — modes, component boundaries, entry points, and protocol-sensitive paths.
- `agent_docs/testing_and_tooling.md` — validation matrix, toolchain requirements, test locations, and CI reality.
- `agent_docs/release_and_documentation.md` — current release automation, version surfaces, changelog rules, and public assets.
