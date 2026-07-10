# Release and Documentation

## Current Release Flow

The current automated preparation flow is defined by `.github/workflows/prepare-release.yml`.

1. Dispatch it with an unused `X.Y.Z` version:

   ```sh
   gh workflow run prepare-release.yml -f version=X.Y.Z
   ```

2. The workflow creates `release/vX.Y.Z`, commits the version changes and changelog stub, pushes the branch, and opens a `release-prep` pull request.
3. Finish both halves of `docs/changelog/vX.Y.Z.md` on that branch and merge the PR.
4. From updated `main`, create and push tag `vX.Y.Z`.
5. `.github/workflows/release.yml` builds and publishes the GitHub release and associated images/assets.

`release-drafter.yml` maintains a draft release tagged `next`. The prepare workflow uses its merged-PR bullets to prefill the English changelog section.

## Version Surfaces

The prepare workflow updates:

- `Cargo.toml` package `rahgozar`
- root `Cargo.lock` entries for `rahgozar` and `rahgozar-desktop`
- `desktop/src-tauri/Cargo.toml`
- `desktop/src-tauri/tauri.conf.json`
- `android/app/build.gradle.kts` `versionName`
- Android `versionCode`, incremented by one
- `docs/changelog/vX.Y.Z.md`

`desktop/package.json` remains at its non-user-facing placeholder version by design.

`tunnel-node/Cargo.toml` has an independent crate version and is not changed by the prepare workflow. Published container/static-binary asset names and image tags are driven by the repository release tag.

`drive-wire` and `rahgozar-drive-relay` currently remain at version `0.1.0`.

## Release Workflow

A `v*` tag triggers `.github/workflows/release.yml`, which currently builds:

- CLI targets across Linux glibc/musl, macOS, Windows, Android-related architectures, and supported OpenWRT targets;
- native Tauri desktop bundles;
- universal and per-ABI Android APKs;
- static tunnel-node and Drive relay binaries for supported musl targets;
- multi-architecture tunnel-node container images;
- updater metadata and configured signatures.

The workflow can also be manually re-run against an existing release version without moving the protected tag. On that path it builds from the selected workflow ref/current main according to the workflow comments, so inspect the resulting commit provenance before treating replacement assets as identical to the tagged source.

## Changelog Format

Every new `docs/changelog/vX.Y.Z.md` is bilingual:

1. Persian section
2. A standalone `---`
3. Matching English section

Use `docs/maintainer/assets/changelog-template.md` as the structural starting point. Keep both language sections semantically aligned rather than treating one as a literal machine translation.

Do not modify already-published changelogs to describe later work; create the next version’s file.

## Documentation Map

- `README.md` — public overview and quick start.
- `docs/guide.md` / `guide.fa.md` — long-form user guide.
- `docs/android.md` / `android.fa.md` — Android setup and limitations.
- `docs/full-tunnel-setup.md` and `.fa.md` — Full Tunnel walkthrough.
- `docs/drive_mode.md` and `.fa.md` — Drive transport/relay walkthrough.
- `docs/drive_oauth_setup.md` and `.fa.md` — BYO OAuth setup.
- `docs/fronting-groups.md` — curated/pinned/camouflage fronting behavior.
- `docs/use-as-upstream.md` and `.fa.md` — Psiphon/xray/browser chaining.
- `tunnel-node/README.md` — tunnel-node deployment and protocol reference.
- `assets/*/README*.md` — deployment instructions for user-hosted assets.

Prefer paired English/Persian updates when changing a paired user guide. Verify commands, filenames, ports, configuration keys, and release assets against current source/workflows before copying older documentation.

Files named `docs/2026-*.md` are historical implementation plans/evidence notes, not current repository-wide rules.

## Security and Release Assets

Never place real values for these in source, documentation examples, logs, screenshots, or issue replies:

- Apps Script `AUTH_KEY` / client `auth_key`
- `TUNNEL_AUTH_KEY`
- Apps Script deployment IDs or URLs
- exit-node PSKs
- Drive OAuth client secrets or refresh tokens
- Drive relay private keys
- generated MITM CA private keys
- minisign/Tauri updater private keys
- VPS credentials

The Android `release.jks` is deliberately committed with a documented public password to preserve APK update identity. Do not replace or regenerate it casually: a signature change prevents installed users from upgrading in place.

The gitignored `assets/apps_script_obfsucated/` directory is generated output and is not a source of truth.
