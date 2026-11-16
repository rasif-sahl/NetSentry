import com.netsentry.app.core.Policy
import com.netsentry.app.core.QueueStamp
import com.netsentry.app.core.RemoteIntent
import com.netsentry.app.data.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.time.Instant

private const val W = "00000000-0000-4000-8000-000000000001"
private const val U = "00000000-0000-4000-8000-000000000002"
private const val D = "00000000-0000-4000-8000-000000000003"
private const val A = "00000000-0000-4000-8000-000000000004"
private const val O = "00000000-0000-4000-8000-000000000005"
private val BASE_TIME = Instant.parse("2026-11-16T12:00:00Z").toEpochMilli()
private var passed = 0
private fun test(name: String, body: () -> Unit) { body(); passed++; println("PASS $name") }
private fun denied(body: () -> Unit) { check(runCatching(body).isFailure) { "Expected rejection" } }
private class Memory : PrivateStore {
    var state = JSONObject()
    override fun read() = JSONObject(state.toString())
    override fun write(state: JSONObject) { this.state = JSONObject(state.toString()) }
    override fun clear() { state = JSONObject() }
}
private class Usage : UsageSource {
    var allowed = true
    override fun granted() = allowed
    override fun read(start: Long, end: Long) = listOf(UsageReading("mobile_data_bytes", if (allowed) 123L else null, "Synthetic test adapter"), UsageReading("wifi_data_bytes", if (allowed) 456L else null, "Synthetic test adapter"))
    override fun metadata() = json("applicationVersion" to "0.8.0", "batteryOptimizationStatus" to "restricted")
}
private class Harness {
    val store = Memory()
    val usage = Usage()
    var now = BASE_TIME
    var enabled = false
    var serverMonitoring = false
    var generation = 1
    var offline = false
    var expireAccess = false
    var loseRefresh = false
    var loseUpload = false
    var revokedDevice = false
    var control = true
    val calls = mutableListOf<Triple<String, String, String?>>()
    val uploads = mutableListOf<String>()
    var remoteCount = 0
    val user = json("id" to U, "displayName" to "Test owner", "emailVerifiedAt" to Policy.timestamp(now))
    fun service() = json("serviceId" to "a".repeat(64), "observationId" to O, "observedAt" to Policy.timestamp(now), "canStop" to true)
    val transport = object : Transport {
        override fun request(method: String, path: String, token: String?, body: JSONObject?): Any {
            calls.add(Triple(method, path, token))
            if (offline) throw IOException("Synthetic offline")
            if (path.startsWith("/devices/$D") && token == "device-secret" && revokedDevice) throw ApiFailure(401, "REVOKED", "Revoked")
            if (path == "/auth/refresh") {
                if (loseRefresh) throw IOException("Lost refresh response")
                expireAccess = false
                return json("accessToken" to "new-access", "refreshToken" to "new-refresh", "user" to user)
            }
            if (token == "access" && expireAccess) throw ApiFailure(401, "EXPIRED", "Expired")
            return when {
                path == "/auth/login" || path == "/auth/register" -> json("accessToken" to "access", "refreshToken" to "refresh", "user" to user)
                path == "/auth/me" -> user
                path == "/workspaces" -> JSONArray(listOf(json("id" to W, "timezone" to "America/New_York", "name" to "Test", "role" to "OWNER")))
                path == "/privacy/disclosures" -> json("enrolment" to json("version" to "device-enrolment-v1", "text" to "Test disclosure"), "monitoring" to json("version" to "monitoring-v3", "text" to "Test disclosure"))
                path == "/notifications/preferences" -> json("inApp" to true, "push" to false)
                path == "/devices/enrolments" -> json("token" to "code")
                path == "/devices/enrol" -> json("device" to json("id" to D, "workspaceId" to W, "name" to "Test phone"), "deviceToken" to "device-secret")
                path == "/devices/$D/consent" && method == "POST" -> { serverMonitoring = true; generation++; JSONObject() }
                path == "/devices/$D/pause" -> { serverMonitoring = false; generation++; JSONObject() }
                path == "/devices/$D/configuration" || path == "/devices/$D/heartbeat" -> json("deviceId" to D, "workspaceId" to W, "generation" to generation, "monitoringEnabled" to serverMonitoring, "consentScopes" to JSONArray(listOf("network_usage")))
                path == "/devices/$D/measurements" -> {
                    check(token == "device-secret") { "Account credential reached device route" }
                    uploads.add(body!!.toString())
                    if (loseUpload) throw IOException("Lost upload acknowledgement")
                    json("accepted" to 2)
                }
                path == "/workspaces/$W/developer" -> JSONArray(listOf(json("id" to A, "canControl" to control, "services" to JSONArray(listOf(service())))))
                path == "/workspaces/$W/agents/$A/commands" && method == "POST" -> { remoteCount++; check(token != "device-secret"); json("state" to "pending") }
                path.endsWith("/devices") || path.endsWith("/commands") || path.endsWith("/rules") || path.endsWith("/alerts") || path.endsWith("/notifications") -> JSONArray()
                else -> JSONObject()
            }
        }
    }
    val repo = Repository(store, usage, { enabled = it }, { now }, { transport })
    fun login() = repo.signIn("https://api.example.test/api/v1", "a@example.test", "password")
    fun enrol() { login(); repo.enrol("Phone", true) }
    fun consent() { enrol(); repo.consent(true); now += 15 * 60_000 }
}
fun main(args: Array<String>) {
    test("HTTPS address scope and credentials") {
        check(Policy.apiBase("https://example.test/api/v1/") == "https://example.test/api/v1")
        listOf("http://example.test/api/v1", "https://u:p@example.test/api/v1", "https://example.test/api/v1?secret=x", "https://example.test/api/v1#x", "https://example.test/other").forEach { denied { Policy.apiBase(it) } }
    }
    test("millisecond UTC and timezone report windows") {
        check(Policy.timestamp(BASE_TIME) == "2026-11-16T12:00:00.000Z")
        check(Policy.reportDates("week", "America/New_York", BASE_TIME) == ("2026-11-16" to "2026-11-17"))
        check(Policy.reportDates("month", "Asia/Colombo", BASE_TIME).first == "2026-11-01")
    }
    test("nonoverlapping post-consent collection windows") {
        check(Policy.interval(BASE_TIME, BASE_TIME + 60_000) == null)
        check(Policy.interval(BASE_TIME, BASE_TIME - 1000) == null)
        check(Policy.interval(BASE_TIME, BASE_TIME + 3 * 86_400_000L)!!.last == BASE_TIME + 86_400_000L)
    }
    val intent = RemoteIntent(A, "a".repeat(64), O, BASE_TIME, "graceful", false, 0)
    test("remote freshness, grants, mode and captured child bounds") {
        intent.check(BASE_TIME, true, true)
        denied { intent.check(BASE_TIME + 10_001, true, true) }
        denied { intent.check(BASE_TIME - 1, true, true) }
        denied { intent.check(BASE_TIME, false, true) }
        denied { intent.copy(mode = "shell").check(BASE_TIME, true, true) }
        denied { intent.copy(includeChildren = true, childCount = 17).check(BASE_TIME, true, true) }
    }
    test("queue generation, age and attempts") {
        val stamp = QueueStamp(O, 1, BASE_TIME, 0)
        check(stamp.eligible(1, true, BASE_TIME))
        check(!stamp.eligible(2, true, BASE_TIME))
        check(!stamp.eligible(1, false, BASE_TIME))
        check(!stamp.eligible(1, true, BASE_TIME + Policy.QUEUE_AGE_MS + 1))
        check(!stamp.copy(attempts = 8).eligible(1, true, BASE_TIME))
        check(Policy.retryDelay(99) <= 300_000)
    }
    test("sign-in and enrolment do not start collection") {
        val h = Harness(); h.login(); check(!h.enabled && !h.repo.view().localEnabled)
        denied { h.repo.enrol("Phone", false) }
        h.repo.enrol("Phone", true); check(!h.enabled && h.store.state.has("device"))
        check(h.repo.view().toString().contains("device-secret").not())
    }
    test("consent requires separate OS usage access") {
        val h = Harness(); h.enrol(); h.usage.allowed = false
        denied { h.repo.consent(true) }; check(!h.enabled)
    }
    test("fresh consent schedules collection and uses device credential") {
        val h = Harness(); h.consent(); h.repo.sync()
        check(h.enabled && h.uploads.size == 1 && h.repo.view().queueSize == 0)
        check(h.calls.filter { it.second.endsWith("/configuration") }.all { it.third == "device-secret" })
    }
    test("offline collection persists exact encrypted-store payload for retry") {
        val h = Harness(); h.consent(); h.offline = true
        denied { h.repo.sync() }; check(h.repo.view().queueSize == 1)
        val queued = h.store.state.getJSONArray("queue").getJSONObject(0).getJSONObject("body").toString()
        h.offline = false; h.repo.sync(manual = true)
        check(h.uploads.first() == queued)
    }
    test("lost upload acknowledgement reuses batch and event UUIDs") {
        val h = Harness(); h.consent(); h.loseUpload = true
        denied { h.repo.sync() }; check(h.repo.view().queueSize == 1)
        h.loseUpload = false; h.repo.sync(manual = true)
        check(h.uploads.size == 2 && h.uploads[0] == h.uploads[1])
    }
    test("queue capacity bounds collection without overwriting oldest work") {
        val h = Harness(); h.consent(); h.offline = true
        repeat(60) { denied { h.repo.sync() }; h.now += 15 * 60_000 }
        check(h.repo.view().queueSize == Policy.MAX_QUEUE)
    }
    test("stale offline authorization stops further collection") {
        val h = Harness(); h.consent(); h.now += 2 * 86_400_000L; h.offline = true
        denied { h.repo.sync() }; check(h.repo.view().queueSize == 0)
    }
    test("permission withdrawal stops work and purges pending measurements") {
        val h = Harness(); h.consent(); h.offline = true; denied { h.repo.sync() }
        h.usage.allowed = false; denied { h.repo.sync() }
        check(!h.enabled && h.repo.view().queueSize == 0)
    }
    test("server pause discards offline measurements") {
        val h = Harness(); h.consent(); h.offline = true; denied { h.repo.sync() }
        h.offline = false; h.serverMonitoring = false; h.generation++
        h.repo.sync(); check(!h.enabled && h.repo.view().queueSize == 0 && h.uploads.isEmpty())
    }
    test("generation changes discard old batches without retagging") {
        val h = Harness(); h.consent(); h.offline = true; denied { h.repo.sync() }
        h.offline = false; h.generation++; h.repo.sync()
        check(h.repo.view().queueSize == 0 && h.uploads.isEmpty())
    }
    test("device credential revocation erases local binding and queued work") {
        val h = Harness(); h.consent(); h.revokedDevice = true; denied { h.repo.sync() }
        check(h.repo.view().ownDevice == null && !h.enabled && h.repo.view().queueSize == 0)
    }
    test("refresh rotates and persists tokens before account retry") {
        val h = Harness(); h.login(); h.expireAccess = true; h.repo.refresh()
        check(h.store.state.getJSONObject("session").getString("refreshToken") == "new-refresh")
        check(h.calls.any { it.second == "/auth/me" && it.third == "new-access" })
    }
    test("lost refresh response clears session instead of replaying credentials") {
        val h = Harness(); h.consent(); h.expireAccess = true; h.loseRefresh = true
        denied { h.repo.refresh() }; check(!h.repo.view().signedIn && !h.enabled && h.repo.view().ownDevice == null)
    }
    test("remote commands are never added to offline upload queue") {
        val h = Harness(); h.login(); h.offline = true
        denied { h.repo.remote(intent) }; check(h.repo.view().queueSize == 0 && h.remoteCount == 0)
    }
    test("remote grants are freshly checked and request identity retained") {
        val h = Harness(); h.login(); h.control = false
        denied { h.repo.remote(intent) }; check(h.remoteCount == 0)
        h.control = true; h.repo.remote(intent); check(h.remoteCount == 1)
        check(Wire.command(intent).getString("requestId") == intent.requestId)
    }
    test("pause stops locally even if server cannot confirm") {
        val h = Harness(); h.consent(); h.offline = true
        denied { h.repo.deviceAction("pause") }; check(!h.enabled && h.repo.view().queueSize == 0)
    }
    test("sign-out clears local credentials even on network failure") {
        val h = Harness(); h.consent(); h.offline = true
        denied { h.repo.signOut() }; check(!h.repo.view().signedIn && h.store.state.length() == 0)
    }
    val readings = Usage().read(BASE_TIME - 60_000, BASE_TIME)
    val evidence = json("batch" to Wire.batch(W, D, 2, BASE_TIME - 60_000, BASE_TIME, readings, BASE_TIME),
        "capabilities" to Wire.capabilities(W, D, readings, BASE_TIME), "command" to Wire.command(intent))
    args.firstOrNull()?.let { File(it).writeText(evidence.toString(2)) }
    println("$passed JVM checks passed; Android framework/build/device checks remain separate.")
}
