package com.netsentry.app.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.netsentry.app.core.Policy
import com.netsentry.app.core.RemoteIntent
import com.netsentry.app.data.Repository
import com.netsentry.app.data.array
import com.netsentry.app.data.json
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.time.Instant

@Composable fun PersonalApp(model: PersonalViewModel = viewModel()) {
    val state = model.view
    val context = LocalContext.current
    val exportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val contents = model.exported
        if (uri != null && contents != null) {
            // The user selects the destination; never put exports into public storage automatically.
            try {
                context.contentResolver.openOutputStream(uri)?.use { it.write(contents.toByteArray()) }
                    ?: error("No writable destination")
                model.exportSaved()
            } catch (_: Exception) { model.storageError() }
        }
    }
    var tab by remember { mutableStateOf("Phone") }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(state?.signedIn, state?.workspaceId, tab) {
        if (state?.signedIn == true && tab == "Family") {
            model.run("Family observations refreshed") { refreshFamily() }
            while (true) {
                delay(30000)
                if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) && !model.busy)
                    model.run("Family observations refreshed") { refreshFamily() }
            }
        }
        if (state?.signedIn == true && tab == "Computers") {
            while (true) {
                delay(5000)
                if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) && !model.busy)
                    model.run("Updated computer outcomes") { refreshDeveloper() }
            }
        }
    }
    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.safeDrawingPadding()
            .verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("NetSentry", style = MaterialTheme.typography.headlineLarge)
            Text("Android personal application", style = MaterialTheme.typography.titleMedium)
            if (model.busy) CircularProgressIndicator()
            if (model.message.isNotBlank()) Text(model.message)
            if (state?.signedIn != true) {
                SignIn(model, state?.base ?: "")
            } else key(state.profile?.optString("id"), state.workspaceId) {
                Text(state.profile?.optString("displayName") ?: "Account")
                if (state.profile?.isNull("emailVerifiedAt") != false) {
                    Text("Verify your email before enrolling this phone or requesting service controls.")
                    Action("Send verification email", model) { requestVerification() }
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Phone", "Usage", "Apps", "Family", "Computers", "Settings").forEach { label ->
                        OutlinedButton(onClick = { tab = label }, enabled = !model.busy) { Text(label) }
                    }
                }
                Panel("Workspace") {
                    state.workspaces.forEach { workspace ->
                        OutlinedButton(onClick = { model.run("Workspace selected") { selectWorkspace(workspace.getString("id")) } }, enabled = !model.busy) {
                            Text("${if (workspace.getString("id") == state.workspaceId) "✓ " else ""}${workspace.optString("name")} · ${workspace.optString("role")}")
                        }
                    }
                    Action("Refresh account and workspace", model) { refresh() }
                }
                when (tab) {
                    "Phone" -> Phone(state, model)
                    "Usage" -> Usage(state, model)
                    "Apps" -> ApplicationScreen(state, model)
                    "Family" -> FamilyScreen(state, model)
                    "Computers" -> Computers(state, model)
                    else -> SettingsScreen(state, model)
                }
            }
            HorizontalDivider()
            Text("Native build, permissions, accounting accuracy, background behavior and phone remote-stop acceptance await physical-device testing.", style = MaterialTheme.typography.bodySmall)
            var clear by remember { mutableStateOf(false) }
            TextButton(onClick = { clear = true }, enabled = !model.busy) { Text("Clear this app's local session and data") }
            if (clear) Confirm("Clear local data?", "This stops local work and clears credentials and queued data. It does not revoke server credentials or delete server records. Use account/device controls for that.",
                onClose = { clear = false }, onConfirm = { clear = false; model.clearLocal() })
        }
    }
    if (model.exported != null) AlertDialog(onDismissRequest = model::closeExport,
        title = { Text(if (model.exportKind == "applications") "Application CSV ready" else "Personal export ready") }, text = { Text("This file contains personal data. Choose a private destination; copies you save are your responsibility.") },
        confirmButton = { TextButton(onClick = { exportFile.launch(if (model.exportKind == "applications") "netsentry-applications.csv" else "netsentry-personal-export.json") }) { Text("Choose save location") } },
        dismissButton = { TextButton(onClick = model::closeExport) { Text("Discard") } })
}

@Composable private fun SignIn(model: PersonalViewModel, currentBase: String) {
    var base by remember { mutableStateOf(currentBase) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var registration by remember { mutableStateOf(false) }
    var token by remember { mutableStateOf("") }
    Panel(if (registration) "Create your account" else "Sign in") {
        Text("Enter your deployed HTTPS API address ending in /api/v1. Credentials are encrypted using Android Keystore; no monitoring starts at sign-in.")
        Input("HTTPS API address", base, { base = it })
        Input("Email", email, { email = it }, keyboard = KeyboardType.Email)
        if (registration) Input("Display name", name, { name = it })
        Input("Password (12+ characters for registration)", password, { password = it }, secret = true)
        Button(onClick = {
            val secret = password; password = ""
            model.run(if (registration) "Account created; check your verification email." else "Signed in") {
                signIn(base, email, secret, if (registration) name else null)
            }
        }, enabled = !model.busy && base.isNotBlank() && email.isNotBlank() && password.isNotEmpty()) { Text(if (registration) "Create account" else "Sign in") }
        TextButton(onClick = { registration = !registration; password = "" }) { Text(if (registration) "Use an existing account" else "Register") }
        Action("Send password recovery email", model) { publicAction(base, "/auth/password/forgot", json("email" to email)) }
        Input("Verification or recovery token from email", token, { token = it }, secret = true)
        Button(onClick = { val code = token; token = ""; model.run("Email verification submitted") { publicAction(base, "/auth/verification/confirm", json("token" to code)) } }, enabled = !model.busy && token.isNotBlank()) { Text("Verify email token") }
        Button(onClick = {
            val code = token; val secret = password; token = ""; password = ""
            model.run("Password reset; sign in with the new password") { publicAction(base, "/auth/password/reset", json("token" to code, "password" to secret)) }
        }, enabled = !model.busy && token.isNotBlank() && password.length >= 12) { Text("Reset password using token and password above") }
    }
}

@Composable private fun Phone(state: Repository.View, model: PersonalViewModel) {
    val context = LocalContext.current
    fun open(action: String) {
        try { context.startActivity(Intent(action)) }
        catch (_: ActivityNotFoundException) { model.storageError() }
    }
    Panel("Permissions and monitoring health") {
        Text("Usage access is a separate Android setting, not a runtime permission dialog. It allows aggregate phone data queries; App/screen usage needs the separate app-usage-v1 choice below. No contacts, messages, subscriber identifiers or location are requested.")
        OutlinedButton(onClick = { open(Settings.ACTION_USAGE_ACCESS_SETTINGS) }) { Text("Review usage access") }
        Text("Battery optimizations may delay 15-minute work. No continuous collection is promised. Review the system settings yourself; NetSentry does not request an automatic exemption.")
        OutlinedButton(onClick = { open(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS) }) { Text("Review battery settings") }
        Text("Hotspot state/client counts and per-client traffic: unavailable on this public API 35 baseline. Phone totals are not tethered-client measurements.")
        OutlinedButton(onClick = { open(Settings.ACTION_WIRELESS_SETTINGS) }) { Text("Open wireless settings") }
    }
    val own = state.ownDevice
    if (own == null) {
        var name by remember { mutableStateOf("My Android phone") }
        var accepted by remember { mutableStateOf(false) }
        Panel("Enrol this installation") {
            Text(state.disclosures.optJSONObject("enrolment")?.optString("text") ?: "Refresh to load the current disclosure.")
            Input("Phone name", name, { name = it })
            Check("I accept device-enrolment-v1 for this workspace", accepted, { accepted = it })
            Action("Enrol phone", model, accepted) { enrol(name, accepted) }
        }
    } else {
        Panel("This phone") {
            Text("${own.optString("name")} · ${own.optString("state")}")
            Text("Workspace: ${own.optString("workspaceId")}")
            Text("Server monitoring: ${own.optBoolean("monitoringEnabled")} · local collection: ${state.localEnabled}")
            Text("Permission: ${own.optString("permissionStatus")} · health: ${own.optString("monitoringHealth")} · battery: ${own.optString("batteryOptimizationStatus")}")
            Text("Last seen: ${own.optString("lastSeenAt")} · last server sync: ${own.optString("lastSyncedAt")}")
            Text("${state.syncStatus} · ${state.queueSize} queued batches")
            own.optJSONObject("capabilityReport")?.array("capabilities")?.forEach { Text("${it.optString("id")}: ${it.optString("status")} — ${it.optString("reason")}") }
            if (own.optString("workspaceId") != state.workspaceId) Text("Select the phone's workspace to manage it.")
            else {
                var accepted by remember { mutableStateOf(false) }
                var appsAccepted by remember { mutableStateOf(false) }
                Text(state.disclosures.optJSONObject("monitoring")?.optString("text") ?: "Refresh to load monitoring disclosure.")
                Check("I accept monitoring-v3 for network usage only", accepted, { accepted = it })
                Text(state.disclosures.optJSONObject("applications")?.optString("text") ?: "Refresh to load the additional application-usage disclosure.")
                Check("I also accept app-usage-v1 for app/screen timelines and counts", appsAccepted, { appsAccepted = it })
                Action("Enable selected collection with fresh consent", model, accepted) { consent(accepted, appsAccepted) }
                Text("Detailed application collection: ${state.appUsageEnabled}")
                Action("Collect and synchronize now / retry uploads", model, state.localEnabled) { sync(manual = true); refresh() }
                listOf("pause" to "Pause monitoring", "revoke" to "Revoke monitoring consent", "unenrol" to "Unenrol this phone", "erase" to "Erase phone data and credential", "remove" to "Remove phone from inventory").forEach { (action, label) ->
                    var confirm by remember { mutableStateOf(false) }
                    OutlinedButton(onClick = { confirm = true }, enabled = !model.busy) { Text(label) }
                    if (confirm) Confirm(label, "Local collection stops immediately. The server action requires connectivity; an error means it was not confirmed. Erase/remove/unenrol require fresh pairing before collection.",
                        onClose = { confirm = false }, onConfirm = { confirm = false; model.run("Device action confirmed") { deviceAction(action) } })
                }
            }
        }
    }
    Panel("Workspace devices") {
        if (state.devices.isEmpty()) Text("No devices available.")
        state.devices.forEach { Text("${it.optString("name")} · ${it.optString("platform")} · ${it.optString("state")} · ${it.optString("monitoringHealth")}") }
    }
}

@Composable private fun Usage(state: Repository.View, model: PersonalViewModel) {
    var metric by remember { mutableStateOf("mobile_data_bytes") }
    var period by remember { mutableStateOf("day") }
    var bytes by remember { mutableStateOf("") }
    var estimated by remember { mutableStateOf(true) }
    Panel("Mobile and Wi-Fi usage") {
        Text("Phone aggregate totals from Android OS accounting. Interval attribution is estimated and must be compared with Settings on a real phone. Missing values are not zero. Reporting uses workspace timezone.")
        Choices(listOf("mobile_data_bytes", "wifi_data_bytes"), metric) { metric = it }
        Choices(listOf("day", "week", "month"), period) { period = it }
        Action("Load usage report", model) { loadReport(period, metric) }
        state.report?.let { report ->
            Text("${report.optString("metric")} · ${report.optString("from")} to ${report.optString("to")} · ${report.optString("timezone")}")
            report.array("buckets").forEach { bucket ->
                Text("${bucket.optString("periodStart")}: measured ${nullable(bucket, "measured")} bytes; estimated ${nullable(bucket, "estimated")} bytes; missing ${bucket.optLong("missingMs") / 1000}s${if (bucket.optBoolean("prorated")) "; prorated" else ""}")
            }
            Text(report.optString("qualityNote"))
            report.array("declaredGaps").forEach { Text("Gap: ${it.optString("reason")} · ${it.optString("intervalStart")} – ${it.optString("intervalEnd")}") }
        }
    }
    Panel("Allowances and data alerts") {
        Text("Create a server threshold for this phone and chosen period. Alerts are evaluated by scheduled server maintenance; in-app delivery is available, push delivery is not configured.")
        Input("Allowance in bytes (maximum 9007199254)", bytes, { bytes = it }, keyboard = KeyboardType.Number)
        Check("Use estimated totals for this allowance (Android source)", estimated, { estimated = it })
        Text("Measured and estimated thresholds are separate; totals are never added together. Existing rules default to measured.")
        Action("Create allowance alert", model, bytes.toLongOrNull() != null) { saveAllowance(metric, period, bytes.toLong(), if (estimated) "estimated" else "measured") }
        state.rules.forEach { rule ->
            val config = rule.optJSONObject("config") ?: JSONObject()
            Text("${config.optString("metric")} · ${config.optString("period")} · threshold ${config.optString("threshold")} · ${config.optString("quality", "measured")} · enabled ${config.optBoolean("enabled")}")
            val report = state.report
            if (report != null && config.optString("metric") == report.optString("metric") && config.optString("period") == report.optString("period") && rule.optString("deviceId") == state.ownDevice?.optString("id")) {
                val buckets = report.array("buckets")
                val quality = config.optString("quality", "measured")
                val covered = buckets.any { !it.isNull(quality) }
                val used = buckets.sumOf { it.optString(quality).toDoubleOrNull() ?: 0.0 }
                val threshold = config.optDouble("threshold", 0.0)
                if (covered && threshold > 0) Text("Reported progress: ${"%.1f".format(used * 100 / threshold)}% (${config.optString("quality", "measured")} only; coverage may be incomplete).")
                else Text("Progress unknown: no covered usage yet.")
            }
            Action("Remove allowance ${rule.optString("id").take(8)}", model) { removeRule(rule.getString("id")) }
        }
        state.alerts.forEach { alert ->
            Text("${alert.optJSONObject("snapshot")?.optString("kind")} · ${alert.optString("createdAt")} · ${alert.optJSONObject("snapshot")?.optString("quality", "not specified")} · acknowledged ${!alert.isNull("acknowledgedAt")}")
            if (alert.isNull("acknowledgedAt")) Action("Acknowledge ${alert.optString("id").take(8)}", model) { acknowledge(alert.getString("id")) }
        }
        Text("In-app notifications")
        if (state.notifications.isEmpty()) Text("No notifications reported.")
        state.notifications.forEach { Text("${it.optJSONObject("snapshot")?.optString("kind")} · ${it.optJSONObject("snapshot")?.optString("quality", "not specified")} · ${it.optString("createdAt")}") }
    }
}

@Composable private fun Computers(state: Repository.View, model: PersonalViewModel) {
    var selected by remember { mutableStateOf<RemoteIntent?>(null) }
    var selectedDescription by remember { mutableStateOf("") }
    var includeChildren by remember { mutableStateOf(false) }
    var attempted by remember { mutableStateOf(false) }
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1000); now = System.currentTimeMillis() } }
    Panel("Paired developer computers") {
        Text("Sharing and named controller grants must be enabled separately on the computer and web dashboard. Offline/sleeping/revoked computers cannot be controlled. No command is queued for later reconnection.")
        Action("Refresh computers and command outcomes", model) { refreshDeveloper() }
        if (state.computers.isEmpty()) Text("No paired computers available.")
        state.computers.forEach { computer ->
            Panel(computer.optString("name")) {
                Text("${computer.optString("platform")} · ${computer.optString("connection")} · ${computer.optString("state")}")
                if (!computer.optBoolean("platformSupported")) Text("Native control unavailable on this computer.")
                if (!computer.optBoolean("localControlReady")) Text("Computer remote shutdown consent is not ready.")
                Text("Showing ${computer.array("services").size} of ${computer.optInt("total")} listeners (sharing is bounded to 32).")
                computer.array("services").forEach { service ->
                    Text("${service.optString("project")} · ${service.optString("runtime")} · PID ${service.optInt("pid")} · ports ${service.optJSONArray("ports")}")
                    Text("Started ${service.optString("startedAt")} · observed ${service.optString("observedAt")} · ${service.optInt("childCount")} captured descendants")
                    val observed = runCatching { Instant.parse(service.getString("observedAt")).toEpochMilli() }.getOrDefault(0)
                    val allowed = computer.optBoolean("canControl") && service.optBoolean("canStop") && now - observed in 0..10_000
                    listOf("graceful", "force").forEach { mode ->
                        OutlinedButton(onClick = {
                            selectedDescription = "${computer.optString("name")} · ${service.optString("project")} · ${service.optString("runtime")} · PID ${service.optInt("pid")} · ports ${service.optJSONArray("ports")} · started ${service.optString("startedAt")}"
                            selected = RemoteIntent(computer.getString("id"), service.getString("serviceId"), service.getString("observationId"), observed, mode, false, service.getInt("childCount"))
                            includeChildren = false; attempted = false
                        }, enabled = !model.busy && allowed) { Text(if (mode == "force") "Review force-stop" else "Review graceful stop") }
                    }
                }
                state.commands[computer.optString("id")]?.forEach { command ->
                    val target = command.optJSONObject("target")
                    Text("${target?.optString("project")} · PID ${target?.optInt("pid")} · ${command.optString("mode")}")
                    Text("${command.optString("state")} · ${nullable(command, "outcome")} · expires ${command.optString("expiresAt")}")
                    Text(if (command.isNull("startedAt")) "Execution not yet authorized to start." else "Execution started; cancellation cannot undo shutdown.")
                    command.array("audit").forEach { Text("${it.optString("event")} · ${it.optString("outcome")} · ${it.optString("occurredAt")}", style = MaterialTheme.typography.bodySmall) }
                    if (command.optString("state") in setOf("pending", "accepted") && command.isNull("startedAt") && computer.optBoolean("canControl"))
                        Action("Cancel ${command.optString("id").take(8)}", model) { cancel(computer.getString("id"), command.getString("id")) }
                }
            }
        }
    }
    selected?.let { intent ->
        AlertDialog(onDismissRequest = { if (!model.busy) selected = null },
            title = { Text(if (intent.mode == "force") "Confirm remote force-stop" else "Confirm remote graceful stop") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("This targets the captured process and its listeners. ${if (intent.mode == "force") "SIGKILL may discard unfinished work." else "SIGTERM may be ignored."} A supervisor may replace it.")
                Text(selectedDescription)
                Text("Service ${intent.serviceId.take(12)} · observation ${intent.observationId.take(12)}")
                Check("Include captured descendants (${intent.childCount}, maximum 16)", includeChildren, { includeChildren = it }, !attempted && intent.childCount <= 16)
                Text("Pending/accepted are not confirmed shutdown. Inspect command history for the result. Unknown or replacement outcomes need a fresh review.")
                if (now - intent.observedAt > 10_000) Text("This observation expired. Close, refresh and select again.")
            } },
            confirmButton = { TextButton(onClick = {
                val fixed = intent.copy(includeChildren = includeChildren)
                selected = fixed; attempted = true
                model.run("Request submitted; inspect the agent-confirmed outcome below.") { remote(fixed) }
            }, enabled = !model.busy && now - intent.observedAt in 0..10_000) { Text(if (attempted) "Retry same request" else "Confirm exact action") } },
            dismissButton = { TextButton(onClick = { selected = null }, enabled = !model.busy) { Text("Close") } })
    }
}

@Composable private fun SettingsScreen(state: Repository.View, model: PersonalViewModel) {
    var name by remember { mutableStateOf(state.profile?.optString("displayName") ?: "") }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var deleting by remember { mutableStateOf(false) }
    var token by remember { mutableStateOf("") }
    Panel("Profile and notifications") {
        Input("Display name", name, { name = it })
        Action("Save profile", model) { updateProfile(name) }
        Text("Email: ${state.profile?.optString("email")}")
        Text("In-app delivery: ${state.preferences.optBoolean("inApp")} · Push providers unavailable.")
        Action(if (state.preferences.optBoolean("inApp")) "Disable in-app notifications" else "Enable in-app notifications", model) { notificationPreferences(!state.preferences.optBoolean("inApp")) }
        Input("Email verification token", token, { token = it }, secret = true)
        Button(onClick = { val code = token; token = ""; model.run("Verification submitted") { publicAction(state.base, "/auth/verification/confirm", json("token" to code)); refresh() } }, enabled = !model.busy && token.isNotBlank()) { Text("Confirm verification token") }
    }
    Panel("Privacy and account") {
        Text("Only explicitly consented network totals and health metadata synchronize. Private state is encrypted with Android Keystore and excluded from backup. Pausing/revoking locally clears pending data. Server retention and deletion apply separately; saved exports and backups have their own lifecycle.")
        Text("API: ${state.base}")
        Input("Current password for export or deletion", password, { password = it }, secret = true)
        Button(onClick = { val secret = password; password = ""; model.export(secret) }, enabled = !model.busy && password.isNotEmpty()) { Text("Prepare personal data export") }
        Input("Type DELETE to delete your account", confirmation, { confirmation = it })
        OutlinedButton(onClick = { deleting = true }, enabled = !model.busy && password.isNotEmpty() && confirmation == "DELETE") { Text("Delete account and owned data") }
        if (deleting) Confirm("Permanently delete account?", "This deletes owned server records and revokes credentials. It requires connectivity and your current password. An owned shared workspace may require ownership transfer first.",
            onClose = { deleting = false }, onConfirm = { val secret = password; password = ""; confirmation = ""; deleting = false; model.run("Account deleted") { deleteAccount(secret) } })
        Action("Sign out and clear local credentials", model) { signOut() }
    }
}

private fun nullable(value: JSONObject, key: String): String = if (!value.has(key) || value.isNull(key)) "unknown" else value.optString(key)
@Composable internal fun Panel(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge); content()
        }
    }
}
@Composable internal fun Input(label: String, value: String, change: (String) -> Unit, secret: Boolean = false, keyboard: KeyboardType = KeyboardType.Text) {
    OutlinedTextField(value = value, onValueChange = change, label = { Text(label) }, modifier = Modifier.fillMaxWidth(),
        singleLine = true, visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (secret) KeyboardType.Password else keyboard))
}
@Composable private fun Check(label: String, checked: Boolean, change: (Boolean) -> Unit, enabled: Boolean = true) {
    Row { Checkbox(checked = checked, onCheckedChange = change, enabled = enabled); Text(label, Modifier.padding(top = 10.dp)) }
}
@Composable internal fun Action(label: String, model: PersonalViewModel, enabled: Boolean = true, action: Repository.() -> Unit) {
    Button(onClick = { model.run("Action confirmed", action) }, enabled = enabled && !model.busy) { Text(label) }
}
@Composable internal fun Choices(values: List<String>, selected: String, choose: (String) -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        values.forEach { value -> OutlinedButton(onClick = { choose(value) }) { Text("${if (selected == value) "✓ " else ""}$value") } }
    }
}
@Composable private fun Confirm(title: String, description: String, onClose: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, title = { Text(title) }, text = { Text(description) },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Confirm") } },
        dismissButton = { TextButton(onClick = onClose) { Text("Cancel") } })
}
