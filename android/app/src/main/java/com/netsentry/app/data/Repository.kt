package com.netsentry.app.data

import com.netsentry.app.core.Policy
import com.netsentry.app.core.QueueStamp
import com.netsentry.app.core.RemoteIntent
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** All callers (worker and UI) share this one process-scoped repository and lock. */
class Repository(
    private val store: PrivateStore,
    private val usage: UsageSource,
    private val schedule: (Boolean) -> Unit,
    private val clock: () -> Long = System::currentTimeMillis,
    private val transport: (String) -> Transport = ::Api,
) {
    private var state = store.read()
    private var profile: JSONObject? = null
    private var workspaces = emptyList<JSONObject>()
    private var devices = emptyList<JSONObject>()
    private var computers = emptyList<JSONObject>()
    private var commands = emptyMap<String, List<JSONObject>>()
    private var report: JSONObject? = null
    private var applicationReport: JSONObject? = null
    private var applicationQuery: String? = null
    private var rules = emptyList<JSONObject>()
    private var alerts = emptyList<JSONObject>()
    private var notifications = emptyList<JSONObject>()
    private var preferences = JSONObject()
    private var disclosures = JSONObject()
    private var subscription: JSONObject? = null
    private var businessOverview: JSONObject? = null
    private var familyOverview: JSONObject? = null
    private var familyDetail: JSONObject? = null
    private var familySync = "Family policy not checked"
    private var lastSync = "Not synchronized"

    data class View(
        val signedIn: Boolean, val base: String, val profile: JSONObject?, val workspaces: List<JSONObject>,
        val workspaceId: String, val devices: List<JSONObject>, val ownDevice: JSONObject?, val localEnabled: Boolean,
        val report: JSONObject?, val applicationReport: JSONObject?, val appUsageEnabled: Boolean, val computers: List<JSONObject>, val commands: Map<String, List<JSONObject>>,
        val rules: List<JSONObject>, val alerts: List<JSONObject>, val notifications: List<JSONObject>,
        val preferences: JSONObject, val disclosures: JSONObject, val queueSize: Int, val syncStatus: String,
        val subscription: JSONObject?, val businessOverview: JSONObject?, val familyOverview: JSONObject?, val familyDetail: JSONObject?, val familySync: String,
    )
    @Synchronized fun view(): View = View(state.has("session"), state.optString("base"), profile,
        workspaces, state.optString("workspaceId"), devices, ownDevice(), state.optBoolean("collect"),
        report, applicationReport, state.optBoolean("appUsage"), computers, commands, rules, alerts, notifications, preferences, disclosures,
        state.optJSONArray("queue")?.length() ?: 0, lastSync, subscription, businessOverview, familyOverview, familyDetail, familySync)
    private fun save() = store.write(state)
    private fun api(): Transport = transport(state.getString("base"))
    private fun ownDevice(): JSONObject? = state.optJSONObject("device")?.optJSONObject("public")
    private fun deviceId(): String = Policy.uuid(state.getJSONObject("device").getString("id"))
    private fun workspace(): String = Policy.uuid(state.getString("workspaceId"))
    private fun path(): String = "/workspaces/${workspace()}/monitoring"
    private fun account(method: String, path: String, body: JSONObject? = null): Any {
        val session = state.getJSONObject("session")
        try { return api().request(method, path, session.getString("accessToken"), body) }
        catch (error: ApiFailure) {
            if (error.status != 401) {
                if (error.status == 403) { clearViews(); stopCollection() }
                throw error
            }
        }
        // Refresh rotation is serialized. A lost refresh response cannot safely replay the old token.
        try {
            val renewed = api().request("POST", "/auth/refresh", body = json("refreshToken" to session.getString("refreshToken"))) as JSONObject
            state.put("session", renewed); save()
        } catch (error: Exception) {
            clearLocal()
            throw ApiFailure(401, "SIGN_IN_REQUIRED", "Sign in again; the session could not be renewed.")
        }
        try { return api().request(method, path, state.getJSONObject("session").getString("accessToken"), body) }
        catch (error: ApiFailure) {
            if (error.status == 401) clearLocal()
            if (error.status == 403) { clearViews(); stopCollection() }
            throw error
        }
    }
    private fun device(method: String, suffix: String, body: JSONObject? = null): JSONObject {
        try {
            return api().request(method, "/devices/${deviceId()}$suffix", state.getJSONObject("device").getString("token"), body) as JSONObject
        } catch (error: ApiFailure) {
            if (error.status == 401) { forgetDevice(); lastSync = "Device credential revoked; enrol again." }
            throw error
        }
    }
    private fun clearViews() {
        subscription = null
        businessOverview = null
        familyOverview = null; familyDetail = null; familySync = "Family policy not checked"
        profile = null; devices = emptyList(); computers = emptyList(); commands = emptyMap()
        report = null; applicationReport = null; applicationQuery = null; rules = emptyList(); alerts = emptyList(); notifications = emptyList(); preferences = JSONObject()
    }
    @Synchronized fun clearLocal() {
        schedule(false); store.clear(); state = JSONObject(); workspaces = emptyList(); clearViews(); disclosures = JSONObject()
    }
    @Synchronized fun signIn(base: String, email: String, password: String, displayName: String? = null) {
        require(!state.has("session")) { "Sign out before switching accounts." }
        val normalized = Policy.apiBase(base)
        val body = json("email" to email.trim(), "password" to password)
        displayName?.let { body.put("displayName", it.trim()) }
        val result = transport(normalized).request("POST", if (displayName == null) "/auth/login" else "/auth/register", body = body) as JSONObject
        state = json("base" to normalized, "session" to result, "installationId" to UUID.randomUUID().toString(), "collect" to false)
        save(); refresh()
    }
    @Synchronized fun publicAction(base: String, path: String, body: JSONObject) {
        require(path in setOf("/auth/password/forgot", "/auth/password/reset", "/auth/verification/confirm"))
        transport(Policy.apiBase(base)).request("POST", path, body = body)
    }
    @Synchronized fun refresh() {
        clearViews()
        profile = account("GET", "/auth/me") as JSONObject
        workspaces = (account("GET", "/workspaces") as JSONArray).objects()
        if (workspaces.none { it.getString("id") == state.optString("workspaceId") }) {
            stopCollection(); state.remove("device")
            state.put("workspaceId", workspaces.firstOrNull()?.getString("id") ?: "")
            clearViews(); save()
            profile = account("GET", "/auth/me") as JSONObject
        }
        disclosures = api().request("GET", "/privacy/disclosures") as JSONObject
        preferences = account("GET", "/notifications/preferences") as JSONObject
        if (state.optString("workspaceId").isBlank()) return
        devices = (account("GET", "/workspaces/${workspace()}/devices") as JSONArray).objects()
        val selectedRole = workspaces.firstOrNull { it.optString("id") == workspace() }?.optString("role")
        computers = if (selectedRole in setOf("OWNER", "ADMIN", "GUARDIAN", "MEMBER", "VIEWER", "ANALYST"))
            (account("GET", "/workspaces/${workspace()}/developer") as JSONArray).objects() else emptyList()
        commands = computers.associate { c ->
            val id = Policy.uuid(c.getString("id"))
            id to (account("GET", "/workspaces/${workspace()}/agents/$id/commands") as JSONArray).objects()
        }
        rules = (account("GET", "${path()}/rules") as JSONArray).objects()
        alerts = (account("GET", "${path()}/alerts") as JSONArray).objects()
        notifications = (account("GET", "${path()}/notifications") as JSONArray).objects()
        ownDevice()?.let { own ->
            devices.firstOrNull { it.getString("id") == own.getString("id") }?.let {
                state.getJSONObject("device").put("public", it); save()
            }
        }
    }
    @Synchronized fun refreshSubscription() {
        subscription = null
        subscription = account("GET", "/workspaces/${workspace()}/billing/entitlements") as JSONObject
    }
    @Synchronized fun refreshBusiness() {
        businessOverview = null
        require(workspaces.any { it.optString("id") == workspace() && it.optString("type") == "BUSINESS" }) { "Choose a Business organization." }
        businessOverview = account("GET", "/workspaces/${workspace()}/business") as JSONObject
    }
    @Synchronized fun acceptBusinessSharing(deviceId: String, revision: Int, generation: Int, accepted: Boolean) {
        require(accepted && revision > 0 && generation > 0) { "Review business-sharing-v1 and accept explicitly." }
        account("POST", "/workspaces/${workspace()}/business/devices/${Policy.uuid(deviceId)}/sharing", json("expectedRevision" to revision, "generation" to generation, "accepted" to true, "disclosureVersion" to "business-sharing-v1"))
        refreshBusiness()
    }
    @Synchronized fun withdrawBusinessSharing(deviceId: String) {
        account("DELETE", "/workspaces/${workspace()}/business/devices/${Policy.uuid(deviceId)}/assignment")
        refreshBusiness()
    }
    @Synchronized fun refreshFamily(profileId: String? = null) {
        val requestedProfile = profileId ?: familyDetail?.optJSONObject("profile")?.optString("id")
        familyOverview = null; familyDetail = null
        if (workspaces.firstOrNull { it.getString("id") == state.optString("workspaceId") }?.optString("type") != "FAMILY") return
        val base = "/workspaces/${workspace()}/family"
        val overview = account("GET", base) as JSONObject
        familyOverview = overview
        val profiles = overview.getJSONArray("profiles").objects()
        val selected = profiles.firstOrNull { it.getString("id") == requestedProfile } ?: profiles.firstOrNull()
        if (selected != null) familyDetail = account("GET", "$base/profiles/${Policy.uuid(selected.getString("id"))}") as JSONObject
    }
    private fun familyPath(): String = "/workspaces/${workspace()}/family/profiles/${Policy.uuid(familyDetail?.getJSONObject("profile")?.getString("id") ?: error("Choose a child profile."))}"
    @Synchronized fun withdrawOwnFamily(id: String) {
        account("DELETE", "/devices/${Policy.uuid(id)}/family-assignment"); refreshFamily()
    }
    @Synchronized fun consentFamily() {
        val selected = familyDetail!!.getJSONObject("profile").getString("id")
        account("POST", "${familyPath()}/devices", json("deviceId" to deviceId(), "accepted" to true, "disclosureVersion" to "family-sharing-v1"))
        refreshFamily(selected)
    }
    @Synchronized fun withdrawFamily(id: String) {
        val selected = familyDetail!!.getJSONObject("profile").getString("id")
        account("DELETE", "${familyPath()}/devices/${Policy.uuid(id)}"); refreshFamily(selected)
    }
    @Synchronized fun familyTime(id: String, minutes: Int, reason: String, direct: Boolean) {
        require(minutes in 1..120 && reason.isNotBlank() && reason.length <= 200)
        val selected = familyDetail!!.getJSONObject("profile").getString("id")
        val revision = familyDetail!!.getJSONObject("policy").getInt("revision")
        account("POST", "${familyPath()}/${if (direct) "overrides" else "requests"}", json("id" to Policy.uuid(id), "minutes" to minutes,
            "reason" to reason, "policyRevision" to revision)); refreshFamily(selected)
    }
    @Synchronized fun decideFamily(requestId: String, decision: String) {
        require(decision in listOf("approved", "rejected", "cancelled"))
        val selected = familyDetail!!.getJSONObject("profile").getString("id")
        account("PATCH", "${familyPath()}/requests/${Policy.uuid(requestId)}", json("decision" to decision)); refreshFamily(selected)
    }
    @Synchronized fun checkFamilyPolicy() {
        familySync = "Family policy unavailable; no restriction is applied"
        if (!state.has("device")) return
        val config = device("GET", "/configuration")
        val generation = config.getInt("generation")
        val response = device("POST", "/family/configuration", json("generation" to generation))
        val receipt = FamilyWire.receipt(response, generation)
        if (receipt != null) {
            device("POST", "/family/receipt", receipt)
            familySync = "Policy revision ${receipt.getInt("policyRevision")}: ${receipt.getString("status")}. No device restriction is claimed applied."
        } else familySync = "No current authorized family policy for this device"
    }
    @Synchronized fun refreshDeveloper() {
        computers = emptyList(); commands = emptyMap()
        val selectedRole = workspaces.firstOrNull { it.optString("id") == workspace() }?.optString("role")
        computers = if (selectedRole in setOf("OWNER", "ADMIN", "GUARDIAN", "MEMBER", "VIEWER", "ANALYST"))
            (account("GET", "/workspaces/${workspace()}/developer") as JSONArray).objects() else emptyList()
        commands = computers.associate { c ->
            val id = Policy.uuid(c.getString("id"))
            id to (account("GET", "/workspaces/${workspace()}/agents/$id/commands") as JSONArray).objects()
        }
    }
    @Synchronized fun selectWorkspace(id: String) {
        require(workspaces.any { it.getString("id") == id })
        state.put("workspaceId", Policy.uuid(id)); clearViews(); save(); refresh()
    }
    @Synchronized fun signOut() {
        try { account("POST", "/auth/logout") } finally { clearLocal() }
    }
    @Synchronized fun updateProfile(name: String) { account("PATCH", "/auth/me", json("displayName" to name)); refresh() }
    @Synchronized fun appearance(theme: String) {
        require(theme in listOf("SYSTEM", "LIGHT", "DARK"))
        account("PATCH", "/auth/preferences", json("theme" to theme, "reducedMotion" to (profile?.optJSONObject("preferences")?.optBoolean("reducedMotion") ?: false))); refresh()
    }
    @Synchronized fun notificationPreferences(inApp: Boolean, email: Boolean? = null) {
        // Push delivery is unavailable until registration/provider phases.
        val body = json("inApp" to inApp, "push" to false)
        if (email != null) body.put("email", email)
        account("PATCH", "/notifications/preferences", body); refresh()
    }
    @Synchronized fun requestVerification() { account("POST", "/auth/verification/request") }
    @Synchronized fun export(password: String): String = (account("POST", "/privacy/export", json("password" to password)) as JSONObject).toString(2)
    @Synchronized fun deleteAccount(password: String) {
        account("DELETE", "/privacy/account", json("password" to password, "confirmation" to "DELETE")); clearLocal()
    }
    @Synchronized fun enrol(name: String, accepted: Boolean) {
        require(accepted && disclosures.getJSONObject("enrolment").getString("version") == "device-enrolment-v1")
        require(!state.has("device")) { "Remove the current local pairing first." }
        val code = account("POST", "/devices/enrolments", json("workspaceId" to workspace(),
            "installationId" to state.getString("installationId"), "platform" to "ANDROID")) as JSONObject
        val result = account("POST", "/devices/enrol", json("token" to code.getString("token"), "name" to name,
            "accepted" to true, "disclosureVersion" to "device-enrolment-v1")) as JSONObject
        val paired = result.getJSONObject("device")
        state.put("device", json("id" to paired.getString("id"), "workspaceId" to workspace(),
            "token" to result.getString("deviceToken"), "public" to paired))
        save(); refresh()
    }
    private fun stopCollection() {
        state.put("collect", false).put("appUsage", false).put("queue", JSONArray()).remove("cursor")
        state.remove("appCheckpoint"); state.remove("pendingPermissionHealth")
        schedule(false); save()
    }
    private fun forgetDevice() { stopCollection(); state.remove("device"); save() }
    @Synchronized fun deviceAction(action: String) {
        require(action in setOf("pause", "revoke", "unenrol", "erase", "remove"))
        // Stop locally before attempting an irreversible server mutation; no offline replay.
        stopCollection()
        require(state.getJSONObject("device").getString("workspaceId") == workspace())
        val id = deviceId()
        when (action) {
            "pause" -> account("POST", "/devices/$id/pause")
            "revoke" -> account("DELETE", "/devices/$id/consent")
            "unenrol" -> account("POST", "/devices/$id/unenrol")
            "erase" -> account("DELETE", "/devices/$id/data")
            "remove" -> account("DELETE", "/devices/$id")
        }
        if (action in setOf("erase", "unenrol", "remove")) forgetDevice()
        refresh()
    }
    @Synchronized fun consent(accepted: Boolean, appsAccepted: Boolean = false) {
        require(accepted && disclosures.getJSONObject("monitoring").getString("version") == "monitoring-v3")
        require(usage.granted()) { "Grant usage access in Android Settings first." }
        require(state.getJSONObject("device").getString("workspaceId") == workspace())
        if (appsAccepted) require(disclosures.getJSONObject("applications").getString("version") == "app-usage-v1")
        stopCollection()
        val grant = json("accepted" to true, "disclosureVersion" to "monitoring-v3", "scopes" to JSONArray(if (appsAccepted) listOf("network_usage", "app_usage") else listOf("network_usage")))
        if (appsAccepted) grant.put("appUsageDisclosureVersion", "app-usage-v1")
        account("POST", "/devices/${deviceId()}/consent", grant)
        val configuration = device("GET", "/configuration")
        applyConfiguration(configuration)
        state.put("consentStart", clock())
        state.put("collect", true).put("appUsage", appsAccepted).put("cursor", clock()).put("generation", configuration.getInt("generation"))
        save(); schedule(true); refresh()
    }
    private fun applyConfiguration(configuration: JSONObject) {
        val binding = state.getJSONObject("device")
        require(configuration.getString("deviceId") == binding.getString("id") &&
            configuration.getString("workspaceId") == binding.getString("workspaceId"))
        state.put("configurationCheckedAt", clock())
        if (!(0 until configuration.getJSONArray("consentScopes").length()).any { configuration.getJSONArray("consentScopes").getString(it) == "app_usage" }) {
            state.put("appUsage", false); state.remove("appCheckpoint")
        }
        val gen = configuration.getInt("generation")
        if (gen != state.optInt("generation") || !configuration.getBoolean("monitoringEnabled")) {
            state.put("queue", JSONArray()).put("cursor", clock()).put("generation", gen)
            state.remove("appCheckpoint")
        }
        if (!configuration.getBoolean("monitoringEnabled") ||
            !configuration.getJSONArray("consentScopes").toString().contains("\"network_usage\"")) stopCollection()
    }
    private fun healthBatteryRestricted(): Boolean = usage.metadata().optString("batteryOptimizationStatus") == "restricted"
    @Synchronized fun sync(manual: Boolean = false) {
        if (!state.has("session") || !state.has("device")) return
        try { checkFamilyPolicy() } catch (error: ApiFailure) {
            familySync = "Policy synchronization unavailable; no restriction is applied"
            if (error.status == 401) throw error
        } catch (_: Exception) { familySync = "Policy synchronization unavailable; no restriction is applied" }
        if (!state.has("device")) return
        if (state.optBoolean("pendingPermissionHealth")) {
            val config = device("GET", "/configuration")
            device("POST", "/heartbeat", usage.metadata().put("generation", config.getInt("generation")).put("permissionStatus", "revoked").put("monitoringHealth", "permission_required"))
            state.remove("pendingPermissionHealth"); save(); schedule(false)
            return
        }
        if (!state.optBoolean("collect")) return
        try {
            if (!usage.granted()) {
                val health = usage.metadata().put("generation", state.getInt("generation"))
                    .put("permissionStatus", "revoked").put("monitoringHealth", "permission_required")
                stopCollection()
                state.put("pendingPermissionHealth", true); save(); schedule(true)
                lastSync = "Usage access withdrawn; local collection cleared. Health report awaits acknowledgement."
                device("POST", "/heartbeat", health)
                state.remove("pendingPermissionHealth"); save(); schedule(false)
                return
            }
            val now = clock()
            val historyAge = if (state.optBoolean("appUsage")) 86_400_000L else Policy.QUEUE_AGE_MS
            if (state.optLong("cursor") < now-historyAge) { state.put("cursor",now-historyAge); state.remove("appCheckpoint") }
            val queue = state.optJSONArray("queue")?.objects()?.filter { Policy.retained(it.getLong("createdAt"), now) }?.toMutableList() ?: mutableListOf()
            if (queue.size <= Policy.MAX_QUEUE - (if (state.optBoolean("appUsage")) 2 else 1) && now >= state.optLong("configurationCheckedAt") &&
                now - state.optLong("configurationCheckedAt") <= 86_400_000L) {
                Policy.interval(state.optLong("cursor"), now)?.let { window ->
                    val oldCursor = state.optLong("cursor")
                    val oldCheckpoint = state.optJSONObject("appCheckpoint")
                    val oldSize = queue.size
                    val end = if (state.optBoolean("appUsage")) minOf(window.last, window.first + 6*3_600_000L) else window.last
                    val readings = usage.read(window.first, end)
                    val batch = Wire.batch(state.getJSONObject("device").getString("workspaceId"), deviceId(), state.getInt("generation"), window.first, end, readings, now)
                    queue.add(json("createdAt" to now, "attempts" to 0, "nextAt" to 0, "body" to batch))
                    if (state.optBoolean("appUsage")) {
                        val observation = usage.applications(window.first, end, ApplicationWire.checkpoint(state.optJSONObject("appCheckpoint")))
                            ?: ApplicationObservation(com.netsentry.app.core.TimelineReducer.unavailable(window.first, end), emptyList())
                        val rich = ApplicationWire.batch(state.getJSONObject("device").getString("workspaceId"), deviceId(), state.getInt("generation"), window.first, end, now, observation)
                        queue.add(json("kind" to "applications", "createdAt" to now, "attempts" to 0, "nextAt" to 0, "body" to rich))
                        state.put("appCheckpoint", ApplicationWire.checkpoint(observation.timeline.checkpoint))
                    }
                    state.put("cursor", end)
                    if (JSONArray(queue).toString().toByteArray(Charsets.UTF_8).size > 1_000_000) {
                        while (queue.size > oldSize) queue.removeAt(queue.lastIndex)
                        state.put("cursor", oldCursor)
                        if (oldCheckpoint == null) state.remove("appCheckpoint") else state.put("appCheckpoint", oldCheckpoint)
                        lastSync = "Queue byte capacity reached; collection waits for uploads."
                    }
                }
            }
            state.put("queue", JSONArray(queue)); save()
            val config = device("GET", "/configuration")
            val previousGeneration = state.getInt("generation")
            applyConfiguration(config); save()
            if (!state.optBoolean("collect")) { lastSync = "Collection paused by current configuration."; return }
            if (previousGeneration != config.getInt("generation")) {
                lastSync = "Configuration changed; stale batches discarded. Collecting fresh intervals."
                return
            }
            // Fresh capability evidence is obtained on each attempt; permission loss never becomes zero usage.
            val probe = usage.read(now - 60_000, now)
            val probeStart = maxOf(now-60_000, state.optLong("consentStart", now-60_000))
            val appProbe = if (state.optBoolean("appUsage") && now>probeStart) usage.applications(probeStart, now, null) else null
            val capabilities = Wire.capabilities(config.getString("workspaceId"), deviceId(), probe, now)
            if (state.optBoolean("appUsage")) {
                val available = appProbe != null && appProbe.timeline.issues.none { it in setOf("stream_unavailable", "event_limit", "window_limit") }
                ApplicationWire.capabilities(now, available, available && appProbe?.timeline?.issues?.contains("screen_api_unavailable") == false).forEach { capabilities.getJSONArray("capabilities").put(it) }
            }
            val needsPermission = !usage.granted() || probe.any { it.bytes == null && it.failure == "permission_unavailable" }
            val health = usage.metadata().put("generation", config.getInt("generation"))
                .put("permissionStatus", if (needsPermission) "denied" else "granted")
                .put("monitoringHealth", when {
                    needsPermission -> "permission_required"
                    probe.none { it.bytes != null } || (state.optBoolean("appUsage") && (appProbe == null || appProbe.timeline.issues.contains("stream_unavailable"))) -> "unknown"
                    healthBatteryRestricted() -> "battery_setup_required"
                    else -> "healthy"
                })
                .put("capabilityReport", capabilities)
            applyConfiguration(device("POST", "/heartbeat", health))
            if (!state.optBoolean("collect")) { lastSync = "Permission or consent withdrawn; local queue cleared."; return }
            repeat(4) {
                val first = queue.firstOrNull() ?: run { lastSync = "No completed collection interval yet."; return }
                val body = first.getJSONObject("body")
                val stamp = QueueStamp(body.getString("batchId"), body.getInt("generation"), first.getLong("createdAt"), first.getInt("attempts"))
                if (manual && stamp.attempts >= Policy.MAX_ATTEMPTS) first.put("attempts", 0)
                if ((!manual && first.getLong("nextAt") > now) ||
                    !stamp.copy(attempts = first.getInt("attempts")).eligible(config.getInt("generation"), true, now)) { lastSync = "Upload waiting for retry; oldest exhausted batch needs manual retry."; return }
                require(stamp.generation == config.getInt("generation"))
                first.put("attempts", first.getInt("attempts") + 1)
                    .put("nextAt", now + minOf(300_000L, Policy.retryDelay(first.getInt("attempts")) + kotlin.random.Random.nextLong(1000)))
                save() // Persist the exact UUID/payload and attempt before sending.
                device("POST", if (first.optString("kind") == "applications") "/application-usage" else "/measurements", body)
                queue.removeAt(0); state.put("queue", JSONArray(queue)); save()
                lastSync = "Last confirmed upload: ${Policy.timestamp(clock())}. ${queue.size} queued."
            }
        } catch (error: ApiFailure) {
            lastSync = "Sync not confirmed (${error.code})."
            error.retryAfterMs?.let { delay ->
                state.optJSONArray("queue")?.optJSONObject(0)?.put("nextAt", clock() + delay.coerceIn(1000, 300_000))
                save()
            }
            if (error.status in setOf(400, 401, 403, 409)) stopCollection()
            throw error
        } catch (error: Exception) { lastSync = "Offline or collection unavailable; pending batches retained within limits."; throw error }
    }
    @Synchronized fun loadReport(period: String, metric: String) {
        require(metric in setOf("mobile_data_bytes", "wifi_data_bytes"))
        val zone = workspaces.first { it.getString("id") == workspace() }.getString("timezone")
        val (from, to) = Policy.reportDates(period, zone, clock())
        val deviceFilter = ownDevice()?.takeIf { it.getString("workspaceId") == workspace() }?.getString("id")
        require(deviceFilter != null) { "Enrol this phone in the selected workspace first." }
        report = account("GET", "${path()}/usage?from=$from&to=$to&period=$period&metric=$metric&deviceId=${Policy.uuid(deviceFilter)}") as JSONObject
    }
    @Synchronized fun saveAllowance(metric: String, period: String, bytes: Long, quality: String) {
        require(metric in setOf("mobile_data_bytes", "wifi_data_bytes") && period in setOf("day", "week", "month"))
        require(bytes in 1..9_007_199_254L && quality in setOf("measured", "estimated"))
        require(ownDevice()?.getString("workspaceId") == workspace())
        account("POST", "${path()}/rules", json("kind" to "threshold", "metric" to metric,
            "deviceId" to deviceId(), "period" to period, "threshold" to bytes, "quality" to quality, "severity" to "warning",
            "channels" to JSONArray(listOf("in_app")), "enabled" to true)); refresh()
    }
    private fun ownWorkspaceDevice() {
        require(state.getJSONObject("device").getString("workspaceId") == workspace()) { "Select this phone's workspace first." }
    }
    @Synchronized fun loadApplications(period: String, applicationId: String? = null, categoryId: String? = null, device: String? = null) {
        val id = Policy.uuid(device ?: deviceId())
        require(devices.any { it.getString("id") == id } || id == deviceId())
        val zone = workspaces.first { it.getString("id") == workspace() }.getString("timezone")
        val (from, to) = Policy.reportDates(period, zone, clock())
        val app = applicationId?.takeIf { it.isNotBlank() }?.let { "&applicationId=" + java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        val category = categoryId?.takeIf { it.isNotBlank() }?.let { "&categoryId=" + java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        applicationReport = null; applicationQuery = null
        val query = "deviceId=$id&from=$from&to=$to&period=$period$app$category"
        applicationReport = account("GET", "${path()}/application-usage?$query") as JSONObject
        applicationQuery = query
    }
    @Synchronized fun exportApplications(): String {
        requireNotNull(applicationReport) { "Load an application report first." }
        val query = requireNotNull(applicationQuery)
        val result = account("GET", "${path()}/application-export?$query") as JSONObject
        return result.getString("content")
    }
    @Synchronized fun createCategory(name: String) { ownWorkspaceDevice(); account("POST", "${path()}/application-categories", json("deviceId" to deviceId(),"name" to name)) }
    @Synchronized fun removeCategory(id: String) { ownWorkspaceDevice(); account("DELETE", "${path()}/application-categories/${Policy.uuid(id)}?deviceId=${deviceId()}") }
    @Synchronized fun correctApplication(id: String, category: String?) { ownWorkspaceDevice(); account("PATCH", "${path()}/application-classification", json("deviceId" to deviceId(),"applicationId" to id,"categoryId" to category)) }
    @Synchronized fun usageLimit(metric: String, period: String, seconds: Long, applicationId: String? = null) {
        ownWorkspaceDevice()
        require(metric in setOf("screen_time_seconds","application_foreground_seconds") && period in setOf("day","week","month") && seconds > 0)
        require((metric == "application_foreground_seconds") == !applicationId.isNullOrBlank())
        val input = json("kind" to "threshold","metric" to metric,"period" to period,"threshold" to seconds,"deviceId" to deviceId(),"quality" to "estimated","severity" to "warning","channels" to JSONArray(listOf("in_app")),"enabled" to true)
        if (applicationId != null) input.put("applicationId", applicationId)
        account("POST", "${path()}/rules", input); refresh()
    }
    @Synchronized fun healthAlert(kind: String, seconds: Long = 3600) {
        ownWorkspaceDevice(); require(kind in setOf("device_offline","permission_revoked","not_reporting"))
        account("POST", "${path()}/rules", json("kind" to kind,"period" to "day","threshold" to if (kind == "permission_revoked") 1 else seconds,
            "deviceId" to deviceId(),"severity" to "warning","channels" to JSONArray(listOf("in_app")),"enabled" to true)); refresh()
    }
    @Synchronized fun removeRule(id: String) { account("DELETE", "${path()}/rules/${Policy.uuid(id)}"); refresh() }
    @Synchronized fun acknowledge(id: String) { account("POST", "${path()}/alerts/${Policy.uuid(id)}/acknowledge"); refresh() }
    @Synchronized fun remote(intent: RemoteIntent) {
        // Re-read permission and exact observation immediately. No worker/offline command queue exists.
        val latest = (account("GET", "/workspaces/${workspace()}/developer") as JSONArray).objects()
        val computer = latest.firstOrNull { it.getString("id") == intent.agentId } ?: throw ObservationChanged()
        val service = computer.array("services").firstOrNull { it.getString("observationId") == intent.observationId && it.getString("serviceId") == intent.serviceId } ?: throw ObservationChanged()
        intent.check(clock(), computer.getBoolean("canControl"), service.getBoolean("canStop"))
        account("POST", "/workspaces/${workspace()}/agents/${Policy.uuid(intent.agentId)}/commands", Wire.command(intent))
        refresh()
    }
    @Synchronized fun cancel(agentId: String, commandId: String) {
        account("POST", "/workspaces/${workspace()}/agents/${Policy.uuid(agentId)}/commands/${Policy.uuid(commandId)}/cancel"); refresh()
    }
}
