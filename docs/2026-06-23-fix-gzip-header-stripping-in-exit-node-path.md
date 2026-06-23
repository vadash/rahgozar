Evidence from read-only diagnostics:
- Local SOCKS proxy reproduces the corruption with `https://httpbin.org/gzip`: response body starts with gzip magic bytes (`1F 8B`) but the forwarded headers do not include `Content-Encoding: gzip`.
- Direct exit-node probe reproduces the bad contract for `Accept-Encoding: identity`: `exit-us.obscura.qzz.io` returns gzip bytes (`1F 8B`) with no `Content-Encoding` header.
- Direct exit-node probe with `Accept-Encoding: gzip` returns plain JSON, and Apps Script chained to exit-node also returns plain JSON for that case, so Apps Script raw wrapping is not the primary culprit.
- `wrapper.ts` is only the runtime adapter; the bad observable behavior is the exit-node path delivering encoded bytes after the encoding header has been stripped.

Fix plan:
1. Add regression tests in `src/domain_fronter.rs` for `parse_exit_node_response` covering gzip-compressed body bytes with `Content-Encoding: gzip`.
2. Update `parse_exit_node_response` so gzip is decode-or-preserve, not assume-plain-and-strip:
   - if `Content-Encoding` is gzip and `decode_gzip(&body_bytes)` succeeds, replace body with decoded bytes and strip `Content-Encoding`;
   - if gzip decoding fails, preserve `Content-Encoding` so the client/browser can decode rather than receiving garbled bytes as plaintext.
3. Keep existing brotli/zstd behavior and `allow_brotli_zstd` policy intact.
4. Run focused Rust tests for `domain_fronter`, then the relevant project check/test command available in this repo.
5. Report the exact files changed and note that rebuilding the local binary is required; if the deployed exit-node asset is also stripping headers incorrectly, we will separately verify whether `assets/exit_node/exit_node.ts` needs a matching deploy-side adjustment before recommending redeploy.