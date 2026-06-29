# Tunnel Node Guidelines

## Scope

These instructions apply to `tunnel-node/`. The root `AGENTS.md` still applies for repository-wide conventions.

## Project Shape

- `tunnel-node` is a standalone Rust crate, not a member of the root Cargo workspace.
- Keep the empty `[workspace]` table in `Cargo.toml`; it intentionally opts this directory out of the root workspace so `cargo` commands work from inside `tunnel-node/`.
- The main binary is `src/main.rs`; native udpgw protocol handling lives in `src/udpgw.rs`.
- `Cargo.lock` is local to this crate and should stay in sync with dependency changes.
- The Dockerfile is a supported build/deployment path for Cloud Run and VPS installs.

## Local Commands

Run these from `tunnel-node/` unless noted otherwise:

```sh
cargo fmt -- --check
cargo test
cargo clippy --all-targets -- -D warnings
cargo build --release
docker build -t tunnel-node .
```

For a local smoke run:

```sh
TUNNEL_AUTH_KEY=dev-secret PORT=8080 cargo run
curl http://127.0.0.1:8080/health
```

On Windows PowerShell:

```powershell
$env:TUNNEL_AUTH_KEY='dev-secret'; $env:PORT='8080'; cargo run
```

## Implementation Notes

- Preserve wire compatibility with Apps Script `CodeFull.gs` clients. Changes to op names, JSON field names, response shapes, EOF behavior, batch handling, base64 encoding, or error codes are protocol changes and need matching client/script updates.
- Treat timing constants as production knobs. Long-poll, straggler settle, TCP drain, queue, and response-size limits are tuned around Apps Script latency, quota, and response caps; document the reason when changing them.
- Keep session cleanup conservative. Avoid dropping buffered TCP/UDP data when EOF, response-budget caps, or batch drains interact.
- Maintain authenticated-only behavior for tunnel operations. Do not log `TUNNEL_AUTH_KEY` or request bodies that may contain user payload bytes.
- `udpgw` magic destination constants must stay coordinated with Android/tun2proxy behavior. Keep tests that pin the current and legacy magic IPs when changing that path.
- Avoid adding heavy dependencies; the tunnel-node release path targets small VPS/Cloud Run deployments and static Linux artifacts.

## Testing Guidance

- Add focused unit tests beside changed Rust code under `#[cfg(test)] mod tests`.
- For protocol behavior, prefer tests that construct JSON requests and drive the Axum handlers directly, matching the existing style in `src/main.rs`.
- For udpgw changes, include frame parser/serializer round-trip tests and destination/magic-IP regression tests where relevant.
- If a change affects deployment or environment variables, update `README.md` and verify the Docker build path still works.

## Security And Deployment

- Never commit real `TUNNEL_AUTH_KEY` values, Cloud Run secrets, VPS credentials, or generated release artifacts.
- Keep `/health` simple and unauthenticated; keep tunnel endpoints protected by the shared key.
- Be careful with logs: include enough context for operators, but avoid payload data and secrets.
- When changing dependencies or release settings, consider Linux `amd64`/`arm64`, musl/static builds, and Cloud Run compatibility.
