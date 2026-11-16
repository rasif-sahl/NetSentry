# Named-network monitoring and router boundary

Phase 10 source: 16 November 2026. Hardware compatibility remains unverified.

## Separate grants and consent

An active, verified workspace owner/admin pairs a network-enabled Go agent, creates a named network with one to eight RFC1918 IPv4 prefixes (/8–/30), and explicitly assigns up to twenty collectors. Each agent can collect one named network at a time. The desktop user must separately choose that network UUID and accept `network-sharing-v1`. The network module flag alone starts no discovery and retrieves no router credential. CIDR scope is operator-configured and does not verify SSID or physical LAN identity; pause sharing before moving between networks with overlapping prefixes and validate roaming before unattended deployment. Developer sharing and process-control consent are independent.

Every configuration and snapshot checks the owning user's current role, account, membership, agent credential, module, generation and named grant. Workspace operations serialize on the existing workspace lock; agent operations also lock the installation. Configuration revisions invalidate old snapshots. Pause acknowledgements clear current sightings/interfaces, including when local sharing is already off; historical observations require separate erasure. In-flight requests cannot undo already received history. Revocation/role loss immediately makes current views unavailable; re-enrolment requires new local consent and a new grant.

## Passive IPv4 observations

macOS reads numeric `/sbin/route -n get default`, `/usr/sbin/arp -an` and local interfaces. Linux reads `/proc/net/route`, `/proc/net/arp` and interfaces. There is no active probe, reverse DNS, packet capture, Wi-Fi credential reading or port scan. Existing ARP caches are incomplete and potentially stale. IPv6, Windows discovery, Linux production secret storage/service packaging and router hardware coverage are unavailable or pending. Tests use parser inputs and injected discovery in `_test.go`, never the real LAN.

Interface/gateway and at most 128 neighbors per frame stay inside the explicit private prefixes. MAC observations merge only within that named network; address-only observations remain source-specific. Randomized/changing MACs may produce separate endpoints. Hostname and manufacturer remain unknown rather than guessed. An enrolled device or person is never inferred from an IP/MAC. Person/device associations are operator labels, validated within the workspace, and confer no permission. Department workflows remain Phase 13. Trusted/blocked labels do not enforce access.

Current sightings expire after 120 seconds and require a source report within 150 seconds and heartbeat within 90 seconds. Absence is `not_recently_observed`, never asserted offline. Repeated same-address observations within 120 seconds form an observed span; gaps or address changes begin another span. This history represents cache evidence, not confirmed sessions. The dashboard exposes the latest 100 spans and 100 events, with capture times and source IDs. Inventory is capped at 2,000 endpoints/site and persists until erasure. Observed spans are capped at 100,000/site; spans whose last observation is older than thirty days expire. A still-active span can retain its original first-observed timestamp.

A private latest-only pending snapshot survives a lost acknowledgement. The runner obtains current configuration before retrying exactly the same ID/payload; records older than eighty seconds or a changed network/generation/revision are replaced. The server accepts at most ninety seconds of age/five seconds future skew and rejects altered replay. Diagnostic offline buffering is separate. Long offline LAN history is deliberately not replayed as live presence. Pending snapshots contain observations, never router passwords; unpair/re-enrol/revocation erases them.

## Initial router protocol candidate

| Adapter | Protocol and authentication | Implemented features | Evidence |
| --- | --- | --- | --- |
| `openwrt-ubus-v1` / `1.0.0` | OpenWrt rpcd/uhttpd JSON-RPC v2, short-lived ubus session, verified HTTPS | WAN logical-interface state/uptime, device RX/TX counters, optional board model/firmware | Synthetic TLS/RPC fixtures; no model or firmware certified |

The adapter uses only `session.login`, optional `system.board`, `network.interface.<configured-name>.status`, `network.device.status` for a validated returned device name, and `session.destroy`. It never executes shell commands, reads router files or changes interfaces/firewall configuration. Provision a dedicated read-only ACL for those methods. Login and status failures identify authentication/TLS/unsupported/unavailable states; no speculative authentication fallback is attempted. Optional board permission does not prevent counters from working.

The router address must be an explicit private IPv4 HTTPS `/ubus` URL inside the named network and a discovered local interface. No hostnames, redirects, inherited proxies, query/fragment/userinfo, HTTP or insecure TLS are permitted. Use system trust or an explicitly supplied PEM CA; certificate verification stays enabled. The backend stores configuration but never contacts that private address. TLS tests retain production certificate verification and redirect only a test socket to a loopback server.

Credentials use AES-256-GCM with a fresh nonce, router-ID-bound associated data and an independent base64 32-byte `ROUTER_CREDENTIAL_ENCRYPTION_KEY` held outside the database. Missing/changed keys fail closed; reconfigure credentials after a key change. Public reads and personal exports exclude passwords, ciphertext and CA material. Only the currently assigned, authenticated collector receives the decrypted credential, over its outbound HTTPS connection. Other collectors can contribute inventory but cannot upload that router's counters. Operator compatibility records include model, firmware, adapter version, authentication, features, test date, limitations and feedback; they cannot grant access or certify hardware.

Connection tests queue a UUID for one collector with a ninety-second deadline. Only a fresh matching report can mark success/failure. Pending, expired and unreachable states are distinct from success.

## Measurements, events and operation

Raw counters and deltas are exact unsigned decimal strings. Deltas require one source/router revision, advancing time, monotonic counters/uptime and a gap of at most five minutes. First observations, resets, gaps and revision changes create no measured usage. Unavailable observations have null counters/state. Whole confirmed intervals produce totals; hourly buckets use interval end time. Coverage/missing durations are explicit. Approximate bit rates and peak cover the latest sixty samples inside the chosen UTC range; no measured interval means an unavailable peak. No per-device traffic is inferred. WAN interface/API health does not prove public internet access.

New endpoints, address changes/conflicts, router authentication/unavailability/recovery, WAN interface loss, counter resets, source loss/recovery and policy/inventory edits create events. Users with alert handling permission can review severity and acknowledgement. These are in-dashboard alerts, not provider push/email deliveries or intrusion detection. Network viewers can read; only network managers can change collection/router/inventory. Business assignment follows Phase 13.

Apply migration twelve explicitly. Schedule `npm --prefix backend run networks:work -- <workspace-uuid>` with the deployment's trusted scheduler at least once a minute. It marks missing collectors and removes at most 1,000 rows from each thirty-day history table per run; run additional batches after long downtime. No scheduler is installed automatically. Each router has a 100,000-sample cap. Current views calculate freshness even if maintenance is late, but timely retention/health events need the worker.

Deleting a collector's data erases its samples, spans, sightings, source events, grants and assigned credentials. Endpoint provenance removes only that source; independently observed endpoints survive. Network erasure cascades monitoring records and secrets while preserving the independent manual usage label. Endpoint erasure can be rediscovered while collection remains enabled. Workspace/account deletion uses existing cascades plus source-aware erasure. Stop collection before permanent inventory erasure when rediscovery is unwanted.

Protocol references: [OpenWrt ubus](https://openwrt.org/docs/techref/ubus), [OpenWrt network scripting](https://openwrt.org/docs/techref/netifd).
