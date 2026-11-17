package com.netsentry.app.monitoring

import android.app.AppOpsManager
import android.app.usage.NetworkStatsManager
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import com.netsentry.app.data.UsageReading
import com.netsentry.app.data.UsageSource
import com.netsentry.app.data.json
import org.json.JSONObject

/**
 * Device-wide aggregate OS statistics only; never infer tethered clients or read subscriber IDs.
 */
class AndroidUsageSource(private val context: Context) : UsageSource {
    override fun granted(): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java) ?: return false
        val mode =
            if (Build.VERSION.SDK_INT >= 29)
                ops.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName,
                )
            else
                @Suppress("DEPRECATION")
                ops.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName,
                )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @Suppress("DEPRECATION")
    override fun read(start: Long, end: Long): List<UsageReading> {
        require(end > start)
        return listOf(
                "mobile_data_bytes" to ConnectivityManager.TYPE_MOBILE,
                "wifi_data_bytes" to ConnectivityManager.TYPE_WIFI,
            )
            .map { (metric, type) ->
                if (!granted())
                    UsageReading(
                        metric,
                        null,
                        "Usage access is denied or revoked; no zero was fabricated.",
                        "permission_unavailable",
                    )
                else
                    try {
                        val manager =
                            context.getSystemService(NetworkStatsManager::class.java)
                                ?: return@map UsageReading(
                                    metric,
                                    null,
                                    "OS statistics service is unavailable.",
                                )
                        val bucket = manager.querySummaryForDevice(type, null, start, end)
                        if (bucket == null || bucket.rxBytes < 0 || bucket.txBytes < 0)
                            UsageReading(metric, null, "OS accounting is temporarily unavailable.")
                        else {
                            val total = Math.addExact(bucket.rxBytes, bucket.txBytes)
                            if (total > 9_007_199_254_740_991L)
                                UsageReading(metric, null, "OS total exceeds the supported range.")
                            else
                                UsageReading(
                                    metric,
                                    total,
                                    "OS NetworkStats aggregate; interval attribution is estimated. Physical-device accuracy remains unverified.",
                                )
                        }
                    } catch (_: SecurityException) {
                        UsageReading(
                            metric,
                            null,
                            "Android denied this statistics scope; review usage access.",
                            "permission_unavailable",
                        )
                    } catch (_: Exception) {
                        UsageReading(
                            metric,
                            null,
                            "OS statistics query failed; the interval is missing.",
                        )
                    }
            }
    }

    override fun applications(
        start: Long,
        end: Long,
        checkpoint: com.netsentry.app.core.UsageCheckpoint?,
    ) = AndroidApplicationUsage(context).read(start, end, checkpoint)

    override fun metadata(): JSONObject {
        val power = context.getSystemService(PowerManager::class.java)
        return json(
            "applicationVersion" to "0.9.0",
            "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}".take(100),
            "operatingSystemVersion" to
                "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})".take(100),
            "batteryOptimizationStatus" to
                if (power?.isIgnoringBatteryOptimizations(context.packageName) == true)
                    "unrestricted"
                else "restricted",
        )
    }

    fun usageSettings(): Intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)

    fun batterySettings(): Intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)

    fun wirelessSettings(): Intent = Intent(Settings.ACTION_WIRELESS_SETTINGS)
}
