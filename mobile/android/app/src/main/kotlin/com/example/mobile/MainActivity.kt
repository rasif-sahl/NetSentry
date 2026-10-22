package com.netsentry.app

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.Process
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "netsentry/capabilities",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "inspect" -> result.success(inspectCapabilities())
                else -> result.notImplemented()
            }
        }
    }

    private fun inspectCapabilities(): Map<String, Any> {
        val manufacturer = Build.MANUFACTURER
            .replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        return mapOf(
            "platform" to "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
            "deviceName" to "$manufacturer ${Build.MODEL}",
            "usageAccessGranted" to hasUsageAccess(),
            // Standard Android applications cannot reliably access these values.
            "hotspotClientListAvailable" to false,
            "tetheringTrafficAvailable" to false,
        )
    }

    private fun hasUsageAccess(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                packageName,
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}
