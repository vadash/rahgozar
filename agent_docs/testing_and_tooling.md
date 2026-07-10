# Testing and Tooling

## Toolchains

- Rust packages use edition 2021. Release workflows install current stable Rust.
- Desktop CI uses Node 24. `desktop/.nvmrc` pins `24`; `desktop/package.json` permits Node 22 or newer.
- Android compiles for Java/JVM 17 with Android Gradle Plugin 8.7.3, Gradle 8.11.1, compile/target SDK 35, and minimum SDK 24.
- Android release builds require the Android SDK/NDK, `cargo-ndk`, and the four Rust Android targets.
- The optional repository hook installer requires Bash, curl, Java, and a SHA-256 utility.

## Rust Workspace

Run from the repository root:

```sh
cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo build --workspace
```

The workspace command covers the root package, Tauri Rust backend, `drive-wire`, and `drive-relay`. It does not cover the standalone `tunnel-node`.

Useful focused commands:

```sh
cargo test -p rahgozar
cargo test -p rahgozar-desktop
cargo test -p drive-wire
cargo test -p rahgozar-drive-relay
cargo test -p rahgozar-drive-relay --test drive_e2e
cargo build --features pipeline-debug
```

Most Rust unit tests are beside their implementation under `#[cfg(test)]`. `drive-relay/tests/drive_e2e.rs` is the principal Rust integration test.

## Desktop

Run from `desktop/`:

```sh
npm ci
npm run check
npm run build
npm run tauri dev
npm run tauri build
```

`npm run check` runs `svelte-check`; `npm run build` builds the static Vite frontend. There is currently no frontend unit-test framework in `desktop/package.json`.

`npm run tauri build` invokes the configured frontend build and then produces native bundles. Linux additionally needs the WebKitGTK/Tauri system libraries installed by `.github/workflows/release.yml`.

## Tunnel Node

`tunnel-node` is independent of the root workspace. Run from `tunnel-node/`:

```sh
cargo fmt -- --check
cargo test
cargo clippy --all-targets -- -D warnings
cargo build --release
docker build -t tunnel-node .
```

Tests for HTTP/batch/session behavior are in `src/main.rs`; udpgw parser, serializer, and destination tests are in `src/udpgw.rs`.

## Android

Run from `android/`:

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleRelease
```

Use `gradlew.bat` on a native Windows shell.

The JVM unit-test task does not build the Rust/JNI libraries. `assembleRelease` invokes `cargoBuildRelease`, which runs `cargo ndk` for all four shipped ABIs before packaging the APKs.

Android tests live under `android/app/src/test/` and cover configuration round-trips, curated groups, profiles, updates, notifications, discovery parsing, and VPN lifecycle guards.

For an Android-target Rust compile check equivalent to release CI:

```sh
cargo ndk -t arm64-v8a check -p rahgozar --lib
```

## Apps Script and Obfuscation

The Apps Script tests are standalone Node programs with no aggregate package script:

```sh
node assets/apps_script/tests/auth_guard_test.js
node assets/apps_script/tests/edge_dns_test.js
node assets/apps_script/tests/edge_dns_batch_test.js
node assets/apps_script/tests/perf_test.js
```

The root Node package exists for Apps Script obfuscation:

```sh
npm ci
npm run obfuscate
```

The obfuscator reads `Code.cfw.gs`, `Code.gs`, and `CodeFull.gs`, generates ten variants of each, and writes them under the intentionally named and gitignored `assets/apps_script_obfsucated/` directory.

## Repository Hooks

Run once per clone from a Bash environment:

```sh
scripts/install-hooks.sh
```

This configures `scripts/git-hooks/pre-commit`, which:

- rejects staged private-config/signing-key filename patterns;
- scans staged content for common secret formats;
- runs `rustfmt --check` on staged Rust files;
- runs pinned ktlint 1.8.0 on staged Kotlin files when its cached jar is available.

The hook is local and bypassable; it is not a replacement for the full validation commands.

## CI Reality

`.github/workflows/release.yml` runs on `v*` tags and manual re-dispatch. It cross-builds and packages release artifacts, performs an Android-target Rust compile check, builds the Gradle release APKs, builds Tauri bundles, and publishes tunnel-node images.

The current workflows do not run the complete workspace `cargo test`, `cargo fmt`, or `cargo clippy` suites, and the desktop release job does not run `npm run check`. Run relevant checks locally before merging or tagging.

The OpenWRT `mipsel-unknown-linux-musl` build is explicitly best-effort with `continue-on-error`; its failure does not block the other release artifacts.
