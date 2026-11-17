import com.netsentry.app.core.*
import com.netsentry.app.data.*
import java.io.File
import java.time.Instant

private const val APP = "com.example.reader"
private const val OTHER = "com.example.notes"
private val T = Instant.parse("2026-11-16T12:00:00Z").toEpochMilli()
private var count = 0

private fun checkCase(name: String, body: () -> Unit) {
    body()
    count++
    println("PASS $name")
}

private fun event(ms: Long, type: String, app: String = APP, activity: String = "1") =
    UsageEvent(T + ms, type, app, activity)

private fun seed() = UsageCheckpoint(T, emptyMap(), emptyMap(), true, true, true)

private fun duration(items: List<UsageSegment>) = items.sumOf { it.end - it.start }

fun main(args: Array<String>) {
    checkCase("unknown boundaries are not fabricated as complete launch/screen context") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(event(1000, "resumed"), event(5000, "paused")),
                null,
                true,
                true,
            )
        check(
            !result.appKnown &&
                !result.screenKnown &&
                result.issues.contains("initial_state_unknown")
        )
        check(duration(result.sessions) == 4000L)
    }
    checkCase("activity handoff inside a package does not count as another launch") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(
                    event(1000, "resumed"),
                    event(3000, "paused"),
                    event(3000, "resumed", activity = "2"),
                    event(7000, "paused", activity = "2"),
                ),
                seed(),
                true,
                true,
            )
        check(result.launches.size == 1 && duration(result.sessions) == 6000L && result.appKnown)
    }
    checkCase("multi-window app durations can overlap while screen time remains a union") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(
                    event(0, "resumed"),
                    event(1000, "resumed", OTHER),
                    event(9000, "paused"),
                    event(9000, "paused", OTHER),
                ),
                seed(),
                true,
                true,
            )
        check(duration(result.sessions) == 17_000L && duration(result.screen) == 10_000L)
    }
    checkCase("duplicate resume events and duplicate records are idempotent") {
        val first = event(1000, "resumed")
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(first, first, event(2000, "resumed"), event(7000, "paused")),
                seed(),
                true,
                true,
            )
        check(result.launches.size == 1 && duration(result.sessions) == 6000L)
    }
    checkCase("checkpointed open sessions clip at each nonoverlapping boundary") {
        val first =
            TimelineReducer.reduce(T, T + 5000, listOf(event(1000, "resumed")), seed(), true, true)
        val second =
            TimelineReducer.reduce(
                T + 5000,
                T + 10_000,
                listOf(event(9000, "paused")),
                first.checkpoint,
                true,
                true,
            )
        check(
            duration(first.sessions) == 4000L &&
                duration(second.sessions) == 4000L &&
                second.launches.isEmpty()
        )
    }
    checkCase("noncontiguous checkpoints are rejected as context evidence") {
        val result = TimelineReducer.reduce(T + 1000, T + 5000, emptyList(), seed(), true, true)
        check(!result.appKnown && !result.screenKnown && result.sessions.isEmpty())
    }
    checkCase("screen lock ends foreground and establishes an empty future boundary") {
        val first =
            TimelineReducer.reduce(
                T,
                T + 5000,
                listOf(event(0, "resumed"), event(2000, "locked"), event(2100, "paused")),
                seed(),
                true,
                true,
            )
        check(duration(first.sessions) == 2000L && duration(first.screen) == 2000L)
        val next =
            TimelineReducer.reduce(
                T + 5000,
                T + 10_000,
                listOf(event(6000, "unlocked"), event(6100, "resumed")),
                first.checkpoint,
                true,
                true,
            )
        check(next.appKnown && next.launches.size == 1 && duration(next.screen) == 4000L)
    }
    checkCase("restart clears active processes and invalidates the containing window") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(event(0, "resumed"), event(4000, "shutdown")),
                seed(),
                true,
                true,
            )
        check(
            duration(result.sessions) == 4000L &&
                !result.appKnown &&
                !result.screenKnown &&
                result.checkpoint.active.isEmpty()
        )
    }
    checkCase("old Android screen APIs remain unavailable rather than zero") {
        val result =
            TimelineReducer.reduce(T, T + 10_000, listOf(event(0, "resumed")), null, false, false)
        check(
            !result.screenKnown &&
                !result.appKnown &&
                result.screen.isEmpty() &&
                result.issues.contains("screen_api_unavailable")
        )
    }
    checkCase("out of window events do not retarget earlier observations") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(event(-1, "resumed"), event(10_000, "resumed")),
                seed(),
                true,
                true,
            )
        check(result.sessions.isEmpty() && result.launches.isEmpty())
    }
    checkCase("event capacity fails the entire window closed") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                (0L..5001L).map { event(it, "resumed") },
                seed(),
                true,
                true,
            )
        check(
            result.issues == listOf("event_limit") &&
                result.sessions.isEmpty() &&
                !result.screenKnown
        )
    }
    checkCase("application capacity never silently truncates a successful window") {
        val result =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                (0L..33L).map { event(it, "resumed", "com.example.app$it") },
                seed(),
                true,
                true,
            )
        check(result.issues == listOf("window_limit") && result.sessions.isEmpty())
    }
    checkCase(
        "empty complete windows have observed zero screen state while unknown empty windows do not"
    ) {
        val known =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                emptyList(),
                seed().copy(interactive = false, unlocked = false),
                true,
                true,
            )
        val unknown = TimelineReducer.reduce(T, T + 10_000, emptyList(), null, true, true)
        check(known.screenKnown && duration(known.screen) == 0L && !unknown.screenKnown)
    }
    checkCase(
        "checkpoint serialization retains exact private identity but wire history excludes it"
    ) {
        val data =
            TimelineReducer.reduce(
                T,
                T + 10_000,
                listOf(event(0, "resumed", activity = "private.activity.Class")),
                seed(),
                true,
                true,
            )
        check(
            ApplicationWire.checkpoint(ApplicationWire.checkpoint(data.checkpoint)) ==
                data.checkpoint
        )
        val batch =
            ApplicationWire.batch(
                "00000000-0000-4000-8000-000000000001",
                "00000000-0000-4000-8000-000000000003",
                2,
                T,
                T + 10_000,
                T + 10_000,
                ApplicationObservation(
                    data,
                    listOf(ApplicationMetadata(APP, "Reader", "productivity")),
                ),
            )
        check(!batch.toString().contains("private.activity.Class"))
    }
    val result =
        TimelineReducer.reduce(
            T,
            T + 10_000,
            listOf(event(1000, "resumed"), event(9000, "paused")),
            seed(),
            true,
            true,
        )
    val batch =
        ApplicationWire.batch(
            "00000000-0000-4000-8000-000000000001",
            "00000000-0000-4000-8000-000000000003",
            2,
            T,
            T + 10_000,
            T + 10_000,
            ApplicationObservation(
                result,
                listOf(ApplicationMetadata(APP, "Synthetic Reader", "productivity")),
            ),
        )
    args.firstOrNull()?.let { File(it).writeText(batch.toString(2)) }
    println(
        "$count advanced Kotlin reducer checks passed. OS streams and phone behavior remain unverified."
    )
}
