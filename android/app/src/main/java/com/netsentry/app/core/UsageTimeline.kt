package com.netsentry.app.core

/** Only event type, package and local activity identity are read. Activity identity never goes on the wire. */
data class UsageEvent(val at: Long, val type: String, val applicationId: String = "", val activity: String = "")
data class UsageSegment(val start: Long, val end: Long, val applicationId: String = "")
data class UsageLaunch(val at: Long, val applicationId: String)
data class UsageCheckpoint(
    val end: Long, val active: Map<String, String>, val lastExit: Map<String, Long>,
    val interactive: Boolean?, val unlocked: Boolean?, val appKnown: Boolean,
)
data class UsageTimeline(
    val sessions: List<UsageSegment>, val screen: List<UsageSegment>, val launches: List<UsageLaunch>,
    val appKnown: Boolean, val screenKnown: Boolean, val issues: List<String>, val checkpoint: UsageCheckpoint,
)
object TimelineReducer {
    private val packageId = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)+")
    fun reduce(start: Long, end: Long, events: List<UsageEvent>, previous: UsageCheckpoint?, screenApi: Boolean, activityIdentity: Boolean): UsageTimeline {
        require(end > start && end - start <= 6 * 3_600_000L)
        val seed = previous?.takeIf { it.end == start }
        val active = seed?.active?.toMutableMap() ?: mutableMapOf()
        val lastExit = seed?.lastExit?.toMutableMap() ?: mutableMapOf()
        var interactive = seed?.interactive
        var unlocked = seed?.unlocked
        var known = seed?.appKnown ?: false
        var appKnown = known && activityIdentity
        var screenKnown = screenApi && interactive != null && unlocked != null
        val issues = linkedSetOf<String>()
        if (!known) issues.add("initial_state_unknown")
        if (!screenApi) issues.add("screen_api_unavailable")
        if (!activityIdentity) issues.add("activity_identity_unavailable")
        if (!screenKnown && screenApi) issues.add("screen_state_unknown")
        val sessions = mutableListOf<UsageSegment>()
        val screen = mutableListOf<UsageSegment>()
        val launches = mutableListOf<UsageLaunch>()
        var cursor = start
        fun advance(to: Long) {
            if (to <= cursor) return
            if (interactive != false && unlocked != false) active.values.toSet().forEach { sessions.add(UsageSegment(cursor, to, it)) }
            if (screenApi && interactive == true && unlocked == true) screen.add(UsageSegment(cursor, to))
            if (interactive == null || unlocked == null) screenKnown = false
            cursor = to
        }
        val ordered = events.filter { it.at >= start && it.at < end }.distinct().sortedBy { it.at }
        if (ordered.size > 5000) return unavailable(start, end, "event_limit")
        for (event in ordered) {
            advance(event.at)
            val app = event.applicationId
            when (event.type) {
                "resumed" -> if (packageId.matches(app)) {
                    val key = "$app/${event.activity}"
                    val present = active.containsValue(app)
                    if (!present && event.at - (lastExit[app] ?: Long.MIN_VALUE / 2) > 1000) launches.add(UsageLaunch(event.at, app))
                    active[key] = app
                }
                "paused" -> if (packageId.matches(app)) {
                    val key = "$app/${event.activity}"
                    if (active.remove(key) == null && interactive != false && unlocked != false) { appKnown = false; known = false; issues.add("initial_state_unknown") }
                    if (!active.containsValue(app)) lastExit[app] = event.at
                }
                "interactive" -> interactive = true
                "non_interactive" -> { interactive = false; active.values.toSet().forEach { lastExit[it] = event.at }; active.clear(); known = true }
                "unlocked" -> unlocked = true
                "locked" -> { unlocked = false; active.values.toSet().forEach { lastExit[it] = event.at }; active.clear(); known = true }
                "shutdown", "startup" -> {
                    active.clear(); lastExit.clear(); interactive = null; unlocked = null
                    known = true; appKnown = false; screenKnown = false; issues.add("device_restart")
                }
            }
            if (active.size > 64 || (sessions.map { it.applicationId } + launches.map { it.applicationId } + active.values).toSet().size > 32)
                return unavailable(start, end, "window_limit")
        }
        advance(end)
        fun merge(segments: List<UsageSegment>): List<UsageSegment> {
            val result = mutableListOf<UsageSegment>()
            segments.groupBy { it.applicationId }.forEach { (_, list) ->
                list.sortedBy { it.start }.forEach { segment ->
                    val last = result.lastOrNull()
                    if (last != null && last.applicationId == segment.applicationId && last.end == segment.start)
                        result[result.lastIndex] = last.copy(end = segment.end)
                    else result.add(segment)
                }
            }
            return result.sortedWith(compareBy({ it.start }, { it.applicationId }))
        }
        val mergedSessions = merge(sessions); val mergedScreen = merge(screen)
        if (mergedSessions.size > 128 || mergedScreen.size > 128 || launches.size > 256) return unavailable(start, end, "window_limit")
        return UsageTimeline(mergedSessions, mergedScreen, launches, appKnown, screenKnown, issues.toList(),
            UsageCheckpoint(end, active.toMap(), lastExit.entries.sortedByDescending { it.value }.take(32).associate { it.toPair() }, interactive, unlocked, known))
    }
    fun unavailable(start: Long, end: Long, issue: String = "stream_unavailable"): UsageTimeline {
        require(end > start)
        return UsageTimeline(emptyList(), emptyList(), emptyList(), false, false, listOf(issue), UsageCheckpoint(end, emptyMap(), emptyMap(), null, null, false))
    }
}
