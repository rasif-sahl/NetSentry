#!/usr/bin/env bash
set -euo pipefail
# Uses explicitly supplied standalone JVM tools; does not download or invoke Android tooling.
: "${KOTLINC:?Set KOTLINC to an existing Kotlin 2.1.20 compiler}"
: "${JAVA_HOME:?Set JAVA_HOME to an existing JDK 17}"
: "${JSON_JAR:?Set JSON_JAR to org.json 20250107 jar}"
: "${OKHTTP_JAR:?Set OKHTTP_JAR to OkHttp 4.12.0 jar}"
: "${OKIO_JAR:?Set OKIO_JAR to Okio JVM 3.6.0 jar}"
ANDROID_CLIENT_CP="$JSON_JAR:$OKHTTP_JAR:$OKIO_JAR"
ANDROID_CHECK_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_CHECK_TEMP="$(mktemp -d)"
trap 'rm -rf "$ANDROID_CHECK_TEMP"' EXIT
ANDROID_COMPILER_LIB="$(cd "$(dirname "$KOTLINC")/../lib" && pwd)"
"$KOTLINC" "$ANDROID_CHECK_ROOT"/android/app/src/main/java/com/netsentry/app/core/*.kt \
  "$ANDROID_CHECK_ROOT"/android/app/src/main/java/com/netsentry/app/data/{Api,Wire,ApplicationWire,FamilyWire,Repository}.kt \
  "$ANDROID_CHECK_ROOT"/android/test/PersonalChecks.kt "$ANDROID_CHECK_ROOT"/android/test/AdvancedChecks.kt "$ANDROID_CHECK_ROOT"/android/test/FamilyChecks.kt -cp "$ANDROID_CLIENT_CP" -include-runtime -d "$ANDROID_CHECK_TEMP/checks.jar"
"$JAVA_HOME/bin/java" -cp "$ANDROID_CHECK_TEMP/checks.jar:$ANDROID_CLIENT_CP" PersonalChecksKt "$ANDROID_CHECK_TEMP/wire.json"
"$JAVA_HOME/bin/java" -cp "$ANDROID_CHECK_TEMP/checks.jar:$ANDROID_CLIENT_CP" AdvancedChecksKt "$ANDROID_CHECK_TEMP/app-usage.json"
"$JAVA_HOME/bin/java" -cp "$ANDROID_CHECK_TEMP/checks.jar:$ANDROID_CLIENT_CP" FamilyChecksKt
node "$ANDROID_CHECK_ROOT/android/scripts/check-applications.mjs" "$ANDROID_CHECK_TEMP/app-usage.json"
node "$ANDROID_CHECK_ROOT/android/scripts/check-contracts.mjs" "$ANDROID_CHECK_TEMP/wire.json"
"$KOTLINC" "$ANDROID_CHECK_ROOT/android/test/SyntaxChecks.kt" -cp "$ANDROID_COMPILER_LIB/kotlin-compiler.jar" -include-runtime -d "$ANDROID_CHECK_TEMP/syntax.jar"
"$JAVA_HOME/bin/java" -cp "$ANDROID_CHECK_TEMP/syntax.jar:$ANDROID_COMPILER_LIB/*" SyntaxChecksKt "$ANDROID_CHECK_ROOT/android/app/src/main/java"
