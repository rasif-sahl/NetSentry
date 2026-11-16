#!/usr/bin/env bash
set -euo pipefail
# Uses explicitly supplied standalone JVM tools; does not download or invoke Android tooling.
: "${KOTLINC:?Set KOTLINC to an existing Kotlin 2.1.20 compiler}"
: "${JAVA_HOME:?Set JAVA_HOME to an existing JDK 17}"
: "${JSON_JAR:?Set JSON_JAR to org.json 20250107 jar}"
ANDROID_CHECK_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_CHECK_TEMP="$(mktemp -d)"
trap 'rm -rf "$ANDROID_CHECK_TEMP"' EXIT
ANDROID_COMPILER_LIB="$(cd "$(dirname "$KOTLINC")/../lib" && pwd)"
"$KOTLINC" "$ANDROID_CHECK_ROOT"/android/app/src/main/java/com/netsentry/app/core/*.kt \
  "$ANDROID_CHECK_ROOT"/android/app/src/main/java/com/netsentry/app/data/{Api,Wire,Repository}.kt \
  "$ANDROID_CHECK_ROOT"/android/test/PersonalChecks.kt -cp "$JSON_JAR" -include-runtime -d "$ANDROID_CHECK_TEMP/checks.jar"
"$JAVA_HOME/bin/java" -cp "$ANDROID_CHECK_TEMP/checks.jar:$JSON_JAR" PersonalChecksKt "$ANDROID_CHECK_TEMP/wire.json"
node "$ANDROID_CHECK_ROOT/android/scripts/check-contracts.mjs" "$ANDROID_CHECK_TEMP/wire.json"
"$KOTLINC" "$ANDROID_CHECK_ROOT/android/test/SyntaxChecks.kt" -cp "$ANDROID_COMPILER_LIB/kotlin-compiler.jar" -include-runtime -d "$ANDROID_CHECK_TEMP/syntax.jar"
"$JAVA_HOME/bin/java" -cp "$ANDROID_CHECK_TEMP/syntax.jar:$ANDROID_COMPILER_LIB/*" SyntaxChecksKt "$ANDROID_CHECK_ROOT/android/app/src/main/java"
