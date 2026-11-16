#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Use only an already-installed host compiler. Never run xcode-select, installers,
# package managers, xcodebuild or any simulator/device tooling here.
SWIFTC_BIN="${SWIFTC:-/Library/Developer/CommandLineTools/usr/bin/swiftc}"
if [ ! -x "$SWIFTC_BIN" ]; then SWIFTC_BIN="$(command -v swiftc || true)"; fi
if [ ! -x "$SWIFTC_BIN" ]; then echo 'Existing Swift host compiler required; no tooling installed.' >&2; exit 1; fi
WORK="$(mktemp -d "${TMPDIR:-/tmp}/netsentry-ios-core.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
EXTRA=()
ARGS=(-swift-version 5 -module-cache-path "${SWIFT_MODULE_CACHE_PATH:-${TMPDIR:-/tmp}/netsentry-ios-swift-module-cache}")
if [ "$(uname -s)" = Darwin ]; then
  EXTRA+=(ios/NetSentry/Security/KeychainVault.swift)
  HOST_SDK="${SWIFT_HOST_SDK:-/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk}"
  if [ -d /Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk ] && [ -z "${SWIFT_HOST_SDK:-}" ]; then HOST_SDK=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk; fi
  if [ ! -d "$HOST_SDK" ] && [ -z "${SWIFT_HOST_SDK:-}" ]; then
    for CANDIDATE in /Applications/Xcode*.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk; do
      if [ -d "$CANDIDATE" ]; then HOST_SDK="$CANDIDATE"; break; fi
    done
  fi
  if [ ! -d "$HOST_SDK" ]; then echo 'Set SWIFT_HOST_SDK to an existing macOS host SDK; no SDK is installed by this script.' >&2; exit 1; fi
  ARGS+=(-sdk "$HOST_SDK" -target "$(uname -m)-apple-macosx15.0")
fi
"$SWIFTC_BIN" "${ARGS[@]}" -parse-as-library ios/NetSentry/Core/*.swift "${EXTRA[@]}" ios/Tests/CoreChecks.swift -o "$WORK/core-checks"
"$WORK/core-checks" "$WORK"
node ios/scripts/check-emitted.mjs "$WORK"
if [ -n "${IOS_LIVE_OUTPUT:-}" ]; then
  "$SWIFTC_BIN" "${ARGS[@]}" -parse-as-library ios/NetSentry/Core/*.swift ios/Tests/LiveChecks.swift -o "$IOS_LIVE_OUTPUT"
fi
