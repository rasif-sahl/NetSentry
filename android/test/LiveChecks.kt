import com.netsentry.app.core.RemoteIntent
import com.netsentry.app.data.*
import java.io.File
import java.time.Instant
import org.json.JSONObject

/**
 * Actual HTTPS/API adapters with explicit synthetic OS readings. No Android framework is invoked.
 */
private class EphemeralStore : PrivateStore {
    private var value = JSONObject()

    override fun read() = JSONObject(value.toString())

    override fun write(state: JSONObject) {
        value = JSONObject(state.toString())
    }

    override fun clear() {
        value = JSONObject()
    }
}

fun main(args: Array<String>) {
    val base = args[0]
    val fixture = JSONObject(File(args[1]).readText())
    val transport: Transport = Api(base)
    val redirect = runCatching { transport.request("GET", "/__redirect") }.exceptionOrNull()
    check(redirect is ApiFailure && redirect.status == 302)
    val retry =
        runCatching { transport.request("POST", "/__retry", body = json("synthetic" to true)) }
            .exceptionOrNull()
    check(retry is ApiFailure && retry.status == 503)
    val usage =
        object : UsageSource {
            override fun granted() = true

            override fun read(start: Long, end: Long) =
                listOf(
                    UsageReading(
                        "mobile_data_bytes",
                        123L,
                        "Synthetic JVM adapter; not phone data",
                    ),
                    UsageReading("wifi_data_bytes", 456L, "Synthetic JVM adapter; not phone data"),
                )

            override fun applications(
                start: Long,
                end: Long,
                checkpoint: com.netsentry.app.core.UsageCheckpoint?,
            ): ApplicationObservation {
                val id = "com.example.reader"
                val known =
                    checkpoint
                        ?: com.netsentry.app.core.UsageCheckpoint(
                            start,
                            emptyMap(),
                            emptyMap(),
                            true,
                            true,
                            true,
                        )
                val timeline =
                    com.netsentry.app.core.TimelineReducer.reduce(
                        start,
                        end,
                        listOf(
                            com.netsentry.app.core.UsageEvent(
                                start,
                                "resumed",
                                id,
                                "local.private.Class",
                            )
                        ),
                        known,
                        true,
                        true,
                    )
                return ApplicationObservation(
                    timeline,
                    listOf(ApplicationMetadata(id, "Synthetic JVM app", "unknown")),
                )
            }

            override fun metadata() =
                json(
                    "applicationVersion" to "0.8.0-jvm-fixture",
                    "batteryOptimizationStatus" to "unknown",
                )
        }
    var clockOffset = 0L
    var frozenClock: Long? = null
    val repository =
        Repository(
            EphemeralStore(),
            usage,
            {},
            { frozenClock ?: (System.currentTimeMillis() + clockOffset) },
        )
    repository.signIn(
        base,
        fixture.getJSONObject("accounts").getJSONObject("owner").getString("email"),
        fixture.getString("password"),
    )
    repository.updateProfile("Kotlin HTTPS fixture")
    repository.appearance("DARK")
    check(repository.view().profile!!.getJSONObject("preferences").getString("theme") == "DARK")
    repository.notificationPreferences(true, true)
    check(repository.view().preferences.getBoolean("email"))
    check(!repository.view().preferences.getBoolean("emailDeliveryAvailable"))
    repository.notificationPreferences(true)
    check(repository.view().preferences.getBoolean("email"))
    repository.notificationPreferences(true, false)
    repository.selectWorkspace(fixture.getString("workspaceId"))
    check(repository.view().profile != null && !repository.view().localEnabled)
    repository.enrol("Synthetic Kotlin integration phone", true)
    repository.consent(true, true)
    // Deterministic accounting delay only: end remains in the real server's past; no historical
    // consent is invented.
    Thread.sleep(500)
    clockOffset = 119_900
    frozenClock = System.currentTimeMillis() + clockOffset
    repository.sync(manual = true)
    check(repository.view().queueSize == 0)
    repository.loadReport("day", "mobile_data_bytes")
    check(
        repository.view().report!!.array("buckets").any {
            it.optString("estimated").toDoubleOrNull() == 123.0
        }
    )
    repository.saveAllowance("mobile_data_bytes", "day", 100, "estimated")
    check(
        repository.view().rules.any {
            it.getJSONObject("config").optString("quality") == "estimated"
        }
    )
    repository.loadApplications("day", "com.example.reader")
    check(
        repository.view().applicationReport!!.array("applications").single().optDouble("seconds") >
            0
    )
    repository.createCategory("JVM reading")
    repository.loadApplications("day")
    val category = repository.view().applicationReport!!.array("customCategories").first()
    repository.correctApplication("com.example.reader", category.getString("id"))
    repository.loadApplications("day", "com.example.reader")
    check(
        repository.view().applicationReport!!.array("applications").single().getString("source") ==
            "manual"
    )
    check(repository.exportApplications().contains("com.example.reader"))
    repository.usageLimit("application_foreground_seconds", "day", 60, "com.example.reader")
    repository.healthAlert("permission_revoked")
    repository.healthAlert("device_offline", 3600)
    repository.healthAlert("not_reporting", 3600)
    // Remote observations use the real wall clock, independent of the synthetic accounting delay.
    clockOffset = 0
    frozenClock = null
    val familyProfileId = fixture.getString("familyProfileId")
    repository.refreshFamily(familyProfileId)
    check(repository.view().familyDetail!!.getBoolean("canManage"))
    repository.consentFamily()
    repository.checkFamilyPolicy()
    check(repository.view().familySync.contains("unsupported"))
    repository.refreshFamily(familyProfileId)
    check(
        repository.view().familyDetail!!.array("devices").any {
            it.getString("enforcement") == "unsupported"
        }
    )
    val child = Repository(EphemeralStore(), usage, {})
    child.signIn(
        base,
        fixture.getJSONObject("accounts").getJSONObject("child").getString("email"),
        fixture.getString("password"),
    )
    child.selectWorkspace(fixture.getString("workspaceId"))
    child.refreshFamily(familyProfileId)
    check(child.view().familyDetail!!.getBoolean("canRequest"))
    val familyRequest = java.util.UUID.randomUUID().toString()
    child.familyTime(familyRequest, 15, "Synthetic Kotlin homework", false)
    val guardian = Repository(EphemeralStore(), usage, {})
    guardian.signIn(
        base,
        fixture.getJSONObject("accounts").getJSONObject("guardian").getString("email"),
        fixture.getString("password"),
    )
    guardian.selectWorkspace(fixture.getString("workspaceId"))
    guardian.refreshFamily(familyProfileId)
    guardian.decideFamily(familyRequest, "approved")
    child.refreshFamily(familyProfileId)
    check(child.view().familyDetail!!.getJSONObject("desired").getString("state") == "overridden")
    child.signOut()
    guardian.signOut()
    lateinit var computer: JSONObject
    lateinit var intent: RemoteIntent
    var confirmed = false
    // Synthetic publisher rotates observations every two seconds. A replacement
    // rejected BEFORE any POST requires a new simulated user confirmation.
    // Transport/API failures and uncertain command acknowledgements are never retried.
    for (attempt in 0 until 5) {
        repository.refreshDeveloper()
        computer =
            repository.view().computers.first {
                it.optBoolean("canControl") && it.array("services").isNotEmpty()
            }
        val service = computer.array("services").first()
        intent =
            RemoteIntent(
                computer.getString("id"),
                service.getString("serviceId"),
                service.getString("observationId"),
                Instant.parse(service.getString("observedAt")).toEpochMilli(),
                "graceful",
                false,
                service.getInt("childCount"),
            )
        try {
            repository.remote(intent)
            confirmed = true
            break
        } catch (_: ObservationChanged) {
            /* No command was sent; review a new fixture observation. */
        }
    }
    check(confirmed) { "Synthetic observation kept changing before confirmation." }
    val pending =
        repository.view().commands[computer.getString("id")]!!.first {
            it.getString("requestId") == intent.requestId
        }
    check(pending.getString("state") == "pending") // Synthetic publisher never executes a signal.
    repository.cancel(computer.getString("id"), pending.getString("id"))
    check(
        repository
            .view()
            .commands[computer.getString("id")]!!
            .first { it.getString("id") == pending.getString("id") }
            .getString("state") == "cancelled"
    )
    repository.withdrawOwnFamily(repository.view().ownDevice!!.getString("id"))
    repository.checkFamilyPolicy()
    check(repository.view().familySync.contains("No current authorized family policy"))
    repository.deviceAction("erase")
    check(repository.view().ownDevice == null && !repository.view().localEnabled)
    repository.signOut()
    check(!repository.view().signedIn)
    val businessRepo = Repository(EphemeralStore(), usage, {})
    businessRepo.signIn(
        base,
        fixture.getJSONObject("accounts").getJSONObject("employee").getString("email"),
        fixture.getString("password"),
    )
    businessRepo.selectWorkspace(fixture.getJSONObject("business").getString("workspaceId"))
    businessRepo.refreshSubscription()
    check(
        businessRepo.view().subscription!!.getString("edition") == "free" &&
            !businessRepo.view().localEnabled
    )
    businessRepo.refreshBusiness()
    check(!businessRepo.view().localEnabled)
    val business = businessRepo.view().businessOverview!!
    val assignment = business.getJSONArray("assignments").getJSONObject(0)
    val businessDevice = business.getJSONArray("devices").getJSONObject(0)
    businessRepo.acceptBusinessSharing(
        businessDevice.getString("id"),
        assignment.getInt("revision"),
        businessDevice.getInt("generation"),
        true,
    )
    check(
        !businessRepo
            .view()
            .businessOverview!!
            .getJSONArray("assignments")
            .getJSONObject(0)
            .isNull("consentedAt")
    )
    businessRepo.withdrawBusinessSharing(businessDevice.getString("id"))
    check(
        businessRepo.view().businessOverview!!.getJSONArray("assignments").length() == 0 &&
            !businessRepo.view().localEnabled
    )
    businessRepo.signOut()
    println("Business employee Kotlin API sharing/withdrawal passed with monitoring unchanged.")
    println(
        "Actual Kotlin HTTPS/NestJS/PostgreSQL account, enrolment, consent, network/detailed app upload/report, categories/corrections/CSV/health rules, allowance, scoped family consent/unsupported receipt/child request/guardian approval, remote request/cancel and erasure passed. OS/desktop observations were synthetic; no phone or native signal was tested."
    )
}
