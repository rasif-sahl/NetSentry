# Phase 10 — Wi-Fi networks and router integrations

Implemented on `develop`, 16 November 2026. No Android Studio, mobile SDK, emulator, simulator or Xcode installation. Flutter remains a reference. Kotlin/Swift mobile screens are unchanged; later native phases consume the shared API.

## Implemented source

- Named private IPv4 networks, multiple explicitly assigned collectors and independent desktop consent.
- Passive macOS/Linux gateway/interface/ARP-cache readers, bounded private snapshot retry and source-aware identity/presence history.
- Versioned OpenWrt ubus read-only adapter; verified HTTPS, optional trusted CA, private-IP scope, bounded responses/timeouts and no inherited proxy/redirect.
- AES-GCM router credential storage, assigned-agent-only retrieval, connection-test requests/results and a compatibility evidence registry with adapter version.
- Inventory labels/category/trust/notes/archive, workspace-validated person/device hooks, current observation timestamps and bounded historical spans.
- Exact WAN counter deltas, baselines/reset/gap handling, coverage/history and approximate recent peaks. Router API and WAN link state are distinct from internet reachability.
- Inventory/authentication/health event review with severity/acknowledgement, bounded thirty-day maintenance and source-aware erasure/export.
- Web network workflows and Electron React consent controls through authenticated local IPC v5.

## Verification

The checks below use explicit synthetic observations or loopback fixtures, never a real LAN/router. See [network architecture](../architecture/network-monitoring.md) for limits and operator setup.

- Root checks: scaffold paths, 109 OpenAPI operations/13 synthetic fixtures, 17 contract tests, Android emitted-contract regression, 44 backend unit tests, backend/desktop/dashboard production builds, dashboard lint.
- PostgreSQL: twelve migrations, entity/schema parity, rollback, baseline adoption, constraints/cascades, live API requests and response schemas.
- Network API integration: grant/default isolation, credential encryption and assigned-only retrieval, out-of-scope HTTPS rejection, exact counters above JavaScript's safe integer range, duplicate/altered replay, multi-source MAC/address handling, reset/gap/auth events, pending test expiry, current-role withdrawal, label/association validation, maintenance and multi-source erasure.
- Test-only compiled Go runner against actual NestJS/PostgreSQL: current named configuration, synthetic passive collection, deliberately lost acknowledgement and byte-identical replay accepted once. Production binaries have no fixture-discovery switch.
- Go: vet/race tests, passive parser fixtures (including macOS unpadded MACs), private prefix bounds, verified TLS/CA, fixed read-only RPC sequence/session cleanup, uint64 precision, permission failure, malformed/oversized response, redirect and certificate rejection, default-off consent, retry and withdrawal. Windows/no-Keychain builds are compile checks only.
- Desktop: TypeScript/production renderer build and Node-to-Go authenticated IPC v5, strict wire schemas and independent network/developer settings; existing controlled shutdown regressions remain checked. Full Electron packaged runtime/Keychain installation remains pending.
- Browser: 23 scenarios against real API/PostgreSQL and installed desktop Chrome, including synthetic network inventory labels, password field treatment, viewer restrictions and existing account/device/developer/report flows. Browser data is not router evidence.

## Pending physical and operational validation

No router model or firmware is certified. The initial support matrix contains one **protocol candidate**, `openwrt-ubus-v1` / `1.0.0`, with fixture-only evidence. Authorized OpenWrt hardware must verify rpcd ACL/session behavior, private HTTPS certificates/CA provisioning, logical WAN/device mapping, board fields, interface statistics, restart/rollover, sampling gaps, measured-byte accuracy and disconnect/reconnect. Router-wide counters do not establish per-client usage.

Passive cache completeness, macOS/Linux interface/route behavior on actual supported hosts, VPN/multiple-interface transitions, permissions, sleep/wake, battery/load, long outages, service startup and packaging need physical-host checks. Windows discovery and Linux production credential-store/service support remain unavailable. Department/family profile assignments and enforcement stay in their planned phases. Hostnames/OUI manufacture guesses, IPv6, packet inspection, internet probing, per-device bandwidth and device blocking are not implemented.

Schedule `networks:work` per workspace at least once a minute and repeat bounded cleanup after downtime; the repository does not install a scheduler. Retention depends on this worker. Review public HTTPS, the independent router encryption key, read-only router accounts and backup/restore key custody before deployment. Changing the key requires reconfiguring credentials. Native mobile builds and physical-device tests remain pending, with no mobile tool installation authorized.
