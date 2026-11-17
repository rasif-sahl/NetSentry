package com.netsentry.app.monitoring

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.UserManager
import com.netsentry.app.core.TimelineReducer
import com.netsentry.app.core.UsageCheckpoint
import com.netsentry.app.core.UsageEvent
import com.netsentry.app.data.ApplicationMetadata
import com.netsentry.app.data.ApplicationObservation

/** No installed-app enumeration, QUERY_ALL_PACKAGES, accessibility service or hidden API. */
class AndroidApplicationUsage(private val context: Context) {
    @Suppress("DEPRECATION")
    fun read(start: Long, end: Long, checkpoint: UsageCheckpoint?): ApplicationObservation {
        val permission = AndroidUsageSource(context).granted()
        if (
            !permission || context.getSystemService(UserManager::class.java)?.isUserUnlocked != true
        )
            return ApplicationObservation(TimelineReducer.unavailable(start, end), emptyList())
        try {
            val manager =
                context.getSystemService(UsageStatsManager::class.java)
                    ?: return ApplicationObservation(
                        TimelineReducer.unavailable(start, end),
                        emptyList(),
                    )
            val stream =
                manager.queryEvents(start, end)
                    ?: return ApplicationObservation(
                        TimelineReducer.unavailable(start, end),
                        emptyList(),
                    )
            val events = mutableListOf<UsageEvent>()
            val event = UsageEvents.Event()
            var scanned = 0
            var activityIdentity = Build.VERSION.SDK_INT >= 29
            while (stream.hasNextEvent()) {
                if (++scanned > 5000)
                    return ApplicationObservation(
                        TimelineReducer.unavailable(start, end, "event_limit"),
                        emptyList(),
                    )
                if (!stream.getNextEvent(event))
                    return ApplicationObservation(
                        TimelineReducer.unavailable(start, end),
                        emptyList(),
                    )
                val type =
                    when (event.eventType) {
                        1 -> "resumed" // MOVE_TO_FOREGROUND / ACTIVITY_RESUMED share the public
                        // constant.
                        2 -> "paused"
                        15 -> if (Build.VERSION.SDK_INT >= 28) "interactive" else "ignore"
                        16 -> if (Build.VERSION.SDK_INT >= 28) "non_interactive" else "ignore"
                        17 -> if (Build.VERSION.SDK_INT >= 28) "locked" else "ignore"
                        18 -> if (Build.VERSION.SDK_INT >= 28) "unlocked" else "ignore"
                        26 -> if (Build.VERSION.SDK_INT >= 29) "shutdown" else "ignore"
                        27 -> if (Build.VERSION.SDK_INT >= 29) "startup" else "ignore"
                        else -> "ignore"
                    }
                if (
                    Build.VERSION.SDK_INT >= 29 &&
                        type in setOf("resumed", "paused") &&
                        event.instanceId == 0
                )
                    activityIdentity = false
                if (type != "ignore")
                    events.add(
                        UsageEvent(
                            event.timeStamp,
                            type,
                            event.packageName ?: "",
                            if (Build.VERSION.SDK_INT >= 29) event.instanceId.toString()
                            else event.className ?: "unknown",
                        )
                    )
            }
            val result =
                TimelineReducer.reduce(
                    start,
                    end,
                    events,
                    checkpoint,
                    Build.VERSION.SDK_INT >= 28,
                    activityIdentity,
                )
            val ids =
                (result.sessions.map { it.applicationId } +
                        result.launches.map { it.applicationId })
                    .distinct()
                    .take(32)
            val metadata =
                ids.map { id ->
                    try {
                        val info = context.packageManager.getApplicationInfo(id, 0)
                        val category =
                            mapOf(
                                0 to "game",
                                1 to "audio",
                                2 to "video",
                                3 to "image",
                                4 to "social",
                                5 to "news",
                                6 to "maps",
                                7 to "productivity",
                                8 to "accessibility",
                            )[info.category] ?: "unknown"
                        val label =
                            context.packageManager
                                .getApplicationLabel(info)
                                .toString()
                                .filterNot { it.isISOControl() }
                                .take(100)
                                .ifBlank { null }
                        ApplicationMetadata(id, label, category)
                    } catch (_: Exception) {
                        ApplicationMetadata(id, null, "unknown")
                    }
                }
            return ApplicationObservation(result, metadata)
        } catch (_: Exception) {
            return ApplicationObservation(TimelineReducer.unavailable(start, end), emptyList())
        }
    }
}
