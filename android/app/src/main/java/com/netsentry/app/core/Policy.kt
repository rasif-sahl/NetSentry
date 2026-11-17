package com.netsentry.app.core

import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatterBuilder
import java.util.UUID

/** Platform-free decisions, shared by UI and worker. No Android authority inferred here. */
object Policy {
    const val MAX_QUEUE = 48
    const val QUEUE_AGE_MS = 7 * 86_400_000L
    const val MAX_ATTEMPTS = 8
    private val utc = DateTimeFormatterBuilder().appendInstant(3).toFormatter()

    fun timestamp(ms: Long): String = utc.format(Instant.ofEpochMilli(ms))

    fun apiBase(value: String): String {
        val uri = URI(value.trim())
        require(uri.scheme == "https" && !uri.host.isNullOrBlank()) { "Use an HTTPS API address." }
        require(uri.userInfo == null && uri.rawQuery == null && uri.rawFragment == null)
        require(uri.path.trimEnd('/') == "/api/v1") { "The API address must end with /api/v1." }
        require(uri.port == -1 || uri.port in 1..65535)
        return uri.toASCIIString().trimEnd('/')
    }

    fun uuid(value: String): String {
        require(UUID.fromString(value).toString() == value.lowercase())
        return value
    }

    fun retryDelay(attempt: Int): Long = minOf(300_000L, 1_000L shl attempt.coerceIn(0, 8))

    fun retained(createdAt: Long, now: Long): Boolean =
        createdAt <= now && now - createdAt <= QUEUE_AGE_MS

    fun interval(cursor: Long, now: Long): LongRange? {
        // Delay two minutes for OS accounting. No pre-consent backfill or overlapping intervals.
        val end = now - 120_000L
        return if (cursor > 0 && end > cursor) cursor..minOf(end, cursor + 86_400_000L) else null
    }

    fun reportDates(period: String, timezone: String, now: Long): Pair<String, String> {
        val today = Instant.ofEpochMilli(now).atZone(ZoneId.of(timezone)).toLocalDate()
        val from =
            when (period) {
                "day" -> today
                "week" -> today.minusDays((today.dayOfWeek.value - 1).toLong())
                "month" -> today.withDayOfMonth(1)
                else -> error("Unsupported report period")
            }
        return from.toString() to today.plusDays(1).toString()
    }
}

data class RemoteIntent(
    val agentId: String,
    val serviceId: String,
    val observationId: String,
    val observedAt: Long,
    val mode: String,
    val includeChildren: Boolean,
    val childCount: Int,
    val requestId: String = UUID.randomUUID().toString(),
) {
    fun check(now: Long, canControl: Boolean, canStop: Boolean) {
        Policy.uuid(agentId)
        Policy.uuid(observationId)
        Policy.uuid(requestId)
        require(serviceId.matches(Regex("[a-f0-9]{64}")))
        require(mode == "graceful" || mode == "force")
        require(canControl && canStop) { "Current computer grants do not allow shutdown." }
        require(now >= observedAt && now - observedAt <= 10_000) {
            "Refresh and select a fresh service."
        }
        require(!includeChildren || childCount in 0..16) { "Too many captured descendants." }
    }
}

data class QueueStamp(
    val batchId: String,
    val generation: Int,
    val createdAt: Long,
    val attempts: Int,
) {
    fun eligible(currentGeneration: Int, enabled: Boolean, now: Long): Boolean =
        enabled &&
            currentGeneration == generation &&
            Policy.retained(createdAt, now) &&
            attempts < Policy.MAX_ATTEMPTS
}
