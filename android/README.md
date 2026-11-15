# Native Android application

Independent Kotlin and Jetpack Compose application. `mobile/android/` still belongs to the preserved Flutter reference and is not used by this project.

Initial identity: `com.netsentry.app` (retained from Flutter). Initial source baseline: Android 8/API 26 minimum, compile/target API 35, JDK 17, Gradle 8.11.1, Android Gradle Plugin 8.9.2, Kotlin/Compose compiler 2.1.20. These pinned scaffold versions are a starting compatibility baseline, not a claim of current store-release eligibility; review target/build versions before distribution.

No Android Studio, SDK, emulator, Gradle distribution or dependencies have been installed or downloaded for this scaffold. No Gradle wrapper binary has been generated. Native compilation and device behavior remain unverified. With explicitly prepared tooling later, use Gradle 8.11.1 to generate/verify the wrapper and build `:app:assembleDebug`; do not run SDK provisioning commands now.

The starter screen reports setup is incomplete. It requests no permissions, makes no network requests and starts no monitoring. API access, capability collectors, secure authentication, background work and device controls are later phases. Signing is not configured; real-device acceptance remains pending.

The development package identifier matches Flutter, so installing both on one phone would replace/conflict with the other installation. Select a development application-ID suffix before side-by-side device testing.
