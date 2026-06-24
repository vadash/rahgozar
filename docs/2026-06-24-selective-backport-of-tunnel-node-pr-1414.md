Implement a selective backport of PR #1414 into this repo's `tunnel-node`, preserving local differences like DNS cache and TCP prewarming.

Plan:
1. Update `tunnel-node/src/main.rs`:
   - Add `AtomicUsize` import.
   - Add `sid_short` and shared `DECOY_404_BODY` helper/const.
   - Add `drain_notify` and `buf_len` to `SessionInner`, initialize them in all constructors and tests.
   - Add `pkt_count` to `UdpSessionInner`, initialize it in constructors/tests.
   - Change `reader_task` backpressure from implicit unlimited buffering to event-driven waiting on `drain_notify`, and update `buf_len` while holding the `read_buf` lock to avoid the race noted in the PR review.
   - Update `drain_now` and `wait_and_drain` to store `buf_len` after draining and notify waiting readers.
   - Update `udp_reader_task` and `drain_udp_now` to maintain `pkt_count` while holding the packet queue lock.
   - Change the straggler settle loop to read `buf_len` and `pkt_count` atomics instead of locking all queues.
   - Move stale TCP/UDP session aborts in `cleanup_task` outside the global map locks.
   - Apply small cleanup pieces where they do not conflict: shared decoy body and `sid_short` logging.

2. Update `tunnel-node/src/udpgw.rs`:
   - Make `DstAddr::to_socket_addr` async.
   - Replace blocking `std::net::ToSocketAddrs` with `tokio::net::lookup_host`.
   - Await address resolution in `handle_frame`.
   - Add the 256 KiB accumulation-buffer cap on repeated incomplete/corrupt frames.
   - Add `#[allow(dead_code)]` only if local compile/test state requires it for magic constants.

3. Preserve local behavior:
   - Do not remove this repo's existing DNS cache/TCP prewarm path in `tunnel-node/src/main.rs`.
   - Do not blindly overwrite local code from the other branch, adapt only the equivalent optimization changes.

4. Verify:
   - Run `cargo fmt --all -- --check` first to catch formatting drift after edits.
   - Run `cd tunnel-node && cargo test`.
   - If feasible within time, run `cargo clippy -p tunnel-node --all-targets -- -D warnings` or the closest package-specific clippy command that matches this workspace.
   - Fix any diagnostics caused by the backport.