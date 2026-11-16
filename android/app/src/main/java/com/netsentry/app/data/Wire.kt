package com.netsentry.app.data

import com.netsentry.app.core.Policy
import com.netsentry.app.core.RemoteIntent
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

interface PrivateStore {
    fun read(): JSONObject
    fun write(state: JSONObject)
    fun clear()
}
interface Transport {
    fun request(method: String, path: String, token: String? = null, body: JSONObject? = null): Any
}
data class UsageReading(val metric: String, val bytes: Long?, val reason: String, val failure: String = "collection_failed")
interface UsageSource {
    fun granted(): Boolean
    fun read(start: Long, end: Long): List<UsageReading>
    fun applications(start: Long, end: Long, checkpoint: com.netsentry.app.core.UsageCheckpoint?): ApplicationObservation? = null
    fun metadata(): JSONObject
}
object Wire {
    fun command(intent: RemoteIntent): JSONObject = json(
        "requestId" to intent.requestId, "serviceId" to intent.serviceId,
        "observationId" to intent.observationId, "mode" to intent.mode,
        "includeChildren" to intent.includeChildren,
    )
    fun capabilities(workspace: String, device: String, readings: List<UsageReading>, now: Long): JSONObject {
        val capabilities = readings.map { reading ->
            val ready = reading.bytes != null
            json("id" to if (reading.metric == "mobile_data_bytes") "network.mobile_data" else "network.wifi_data",
                "status" to if (ready) "supported" else if (reading.failure == "permission_unavailable") "permission_required" else "temporarily_unavailable",
                "reason" to reading.reason, "source" to "os", "checkedAt" to Policy.timestamp(now),
                "requiredSetup" to JSONArray(if (ready) emptyList<String>() else listOf("Review usage access and retry the OS statistics query.")),
                "availableActions" to JSONArray(if (ready) listOf("measure") else emptyList<String>()))
        } + listOf(json("id" to "network.hotspot_clients", "status" to "restricted_by_os",
            "reason" to "No verified public per-client source on this API 35 application baseline.",
            "source" to "os", "checkedAt" to Policy.timestamp(now), "requiredSetup" to JSONArray(), "availableActions" to JSONArray()))
        return json("schemaVersion" to 1, "workspaceId" to workspace, "deviceId" to device,
            "reportedAt" to Policy.timestamp(now), "capabilities" to JSONArray(capabilities))
    }
    fun batch(workspace: String, device: String, generation: Int, start: Long, end: Long,
              readings: List<UsageReading>, now: Long): JSONObject {
        require(end > start && end - start <= 86_400_000L && now >= end)
        val events = readings.filter { it.bytes != null }.map {
            require(it.bytes!! in 0..9_007_199_254_740_991L)
            json("schemaVersion" to 1, "eventId" to UUID.randomUUID().toString(),
                "workspaceId" to workspace, "deviceId" to device, "metric" to it.metric,
                "value" to it.bytes, "unit" to "bytes", "source" to json("kind" to "android", "collectorVersion" to "0.8.0"),
                "intervalStart" to Policy.timestamp(start), "intervalEnd" to Policy.timestamp(end),
                "collectedAt" to Policy.timestamp(now), "quality" to "estimated")
        }
        val gaps = readings.filter { it.bytes == null }.map {
            json("gapId" to UUID.randomUUID().toString(), "metric" to it.metric,
                "intervalStart" to Policy.timestamp(start), "intervalEnd" to Policy.timestamp(end),
                "reason" to it.failure)
        }
        return json("schemaVersion" to 1, "batchId" to UUID.randomUUID().toString(),
            "generation" to generation, "events" to JSONArray(events), "gaps" to JSONArray(gaps))
    }
}
