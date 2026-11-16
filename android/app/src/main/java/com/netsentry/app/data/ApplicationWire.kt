package com.netsentry.app.data

import com.netsentry.app.core.Policy
import com.netsentry.app.core.UsageCheckpoint
import com.netsentry.app.core.UsageTimeline
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class ApplicationMetadata(val applicationId: String, val label: String?, val platformCategory: String)
data class ApplicationObservation(val timeline: UsageTimeline, val applications: List<ApplicationMetadata>)
object ApplicationWire {
    fun checkpoint(value: UsageCheckpoint): JSONObject = json("end" to value.end, "active" to JSONObject(value.active),
        "lastExit" to JSONObject(value.lastExit), "interactive" to value.interactive, "unlocked" to value.unlocked, "appKnown" to value.appKnown)
    fun checkpoint(value: JSONObject?): UsageCheckpoint? = value?.let {
        val active = it.getJSONObject("active"); val exit = it.getJSONObject("lastExit")
        UsageCheckpoint(it.getLong("end"), active.keys().asSequence().associateWith { key -> active.getString(key) },
            exit.keys().asSequence().associateWith { key -> exit.getLong(key) },
            if (it.isNull("interactive")) null else it.getBoolean("interactive"), if (it.isNull("unlocked")) null else it.getBoolean("unlocked"), it.getBoolean("appKnown"))
    }
    fun batch(workspace: String, device: String, generation: Int, start: Long, end: Long, now: Long, observation: ApplicationObservation): JSONObject {
        val data = observation.timeline
        return json("schemaVersion" to 1, "batchId" to UUID.randomUUID().toString(), "generation" to generation,
            "workspaceId" to workspace,"deviceId" to device,"intervalStart" to Policy.timestamp(start),"intervalEnd" to Policy.timestamp(end),"collectedAt" to Policy.timestamp(now),
            "appKnown" to data.appKnown,"screenKnown" to data.screenKnown,"issues" to JSONArray(data.issues),
            "sessions" to JSONArray(data.sessions.map { json("applicationId" to it.applicationId,"start" to Policy.timestamp(it.start),"end" to Policy.timestamp(it.end)) }),
            "screen" to JSONArray(data.screen.map { json("start" to Policy.timestamp(it.start),"end" to Policy.timestamp(it.end)) }),
            "launches" to JSONArray(data.launches.map { json("applicationId" to it.applicationId,"at" to Policy.timestamp(it.at)) }),
            "applications" to JSONArray(observation.applications.map { json("applicationId" to it.applicationId,"label" to it.label,"platformCategory" to it.platformCategory) }))
    }
    fun capabilities(now: Long, supported: Boolean, screenSupported: Boolean): List<JSONObject> = listOf(
        "usage.application_foreground" to supported, "usage.screen_time" to screenSupported,
    ).map { (id, ready) -> json("id" to id,"status" to if (ready) "supported" else "temporarily_unavailable", "source" to "os",
        "checkedAt" to Policy.timestamp(now), "reason" to if (ready) "Android event adapter available; durations are estimated and device accuracy is unverified." else "Usage events or screen-state API unavailable; missing is not zero.",
        "requiredSetup" to JSONArray(if (ready) emptyList<String>() else listOf("Review usage access, unlocked user state and OS support.")), "availableActions" to JSONArray(if (ready) listOf("measure") else emptyList<String>())) }
}
