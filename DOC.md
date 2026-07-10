# Repository Guidelines

## Project Structure & Module Organization

Root Cargo workspace with three members:

- **`src/`** — Core `rahgozar` crate (CLI binary + library). Proxy server, domain fronting, tunnel, Drive-mode crypto, MITM, config, and update logic live here.
- **`desktop/`** — Tauri 2 desktop app. Rust backend at `desktop/src-tauri/src/`, Svelte 5 + Tailwind frontend at `desktop/src/`.
- **`android/`** — Android app (Kotlin/Compose). Loads the core cdylib via JNI (`src/android_jni.rs`).
- **`drive-relay/`** — `rahgozar-drive-relay` VPS-side binary. Path-depends on the core crate for shared crypto/OAuth modules.
- **`drive-wire/`** — Wire-format types shared between the Drive client and relay. Minimal deps for easy cross-compilation.
- **`tunnel-node/`** — Standalone tunnel-node binary (udpgw).
- **`assets/`** — Apps Script code, exit-node/cloudflare workers, and fronting-group data.
- **`docs/`** — User guides, changelogs, and maintainer references.

Example configs: `config.example.json`, `config.direct.example.json`, `config.full.example.json`, `config.local_bypass.example.json`, `config.exit-node.example.json`, `config.fronting-groups.example.json`.

## Build, Test, and Development Commands

**Rust (core + workspace):**
```sh
cargo build --workspace              # build all crates
cargo test --workspace               # run all Rust tests
cargo fmt --all -- --check           # check formatting
cargo clippy --workspace --all-targets -- -D warnings  # lint
cargo build --features pipeline-debug  # diagnostic build with internal counters
```

**Desktop (from `desktop/`):**
```sh
npm install                          # install frontend deps (Node ≥ 22)
npm run check                        # svelte-check type checking
npm run build                        # vite build frontend only
npm run tauri dev                    # Tauri dev mode (Rust + frontend hot-reload)
npm run tauri build                  # production desktop bundle
```

**Android:** Open `android/` in Android Studio; Gradle builds the core cdylib via `cargo-ndk`.

**Release CI:** Tag push (`v*`) triggers `.github/workflows/release.yml` — cross-compiles for 12+ targets (Linux glibc/musl, macOS, Windows, Android, OpenWRT MIPS).

## Coding Style & Naming Conventions

- **Rust:** Edition 2021. Run `cargo fmt` before committing. `clippy` must pass with no warnings. Extensive inline comments explain *why* for non-obvious dependency pins, security choices, and cross-compile constraints (follow this convention).
- **TypeScript/Svelte:** Svelte 5 + Tailwind 4. Type-check with `npm run check`. No Prettier config is enforced — match surrounding style.
- **Config files:** Snake_case keys in JSON configs. Each mode has its own `config.<mode>.example.json`.
- **Module naming:** `snake_case` for Rust files and modules. PascalCase for Svelte components (`StatusTab.svelte`, `CaCard.svelte`).

## Testing Guidelines

- Rust unit tests live in the same file under `#[cfg(test)] mod tests`. Integration tests go in `<crate>/tests/`.
- `drive-relay/tests/drive_e2e.rs` covers Drive-mode relay end-to-end.
- Frontend: type-checked via `npm run check`. No unit test framework is currently configured.
- Apps Script: manual/edge-case test scripts in `assets/apps_script/tests/`.
- The tier-3 mipsel target is allowed to fail in CI (`continue-on-error: true`) — do not block releases on it.

## Commit & Pull Request Guidelines

- Use conventional commit prefixes: `fix:`, `feat:`, `chore:`, `docs:`, `refactor:`.
- Keep messages concise and imperative: `fix: preserve gzip handling in exit node path`.
- Link issues where applicable. Include screenshots or log snippets for UI or behavioral changes.
- Run `cargo fmt`, `cargo clippy`, and `cargo test` before pushing. CI will enforce these.

## Security & Configuration

- **Never commit** secrets, `auth_key` values, OAuth `client_id`/`client_secret`, generated certificates, or release artifacts. Use `config.*.example.json` files as templates.
- The MITM CA keypair is generated locally and never leaves the user's machine. Do not add key material to the repo.
- Dependencies are pinned carefully for cross-compile and security reasons (see `Cargo.toml` comments). Do not bump crates without checking tier-3 target compatibility and RUSTSEC advisories.
- Drive-mode OAuth is BYO — no compile-time credentials exist; users register their own Google Cloud client at runtime.
