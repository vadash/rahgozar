# Full Tunnel v2 Protocol Design

Status: design only; no implementation has started.

This document specifies a clean-break replacement for the current Full Tunnel protocol used by:

1. the rahgozar PC client;
2. `assets/apps_script/CodeFull.gs` deployed as a Google Apps Script web app;
3. the optional-but-required-for-Full-Tunnel `tunnel-node` running on a VPS.

There is intentionally no wire compatibility with the current protocol. All three production components must be upgraded together. The design optimizes reliable interactive web browsing and messaging first, then useful throughput, then censorship resistance. It does not attempt to compete with a directly reachable xray/sing-box H3 or QUIC transport; Google Apps Script makes that impossible.

## 1. Executive decisions

The production path remains:

```text
PC rahgozar
    -> domain-fronted TLS/HTTP2 to Google
Google Apps Script (CodeFull.gs)
    -> HTTPS request/response
VPS tunnel-node
    -> ordinary destination TCP
Internet
```

The principal v2 change is reliable, acknowledged delivery in both directions. Constructing an Apps Script response must no longer mean that the corresponding destination bytes are permanently consumed. The tunnel node retains downstream chunks until the PC acknowledges that they were written to the local application. Uploads, opens, polls, closes, and whole batches are idempotent.

Other decisions:

- TCP is the v2 baseline. UDP, SOCKS5 `UDP ASSOCIATE`, QUIC forwarding, games, and real-time voice are deferred. Browser QUIC remains blocked so applications fall back to HTTPS over TCP.
- Apps Script remains an opaque authenticated forwarder. It does not parse session operations, DNS packets, or compressed inner payloads.
- JSON remains the data model. Large inner envelopes are zstd-compressed and base64 encoded; a new binary serialization format is not introduced.
- Multiple Apps Script deployments from independent Google accounts are treated as alternative paths to the same tunnel node. The client uses health- and latency-aware selection and may safely hedge slow requests.
- A PC + Apps Script deployment can run protocol diagnostics without a tunnel node, but cannot provide a transparent Full Tunnel. Adding an HTTP-only MITM/fetch relay to v2 would create a second product with different security and compatibility behavior and would exceed the approximately 10% complexity budget. The existing `apps_script` mode remains the separate answer for that use case.
- Detailed structured logs and correlation identifiers are part of the protocol contract, not an afterthought.

## 2. Why the chain cannot be reduced to two production components

Apps Script provides buffered web-app invocations and `UrlFetchApp.fetch()`. It does not provide:

- arbitrary outbound TCP or UDP sockets;
- a CONNECT proxy;
- a listening socket;
- WebSocket upgrade or a persistent bidirectional stream;
- server push to the PC;
- control over HTTP/3 or QUIC;
- durable per-client in-memory execution between unrelated invocations.

Consequently, PC -> Apps Script can directly relay independent HTTP requests, as the existing `apps_script` mode does, but it cannot carry arbitrary end-to-end TCP while preserving the destination's real TLS connection. An HTTP-only fallback would require local TLS interception, certificate installation, HTTP parsing, request reconstruction, special handling for streaming, and failure behavior for certificate-pinned applications and WebSockets. That is not a smaller Full Tunnel; it is a separate mode.

The v2 two-component feature is therefore limited to a self-test endpoint. It proves that the PC can reach and authenticate to the deployment, measures the Google leg, checks request/response integrity and padding, and reports that the tunnel node is absent. It must never silently claim that Internet traffic is protected when only the diagnostic path works.

## 3. Goals and non-goals

### Goals

- Never lose or duplicate TCP bytes because an Apps Script response was delayed, dropped, truncated, retried, or delivered out of order.
- Recover safely from ambiguous failures by resending the same operation through the same or a different Apps Script account.
- Keep fresh HTTPS startup at its theoretical minimum for an end-to-end TLS tunnel: normally two Apps Script turns before the first application response.
- Maintain enough concurrent requests to hide the roughly two-second Apps Script round-trip and provide useful interactive throughput.
- Bound all queues, replay state, decompression, session state, and logging volume.
- Make failures attributable to the PC-to-Google leg, Apps Script execution, Apps-Script-to-node leg, tunnel-node state, destination dial, or destination TCP stream.
- Make the normal deployment difficult to identify from plaintext server responses and reasonably resistant to simple size-distribution fingerprinting.
- Keep CodeFull.gs small, stateless, and straightforward to test.

### Non-goals

- Compatibility with v1 clients, CodeFull.gs deployments, or tunnel nodes.
- QUIC-like latency or throughput.
- Real UDP support in the initial v2 implementation.
- Seamless continuation of destination TCP sessions after a tunnel-node process restart. Once the process and its sockets are gone, applications must reconnect.
- Hiding destinations or traffic contents from Google as a trust boundary. The PC-to-destination TLS stream protects HTTPS contents, but Google still operates the relay leg and observes timing, sizes, the tunnel-node URL, and encrypted application bytes.
- Making an HTTP tunnel node publicly reachable from the PC. The local censor may block the VPS; only Apps Script needs to reach it.
- Constant cover traffic. It consumes Apps Script execution and daily fetch quotas too quickly.

## 4. Constraints learned from the current implementation

The current system already contains several ideas that v2 should preserve conceptually:

- HTTP/2 multiplexing from the PC to Google's edge, with HTTP/1.1 fallback.
- Up to 30 concurrent Apps Script executions per Google account.
- Per-deployment concurrency pools with capacity reserved for active traffic rather than idle polls.
- Multiple batches in flight and adaptive per-session pipeline depth.
- `connect_data`, which sends a client's first TLS bytes with the destination connect and saves one Apps Script turn.
- Monotonic upload ordering (`wseq`) so batches may finish out of order without corrupting destination TCP.
- Request sequence numbers so downstream replies can be reordered at the PC.
- zstd compression negotiated through the current capability field.
- Exact-batch replay caching for a limited class of ambiguous TCP failures.
- Long polling at the tunnel node, bounded response sizes, bounded upload reordering, DNS caching, destination TCP prewarming, and concurrent destination dials.
- Random request padding, Google SNI rotation, Google-IP health checks, automatic deployment blacklisting, and detailed failure classification.

The remaining correctness gap is that downstream bytes are drained while the response is constructed. Exact response replay reduces this risk but remains temporary and depends on the client retrying the exact same batch before the replay entry expires. V2 makes acknowledgements and retained chunks the primary correctness model; exact batch replay becomes an optimization.

Other hard constraints:

- Apps Script request and response bodies are text-oriented, so arbitrary bytes require base64 or another text encoding.
- `UrlFetchApp` is request/response only and has daily and concurrent-execution quotas.
- Apps Script fetch bodies have a practical ceiling below the nominal 50 MB limit. V2 stays far below it.
- A fresh end-to-end HTTPS connection normally needs two relay turns: ClientHello -> server handshake, followed by client Finished/request -> first application response. Eliminating the second turn would require TLS interception or destination-specific prediction.
- QUIC over this polling transport stacks QUIC congestion control over an HTTP/TCP relay and performs badly. It should be blocked rather than tunneled.

## 5. Protocol layers

V2 has three deliberately separate layers:

1. **Google transport:** domain-fronted HTTPS from PC to Apps Script, preferably HTTP/2.
2. **Outer relay envelope:** small JSON parsed by Apps Script for version, authentication, request identity, size validation, diagnostics, and forwarding.
3. **Inner tunnel batch:** JSON understood only by the PC and tunnel-node, optionally zstd-compressed and base64 encoded.

Apps Script must not inspect or splice tunnel operations. Removing edge-DNS parsing and other operation-specific behavior keeps the relay auditable and prevents its JavaScript model from constraining future node/client behavior.

## 6. Identifiers and counters

All random identifiers use cryptographically secure random bytes encoded as unpadded base64url.

| Name | Size | Scope | Purpose |
|---|---:|---|---|
| `request_id` | 96 bits | One outer HTTP request | Correlates PC, GS, and node logs; identical for a hedge/retry of the same batch attempt family |
| `attempt_id` | 64 bits | One transmitted attempt | Distinguishes the primary attempt from hedges and retries |
| `batch_id` | 128 bits | One immutable inner batch | Idempotence and exact-response coalescing |
| `open_id` | 128 bits | One requested destination connection | Makes destination connection creation idempotent |
| `session_id` | 128 bits | One node-side TCP session | Identifies the destination TCP connection |
| `node_instance_id` | 96 bits | One tunnel-node process lifetime | Lets the PC detect a restart immediately |

Per-session counters start at zero:

- `write_seq`: one number per PC-to-destination upload chunk.
- `poll_seq`: one number per downstream poll slot. Multiple poll slots may be in flight.
- `read_seq`: one number per destination-to-PC data chunk.
- `read_ack`: highest contiguous `read_seq` successfully written to the local application. `-1` means none.
- `write_ack`: highest contiguous `write_seq` accepted and written to the destination TCP socket. `-1` means none.

Counters are unsigned 64-bit integers on the wire except the two acknowledgement sentinels, which are signed integers so `-1` is explicit. Counter exhaustion closes the session with `COUNTER_EXHAUSTED`; it is not wrapped.

## 7. Outer relay envelope

### PC to Apps Script

```json
{
  "v": 2,
  "auth": "CLIENT_SECRET",
  "request_id": "base64url",
  "attempt_id": "base64url",
  "encoding": "json-or-zstd",
  "payload": "base64-standard",
  "pad": "random-base64"
}
```

Rules:

- `v` must equal `2`.
- `auth` is compared in constant-time-equivalent application logic where practical. It is never forwarded to the tunnel node.
- `payload` always contains bytes encoded with standard base64. With `encoding: "json"`, the decoded bytes are UTF-8 inner JSON. With `encoding: "zstd"`, they are a zstd frame whose decompressed value is UTF-8 inner JSON.
- Compression is mandatory when uncompressed inner JSON is at least 1 KiB and optional below that threshold. This avoids expanding tiny control messages.
- Decompressed inner JSON is capped at 4 MiB.
- Encoded outer request size is capped at 6 MiB, including padding.
- `pad` is ignored. By default its decoded size is uniformly random from zero through 25% of the encoded payload size, capped at 256 KiB. Operators may disable it only after measuring an ISP-specific improvement.
- Unknown outer fields are rejected. A clean-break protocol benefits more from catching version skew than from permissive parsing.

### Apps Script to tunnel-node

Apps Script validates the client envelope, replaces `auth` with the independent `TUNNEL_SECRET`, and forwards the same `v`, identifiers, encoding, and payload:

```json
{
  "v": 2,
  "auth": "TUNNEL_SECRET",
  "request_id": "base64url",
  "attempt_id": "base64url",
  "encoding": "json-or-zstd",
  "payload": "base64-standard"
}
```

Padding is not forwarded. It protects the censor-visible PC-to-Google size distribution and need not waste bandwidth on the hidden second leg.

### Tunnel-node response

```json
{
  "v": 2,
  "request_id": "base64url",
  "attempt_id": "base64url",
  "node_instance_id": "base64url",
  "encoding": "json-or-zstd",
  "payload": "base64-standard",
  "node_ms": 14
}
```

Apps Script passes the response payload through unchanged and adds relay timing:

```json
{
  "v": 2,
  "request_id": "base64url",
  "attempt_id": "base64url",
  "node_instance_id": "base64url",
  "encoding": "json-or-zstd",
  "payload": "base64-standard",
  "node_ms": 14,
  "gs_fetch_ms": 207,
  "gs_total_ms": 214
}
```

Timing fields are diagnostic and must not participate in replay fingerprints.

### Decoy behavior

- Missing or wrong client authentication returns the same small decoy HTML and HTTP status as an unknown route.
- Missing or wrong tunnel-node authentication also returns a decoy response unless node diagnostic mode is explicitly enabled.
- Detailed errors are carried only inside authenticated protocol responses.
- Production configuration must not expose stack traces, secret lengths, expected versions beyond the authenticated response, or whether a supplied key was close to correct.

## 8. Inner batch request

```json
{
  "batch_id": "base64url",
  "client_time_ms": 1780000000000,
  "ops": [
    { "type": "open", "open_id": "...", "host": "example.com", "port": 443, "data": "..." },
    { "type": "exchange", "session_id": "...", "poll_seq": 3, "read_ack": 5,
      "write_seq": 2, "data": "...", "max_read_bytes": 262144, "wait_ms": 350 },
    { "type": "close", "session_id": "...", "reason": "client_eof" },
    { "type": "probe", "nonce": "..." }
  ]
}
```

Limits:

- At most 50 operations.
- At most 4 MiB decompressed inner JSON.
- At most 64 KiB decoded upload bytes per `open` or `exchange` operation.
- At most one upload chunk per session in one batch.
- At most one operation for a given `(session_id, poll_seq)` in one batch.
- Hostnames are normalized to lower-case ASCII using the same IDNA policy at both client and node. IP literals are allowed. Ports must be 1 through 65535.

Operation order inside a batch does not imply execution order across different sessions. Operations for one session are governed only by their explicit counters.

## 9. Inner batch response

```json
{
  "batch_id": "base64url",
  "server_time_ms": 1780000000214,
  "results": [
    { "ok": true, "type": "open", "open_id": "...", "session_id": "...",
      "write_ack": 0, "chunks": [{ "read_seq": 0, "data": "..." }] },
    { "ok": true, "type": "exchange", "session_id": "...", "poll_seq": 3,
      "write_ack": 2, "chunks": [{ "read_seq": 6, "data": "..." }], "eof_after": null },
    { "ok": true, "type": "close", "session_id": "..." },
    { "ok": true, "type": "probe", "nonce": "..." }
  ]
}
```

- Results correspond one-for-one and in the same array order as request operations.
- A result is either `ok: true` or contains the structured error described later.
- Response payload is capped at 4 MiB decompressed. The node fairly divides the remaining byte budget among sessions rather than allowing one download to consume the whole response.
- Each returned chunk is at most 64 KiB decoded.
- `eof_after` is either `null` or the final `read_seq`. EOF is delivered only after all preceding bytes have sequence numbers. The PC closes its local read side only when every chunk through `eof_after` has been written contiguously.

## 10. TCP session state machine

### Open

1. The PC creates `open_id` and sends `open` with the destination and, when available, the initial TLS ClientHello in `data`.
2. The node checks its open registry.
3. If `open_id` is new, it resolves/dials the destination, creates a random `session_id`, treats initial data as `write_seq = 0`, and records the mapping.
4. If the same `open_id` is retried, the node returns the same session and never creates a second destination connection.
5. If a repeated `open_id` changes host, port, or initial-data digest, the node closes the associated session and returns `REPLAY_MISMATCH`.
6. The node may wait briefly for destination response bytes and include them as initial read chunks.

Open registry entries live for the session lifetime plus 60 seconds, bounded globally. Completed failed opens are cached for 15 seconds so a hedge does not repeatedly hammer an unreachable destination.

### Upload

- The PC splits local bytes into chunks no larger than 64 KiB and assigns consecutive `write_seq` values.
- The client retains chunks until `write_ack` confirms they were written to the destination socket.
- The node writes the next expected sequence immediately.
- Future sequences are buffered up to 32 chunks and 4 MiB per session, then flushed in order as gaps arrive.
- A sequence below the next expected value is a duplicate and is acknowledged without being written again.
- The node retains a digest for the most recent 64 accepted upload chunks. A duplicate in this window with different data closes the session with `REPLAY_MISMATCH`.
- Exceeding the reorder limit closes the session with `UPLOAD_GAP_LIMIT`. Silently dropping an upload is forbidden.

### Download and acknowledgement

- The node's reader task divides destination bytes into immutable chunks no larger than 64 KiB and assigns consecutive `read_seq` values.
- Chunks remain in a per-session deque until acknowledged.
- Every exchange carries the PC's highest contiguous `read_ack` written to the local socket.
- The node drops chunks at or below a valid acknowledgement and releases any poll-response references to them.
- An acknowledgement beyond the highest sequence ever issued closes the session with `ACK_INVALID`.
- The PC discards duplicate read chunks but validates that their digest/length matches any still-retained local metadata.
- The PC does not advance `read_ack` merely after parsing a response. It advances only after the bytes have been successfully written to the local application in sequence.

This acknowledgement rule is the central v2 invariant.

### Multiple downstream polls

Multiple `poll_seq` values may be in flight to hide Apps Script latency.

- The node keeps a bounded mapping from `poll_seq` to the read-sequence range assigned to that poll.
- Retrying a `poll_seq` reconstructs the same logical result from retained chunks.
- A new `poll_seq` receives the next unassigned chunks. Empty results do not permanently reserve a read range.
- The PC reorders results by `read_seq`, not HTTP completion order.
- Poll mappings are released after all referenced chunks are acknowledged or after session closure.
- At most eight unresolved poll mappings are allowed per session. The initial scheduler uses one at idle, three during HTTPS startup, and up to six during sustained active transfer.

### Close and EOF

- `close` is idempotent.
- Client write EOF should first flush all pending upload chunks, then send `close` with `reason: "client_eof"` and half-close the destination write side when supported.
- Destination EOF is represented by `eof_after`; it is not an unsequenced boolean attached to an arbitrary response.
- A full close result remains replayable for 60 seconds.
- Idle sessions close after five minutes by default. Sessions blocked by unacknowledged client data close after a separate two-minute stalled-client timeout.

### Node restart

Every authenticated response includes `node_instance_id`. If it changes, the PC immediately fails all old sessions with a clear `NODE_RESTARTED` reason and lets applications reconnect. It must not spend multiple Apps Script turns probing session IDs that cannot exist in the new process.

## 11. Batch idempotence, retries, and hedging

The node maintains a bounded batch registry keyed by `batch_id` and a fingerprint of the immutable inner request.

- First arrival becomes the owner and processes the batch.
- A concurrent duplicate waits for the owner and receives the same encoded logical response.
- A completed duplicate receives the cached response.
- Reuse of a `batch_id` with a different fingerprint returns `REPLAY_MISMATCH` and is never processed.
- Registry TTL is 60 seconds.
- Limits are 4096 entries and 64 MiB of encoded responses by default.
- Registry eviction cannot break byte correctness because per-session upload deduplication and downstream acknowledgement remain authoritative.

The PC retry policy:

1. Retry only ambiguous transport failures, timeouts, truncated responses, and authenticated `RETRY_BATCH` errors.
2. Reuse the exact `batch_id`, inner payload, and `request_id`; generate a new `attempt_id`.
3. Prefer a different healthy Google account for the retry or hedge.
4. Never automatically retry authentication, version, malformed-envelope, replay-mismatch, or invalid-ack errors.
5. If all attempts fail, retain unacknowledged upload chunks and read acknowledgements while the session remains within its failure budget. The next batch may resend safely.

Hedging is optional and quota-aware:

- No hedge is sent before the deployment has enough samples to estimate latency; the cold-start default threshold is three seconds.
- Learned hedge delay is `p95 batch RTT + 250 ms`, clamped to 1.5 through 5 seconds.
- At most one hedge per batch.
- Hedges must use a deployment from a different Google account.
- Hedging is limited to 5% of batches over a rolling ten-minute window unless the primary path is in an active failure state.
- Disable hedging when remaining quota is low or fewer than two independent accounts are healthy.

## 12. Scheduler and performance policy

Each configured deployment belongs to an explicit account group. Multiple deployment IDs from the same Google account share one 30-execution pool and must not be counted as independent capacity.

The client records per account/deployment:

- active requests;
- rolling p50, p95, and EWMA RTT;
- transport timeout rate;
- authenticated GS and node error rate;
- last success;
- circuit-breaker state;
- quota errors and optional reported remaining quota;
- HTTP/2 versus HTTP/1.1 transport use.

Selection uses the lowest healthy cost, combining queue depth, RTT, and recent failure penalty. A small exploration fraction probes recovered deployments. Plain round-robin is not used.

Priority classes, highest first:

1. open with initial data and TLS-handshake continuation;
2. upload carrying interactive application bytes;
3. active downstream poll;
4. close/control;
5. idle downstream poll.

Batching defaults:

- Handshake/control maximum coalescing delay: 25 ms.
- Interactive maximum coalescing delay: 75 ms.
- Bulk coalescing delay: adaptive from 100 to 500 ms.
- Fire immediately at 50 operations or 4 MiB decoded inner size.
- Reserve six of each account's 30 executions for non-idle work.
- Idle polls never queue ahead of active work.

The scheduler begins sessions at three unresolved polls, drops to one after consecutive empty replies, and may rise to six after consecutive data-bearing replies. Exact constants should be benchmark-tunable but bounded by these protocol limits.

## 13. Flow control and resource limits

Default tunnel-node limits:

| Resource | Default behavior |
|---|---|
| Sessions | 4096 global; reject new opens when full |
| Unacknowledged download | 8 MiB per session; 256 MiB global |
| Out-of-order uploads | 32 chunks and 4 MiB per session |
| Unresolved poll mappings | 8 per session |
| Batch request/response | 4 MiB decompressed each |
| Operations per batch | 50 |
| Upload/read chunk | 64 KiB decoded |
| Long-poll wait | 4 seconds maximum; active writes use a shorter 350 ms drain window |
| Destination dial | 10 seconds |
| Session idle timeout | 5 minutes |
| Stalled unacknowledged client | 2 minutes |

When the download buffer is full, the destination reader pauses and lets TCP backpressure reach the destination. It never drops bytes to make room. When the global limit is reached, new sessions are rejected before existing sessions are sacrificed.

All limits must be configurable on the node but advertised in the authenticated `probe` result so the client can avoid exceeding them.

## 14. Compression and padding

- Use zstd because both Rust components already support it and Apps Script can forward it opaquely.
- Use one conservative compression level chosen for low CPU latency; do not negotiate levels.
- Do not compress inner JSON below 1 KiB.
- Reject concatenated frames, excessive window declarations, trailing garbage, and output over 4 MiB.
- Base64 overhead remains unavoidable on the Apps Script text envelope.
- Random PC-to-Google padding stays enabled by default. Padding is generated independently for every attempt, including hedges, and is excluded from fingerprints.
- Do not pad GS-to-node traffic.
- Do not implement constant-rate cover traffic, fake sessions, or expensive decoy fetches in v2.

## 15. Two-component diagnostics

CodeFull.gs exposes an authenticated diagnostic operation that it handles without a tunnel node. It uses the same outer envelope but a reserved outer `diagnostic` field rather than an inner batch.

The diagnostic response includes:

- protocol version;
- echoed nonce and request/attempt IDs;
- hash and decoded length of the submitted test payload;
- Apps Script execution time;
- whether the deployment constants appear configured;
- whether the tunnel-node URL is syntactically valid;
- optional result of a separately requested node health probe.

The PC CLI should expose this as a leg-by-leg test:

```text
PC -> Google TLS       OK, h2, 183 ms handshake
Google -> Apps Script  OK, deployment account-a, 412 ms
Payload integrity      OK, 65536 bytes, hash matched
Apps Script -> node    SKIPPED or FAILED, explicit reason
Full Tunnel            NOT AVAILABLE without tunnel-node
```

This feature is intentionally not a direct Internet fetch proxy. It exists to isolate deployment, authentication, fronting, padding, body-size, and ISP response-truncation problems while only the PC and GS are running.

## 16. Error model

Every authenticated operation error has this shape:

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_UNKNOWN",
    "message": "short safe diagnostic",
    "retry": "reconnect",
    "scope": "session"
  }
}
```

`retry` is one of `batch`, `session`, `reconnect`, or `never`. The client follows the code, not free-form message text.

Required stable codes:

| Code | Scope | Retry | Meaning |
|---|---|---|---|
| `AUTH_CLIENT` | request | never | PC-to-GS secret rejected; normally hidden behind decoy |
| `AUTH_NODE` | request | never | GS-to-node secret rejected; normally hidden behind decoy |
| `BAD_VERSION` | request | never | Not protocol v2 |
| `BAD_ENVELOPE` | request | never | Invalid outer fields, base64, or size |
| `BAD_COMPRESSION` | request | never | Invalid or excessive zstd payload |
| `BAD_BATCH` | batch | never | Invalid inner schema or limits |
| `GS_FETCH_FAILED` | batch | batch | Apps Script could not reach the node |
| `GS_FETCH_TIMEOUT` | batch | batch | Node fetch exceeded the GS budget |
| `NODE_OVERLOADED` | batch | batch | Global node capacity reached |
| `NODE_RESTARTED` | session | reconnect | Node instance changed |
| `DNS_FAILED` | open | reconnect | Destination name resolution failed |
| `CONNECT_TIMEOUT` | open | reconnect | Destination dial timed out |
| `CONNECT_REFUSED` | open | reconnect | Destination refused the connection |
| `SESSION_UNKNOWN` | session | reconnect | Session does not exist |
| `SESSION_IDLE` | session | reconnect | Idle timeout closed the session |
| `UPLOAD_GAP_LIMIT` | session | reconnect | Too many out-of-order uploads |
| `ACK_INVALID` | session | never | Client acknowledged unsent downstream data |
| `REPLAY_MISMATCH` | request/session | never | Identifier reused with different immutable data |
| `BUFFER_LIMIT` | session | session | Stalled client exhausted its bound |
| `DESTINATION_IO` | session | reconnect | Destination TCP failed |
| `COUNTER_EXHAUSTED` | session | reconnect | Sequence number exhausted |
| `INTERNAL` | relevant scope | batch | Unexpected server error with a correlation ID |

## 17. Logging and observability

Logs are structured key/value records even when rendered as human-readable text. Every component uses the same field names where applicable.

Common fields:

- timestamp, level, component, event;
- request ID, attempt ID, batch ID;
- deployment label and account group;
- shortened session/open ID;
- node instance ID;
- operation count, encoded/decoded bytes, padding bytes;
- queue wait, Google RTT, GS total, GS fetch, node processing, destination dial, and end-to-end milliseconds;
- HTTP version, selected Google IP, selected SNI, retry number, hedge flag;
- stable error code, retry policy, and state transition.

Privacy and secret rules:

- Never log authentication keys, full deployment IDs, full session IDs, complete URLs, payloads, certificates, or user configuration.
- At info level, destination host is a keyed hash plus port and coarse category. Plain hostname is allowed only at debug level after an explicit privacy warning.
- Log only the first eight safe characters of random IDs in normal text output; structured diagnostic bundles may contain full non-secret correlation IDs.

Level policy:

- `TRACE`: per-chunk state transitions and scheduler choices; disabled normally.
- `DEBUG`: every batch and session transition with timings.
- `INFO`: startup configuration summary, successful preflight, deployment health changes, node instance changes, session summary on close, and periodic aggregate metrics. Do not log every successful batch at info.
- `WARN`: retry, hedge, circuit breaker, quota pressure, slow batch, destination failure, and bounded resource pressure.
- `ERROR`: authentication/configuration mismatch, replay mismatch, invalid acknowledgement, invariant violation, or exhausted recovery.

Each session keeps a bounded in-memory ring of its last 64 state transitions. On abnormal close, the PC writes that ring as one diagnostic event. This gives detailed failure context without permanently logging every successful chunk.

Periodic metrics, emitted every 60 seconds:

- active/opened/closed sessions by reason;
- batches, operations, hedges, retries, and exact replay hits;
- per-deployment RTT percentiles and errors;
- uploaded, downloaded, retained, and retransmitted bytes;
- upload reorder depth and download acknowledgement lag;
- node session count and global buffer usage;
- Apps Script quota estimates where available;
- HTTP/2 connection resets and HTTP/1 fallback use.

The PC diagnostic bundle should combine recent client logs, redacted configuration, deployment metrics, node instance ID, protocol limits, and the PC+GS self-test. Node logs remain server-side but can be correlated by request ID.

## 18. Security and censorship posture

- PC-to-Google uses normal TLS with HTTP/2 when available, domain-fronted using a healthy Google IP and SNI pool.
- GS-to-node must use HTTPS on port 443 in production. Plain HTTP is diagnostic-only.
- Bind tunnel-node to localhost behind Caddy or another TLS reverse proxy. The reverse proxy is deployment infrastructure, not a fourth logical protocol component.
- Keep unauthenticated responses indistinguishable from an unused web endpoint.
- Use separate client and tunnel-node secrets.
- Keep random padding enabled unless measured otherwise.
- Rotate only proven Google SNI/IP candidates and use health scoring rather than random blind rotation.
- Do not attempt to tunnel browser QUIC. Block UDP/443 so browsers use TCP.
- Prefer blocking browser DoH so the browser uses the system/virtual DNS path; tunnelling a separate DoH TCP connection adds another relay startup penalty.
- Traffic shaping cannot make this identical to ordinary browsing: sustained bidirectional POST traffic to Google remains observable through timing and sizes. V2 aims to avoid trivial fixed-length signatures, not to promise unobservability against a global active adversary.

## 19. Testing strategy

Testing is a first-class deliverable. V2 is not complete until the fault matrix passes.

### Pure model and property tests

Build a small deterministic reference model of one session and generate operation sequences including:

- duplicate, missing, delayed, and reordered upload chunks;
- duplicate, missing, delayed, and reordered poll responses;
- acknowledgements before, at, and beyond valid boundaries;
- simultaneous primary and hedged batches;
- EOF mixed with final data;
- closes and retries at every state;
- counter and buffer boundaries.

Properties:

- destination-observed upload bytes equal local-client bytes exactly once and in order;
- local-client-observed download bytes equal destination bytes exactly once and in order;
- acknowledged download bytes are never needed again;
- unacknowledged download bytes are never discarded silently;
- memory never exceeds configured bounds;
- retries do not create additional destination connections for one `open_id`;
- any terminal failure is explicit and classified.

Use property-based testing for thousands of generated schedules and persist minimal failing seeds.

### Parser and envelope tests

- Fuzz outer and inner JSON parsers.
- Invalid/missing/unknown fields.
- Base64 edge cases.
- zstd bombs, oversized windows, truncated/concatenated frames, and trailing data.
- Maximum operations, payload, padding, hostname, and error-message lengths.
- Request/batch/open identifier reuse with altered payloads.
- Authentication and decoy behavior without observable differentiation.

### Tunnel-node unit tests

- Idempotent open, exchange, poll, acknowledgement, close, and batch registry.
- Out-of-order upload buffering and caps.
- Downstream retention until acknowledgement.
- Multiple poll assignments and replay after partial acknowledgement.
- TCP backpressure when buffers fill.
- Destination EOF sequencing.
- Node restart/instance behavior.
- Fair response-budget division across sessions.
- Cleanup of all registries and buffers after normal and abnormal closure.

### Apps Script tests

Standalone Node-based tests execute CodeFull.gs with mocked Apps Script services:

- client authentication and decoy responses;
- exact opaque forwarding;
- secret replacement and non-forwarding of padding;
- request and response size enforcement;
- timing field insertion without payload mutation;
- node timeout/error mapping;
- local PC+GS diagnostic operation;
- no operation-specific parsing in GS.

### Client scheduler tests

Use paused/deterministic time and fake deployments:

- account-aware 30-request limits;
- priority and idle reservation;
- deployment scoring, exploration, circuit opening, and recovery;
- learned hedge thresholds and 5% hedge budget;
- quota-aware hedge suppression;
- response reordering and acknowledgement only after local writes;
- HTTP/2 failure and HTTP/1 fallback;
- node instance change invalidating sessions immediately.

### Three-component integration tests

Run client, a local CodeFull-compatible relay harness, and tunnel-node with a programmable fault proxy. Inject faults before and after every processing boundary:

- drop request before GS, after GS, before node, and after node processing;
- drop or truncate response after node drains/assigns data;
- delay attempts so hedges win or lose;
- duplicate and reorder requests;
- kill and restart tunnel-node;
- pause destination reads and writes;
- return malformed GS HTML and quota-style responses;
- blackhole one deployment while others remain healthy.

Validate byte-perfect transfers with randomized bidirectional streams and hashes, not just HTTP status checks.

### Real Apps Script canary tests

These require test Google accounts and are separate from deterministic CI:

- one and four independent account deployments;
- real HTTP/2 and forced HTTP/1 paths;
- cold and warm Apps Script execution;
- request sizes around compression and padding thresholds;
- sustained browsing-style concurrency;
- tail-latency hedging and daily call cost;
- ISP/network tests for Google IP/SNI reachability and response truncation.

### Performance acceptance criteria

Compare v2 with the current implementation using the same PC, Google accounts, VPS, and destinations:

- zero byte corruption or silent loss under the entire fault suite;
- no more than 10% lower warm interactive throughput in the no-fault case;
- equal or better median fresh HTTPS first-byte time;
- materially lower p95/p99 completion time with four accounts and controlled single-path delays;
- bounded node memory at configured limits;
- hedges at or below the 5% steady-state budget;
- no more than 10% implementation complexity growth for the core TCP path, measured using reviewed state-machine branches and maintained test surface rather than raw line count alone.

If acknowledged multi-poll delivery exceeds that complexity target, reduce the maximum unresolved polls before weakening acknowledgement correctness. Correctness is mandatory; peak throughput is negotiable.

## 20. Implementation boundaries

Expected protocol-sensitive areas when implementation eventually begins:

- `src/tunnel_client.rs`: scheduler, session state, acknowledgements, retransmission, logging, and diagnostic command.
- `src/domain_fronter.rs`: v2 outer transport, deployment/account metrics, hedging, padding, and HTTP/2 fallback.
- `assets/apps_script/CodeFull.gs`: small authenticated opaque relay and local diagnostic operation.
- `tunnel-node/src/main.rs`: v2 parsing, session state, retained read chunks, idempotence registries, flow control, errors, and metrics.

CodeFull.gs should become smaller than its current Full Tunnel implementation because it no longer parses DNS or tunnel operations. No new shared crate is required initially; canonical JSON fixtures and a prose wire specification are sufficient. Introduce a shared Rust wire crate only if duplicated client/node types measurably cause drift.

## 21. Delivery order for a future coding session

1. Freeze this specification and create canonical JSON/base64/zstd fixtures.
2. Implement the deterministic session reference model and property tests before production state machines.
3. Implement tunnel-node v2 against the model, including fault-oriented unit tests.
4. Replace CodeFull.gs with the opaque relay and complete its mocked-service tests.
5. Implement the PC client session state and local fake-relay integration tests.
6. Add account-aware scheduling and hedging only after single-path correctness passes.
7. Add structured logs, session trace rings, metrics, and the PC+GS diagnostic flow.
8. Run the full programmable-fault integration matrix.
9. Deploy isolated real Apps Script canaries and benchmark one versus four accounts.
10. Publish all three production components as one intentionally incompatible v2 release with a new setup guide.

## 22. Final recommendation

Do not replace the current architecture with a nominally different protocol such as H3, QUIC, WebSocket, or gRPC while Apps Script is mandatory. Those transports cannot pass transparently through the Apps Script execution model.

The best-value v2 is a TCP-first, acknowledged, idempotent byte-stream protocol carried in opaque batched HTTP requests. Its main benefit is correctness under ambiguous Apps Script failures; safe multi-account hedging and better tail latency follow from that correctness. Keep the Apps Script layer deliberately boring, keep UDP out until evidence demands it, provide a strong two-component diagnostic rather than a misleading two-component VPN, and require exhaustive fault testing before release.
