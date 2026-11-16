import com.netsentry.app.data.*
import com.netsentry.app.core.RemoteIntent
import org.json.JSONObject
import java.io.File
import java.time.Instant

/** Actual HTTPS/API adapters with explicit synthetic OS readings. No Android framework is invoked. */
private class EphemeralStore : PrivateStore {
    private var value = JSONObject()
    override fun read() = JSONObject(value.toString())
    override fun write(state: JSONObject) { value = JSONObject(state.toString()) }
    override fun clear() { value = JSONObject() }
}
fun main(args: Array<String>) {
    val base = args[0]
    val fixture = JSONObject(File(args[1]).readText())
    val usage = object : UsageSource {
        override fun granted() = true
        override fun read(start: Long, end: Long) = listOf(UsageReading("mobile_data_bytes", 123L, "Synthetic JVM adapter; not phone data"), UsageReading("wifi_data_bytes", 456L, "Synthetic JVM adapter; not phone data"))
        override fun metadata() = json("applicationVersion" to "0.8.0-jvm-fixture", "batteryOptimizationStatus" to "unknown")
    }
    var clockOffset = 0L
    val repository = Repository(EphemeralStore(), usage, {}, { System.currentTimeMillis() + clockOffset })
    repository.signIn(base, fixture.getJSONObject("accounts").getJSONObject("owner").getString("email"), fixture.getString("password"))
    repository.selectWorkspace(fixture.getString("workspaceId"))
    check(repository.view().profile != null && !repository.view().localEnabled)
    repository.enrol("Synthetic Kotlin integration phone", true)
    repository.consent(true)
    // Deterministic accounting delay only: end remains in the real server's past; no historical consent is invented.
    Thread.sleep(500)
    clockOffset = 119_900
    repository.sync(manual = true)
    check(repository.view().queueSize == 0)
    repository.loadReport("day", "mobile_data_bytes")
    check(repository.view().report!!.array("buckets").any { it.optString("estimated").toDoubleOrNull() == 123.0 })
    repository.saveAllowance("mobile_data_bytes", "day", 100, "estimated")
    check(repository.view().rules.any { it.getJSONObject("config").optString("quality") == "estimated" })
    // Remote observations use the real wall clock, independent of the synthetic accounting delay.
    clockOffset = 0
    repository.refreshDeveloper()
    val computer = repository.view().computers.first { it.optBoolean("canControl") && it.array("services").isNotEmpty() }
    val service = computer.array("services").first()
    val intent = RemoteIntent(computer.getString("id"), service.getString("serviceId"), service.getString("observationId"),
        Instant.parse(service.getString("observedAt")).toEpochMilli(), "graceful", false, service.getInt("childCount"))
    repository.remote(intent)
    val pending = repository.view().commands[computer.getString("id")]!!.first { it.getString("requestId") == intent.requestId }
    check(pending.getString("state") == "pending") // Synthetic publisher never executes a signal.
    repository.cancel(computer.getString("id"), pending.getString("id"))
    check(repository.view().commands[computer.getString("id")]!!.first { it.getString("id") == pending.getString("id") }.getString("state") == "cancelled")
    repository.deviceAction("erase")
    check(repository.view().ownDevice == null && !repository.view().localEnabled)
    repository.signOut()
    check(!repository.view().signedIn)
    println("Actual Kotlin HTTPS/NestJS/PostgreSQL account, enrolment, consent, estimated upload/report, allowance, remote request/cancel and erasure passed. OS/desktop observations were synthetic; no phone or native signal was tested.")
}
