package com.netsentry.app.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.netsentry.app.data.Repository
import com.netsentry.app.data.array
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
internal fun ApplicationScreen(
    state: Repository.View,
    model: PersonalViewModel,
    section: String,
    modifier: Modifier,
    header: @Composable () -> Unit,
) {
    var period by remember { mutableStateOf("day") }
    var application by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var device by remember { mutableStateOf(state.ownDevice?.optString("id") ?: "") }
    var categoryName by remember { mutableStateOf("") }
    var correction by remember { mutableStateOf("unknown") }
    var seconds by remember { mutableStateOf("3600") }
    val report = state.applicationReport
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                header()
                if (section != "Application usage") {
                    Text(
                        "Choose a device and load its application report for categories or timeline evidence."
                    )
                    state.devices.forEach { phone ->
                        OutlinedButton(
                            onClick = { device = phone.getString("id") },
                            enabled = !model.busy,
                        ) {
                            Text(phone.optString("name"))
                        }
                    }
                    Choices(listOf("day", "week", "month"), period) { period = it }
                    Action("Load application report", model, device.isNotBlank()) {
                        loadApplications(period, application, category, device)
                    }
                }
                if (section == "Application usage")
                    Panel("Screen time and application usage") {
                        Text(
                            "Enable app-usage-v1 on the Phone tab first. Foreground-entry counts describe the accepted event stream, not cold starts. Unknown counts stay unknown; OS event gaps and multi-window behavior require device testing."
                        )
                        state.devices.forEach { phone ->
                            OutlinedButton(
                                onClick = { device = phone.getString("id") },
                                enabled = !model.busy,
                            ) {
                                Text(
                                    "${if (device == phone.optString("id")) "✓ " else ""}${phone.optString("name")}"
                                )
                            }
                        }
                        Choices(listOf("day", "week", "month"), period) { period = it }
                        Input("Optional application ID filter", application, { application = it })
                        Input(
                            "Optional category ID filter (name/UUID from below)",
                            category,
                            { category = it },
                        )
                        Action("Load application report", model, device.isNotBlank()) {
                            loadApplications(period, application, category, device)
                        }
                        if (report == null)
                            Text("No application report loaded. Missing data is not zero.")
                        report?.let {
                            Text(
                                "${it.optString("from")} to ${it.optString("to")} (exclusive) · ${it.optString("timezone")}"
                            )
                            Text(it.optString("qualityNote"))
                            it.array("trends").forEach { trend ->
                                Text(
                                    "${trend.optString("periodStart")}: foreground ${known(trend.opt("foregroundSeconds"))}s; screen ${known(trend.opt("screenSeconds"))}s; late-night screen ${known(trend.opt("screenLateNightSeconds"))}s; reported screen coverage ${trend.optLong("coverageMs") / 1000}s; missing ${trend.optLong("missingMs") / 1000}s"
                                )
                            }
                            val comparison = it.optJSONObject("comparison")
                            Text(
                                "Observed comparison: current ${known(comparison?.opt("currentSeconds"))}s; previous ${known(comparison?.opt("previousSeconds"))}s (${comparison?.optString("from")}–${comparison?.optString("to")}). No percentage claim without comparable completeness."
                            )
                            it.array("insights").forEach { insight ->
                                Text(
                                    "${insight.optString("code")}: ${insight.optString("applicationId")} · ${insight.optDouble("seconds")}s. ${insight.optString("evidence")}"
                                )
                            }
                            Button(
                                onClick = { model.exportApplications() },
                                enabled = !model.busy,
                            ) {
                                Text("Prepare application CSV export")
                            }
                        }
                    }
            }
        }
        if (section == "Application usage" && report != null)
            items(report.array("applications"), key = { it.getString("applicationId") }) { app ->
                val id = app.getString("applicationId")
                Panel(if (app.isNull("label")) id else app.optString("label")) {
                    Row {
                        if (report.optString("deviceId") == state.ownDevice?.optString("id"))
                            LocalApplicationIcon(id)
                        Column(Modifier.weight(1f)) {
                            Text(id)
                            Text(
                                "${app.optString("category")} · ${app.optString("source")} · confidence ${app.optDouble("confidence")}"
                            )
                        }
                    }
                    Text(
                        "Estimated foreground ${app.optDouble("seconds")}s · prior ${known(app.opt("previousSeconds"))}s"
                    )
                    Text(
                        "Observed entries ${app.optInt("observedLaunches")} · complete-context entry count ${known(app.opt("launchCount"))}"
                    )
                    Text(
                        "First observed ${known(app.opt("firstUse"))}; last observed ${known(app.opt("lastUse"))}"
                    )
                    Text(
                        "Late night (22:00–06:00 workspace time): ${app.optDouble("lateNightSeconds")}s"
                    )
                    if (report.optString("deviceId") == state.ownDevice?.optString("id")) {
                        Input("Category ID for correction", correction, { correction = it })
                        Action("Correct category for $id", model) {
                            correctApplication(id, correction)
                            loadApplications(period, application, category, device)
                        }
                        Action("Restore OS classification for $id", model) {
                            correctApplication(id, null)
                            loadApplications(period, application, category, device)
                        }
                        Input(
                            "App limit in seconds",
                            seconds,
                            { seconds = it },
                            keyboard = KeyboardType.Number,
                        )
                        Action(
                            "Create estimated app threshold for $id",
                            model,
                            seconds.toLongOrNull()?.let { it > 0 } == true,
                        ) {
                            usageLimit(
                                "application_foreground_seconds",
                                period,
                                seconds.toLong(),
                                id,
                            )
                            loadApplications(period, application, category, device)
                        }
                    }
                }
            }
        if (section != "Application usage")
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (section == "Categories & corrections")
                        Panel("Categories and custom corrections") {
                            Text(
                                "Classification uses a permitted OS category (heuristic confidence 0.6), an explicit owner correction (1.0), or unknown (0.0). These are rule scores, not statistical probabilities. Corrections apply when reports are read. No app-store lookup or package-name guessing is used."
                            )
                            report?.optJSONArray("builtinCategories")?.let {
                                Text("Built-ins: $it")
                            }
                            report?.array("categories")?.forEach {
                                Text(
                                    "${it.optString("name")} (${it.optString("id")}): ${it.optDouble("seconds")} observed foreground seconds"
                                )
                            }
                            report?.array("customCategories")?.forEach { item ->
                                Text("${item.optString("name")}: ${item.optString("id")}")
                                if (
                                    report.optString("deviceId") == state.ownDevice?.optString("id")
                                )
                                    Action(
                                        "Remove custom category ${item.optString("name")}",
                                        model,
                                    ) {
                                        removeCategory(item.getString("id"))
                                        loadApplications(period, application, category, device)
                                    }
                            }
                            if (device == state.ownDevice?.optString("id")) {
                                Input("Custom category name", categoryName, { categoryName = it })
                                Action("Create custom category", model, categoryName.isNotBlank()) {
                                    createCategory(categoryName)
                                    loadApplications(period, application, category, device)
                                }
                            }
                        }
                    if (section == "Timeline & evidence")
                        Panel("Timeline and evidence") {
                            Text(
                                "Detailed windows are available for ranges up to seven days within raw retention. Longer reports use daily summaries. A month view intentionally omits raw timeline detail."
                            )
                            report?.array("timeline")?.forEach { window ->
                                Text(
                                    "${window.optString("intervalStart")} – ${window.optString("intervalEnd")} · app context ${window.optBoolean("appKnown")} · screen context ${window.optBoolean("screenKnown")} · ${window.optJSONArray("issues")}"
                                )
                                window.array("sessions").forEach {
                                    Text(
                                        "${it.optString("applicationId")}: ${it.optString("start")} – ${it.optString("end")}"
                                    )
                                }
                                window.array("screen").forEach {
                                    Text(
                                        "Unlocked screen: ${it.optString("start")} – ${it.optString("end")}"
                                    )
                                }
                            }
                        }
                    if (section == "Application usage")
                        Panel("Limits and monitoring-health alerts") {
                            report?.array("limits")?.forEach { limit ->
                                Text(
                                    "${limit.optString("metric")} · ${limit.optString("applicationId")} · ${limit.optString("period")} · ${limit.optString("quality")}: ${known(limit.opt("observedValue"))}/${limit.optDouble("threshold")} · ${known(limit.opt("percent"))}% reported. Reporting is not enforcement."
                                )
                            }
                            if (device == state.ownDevice?.optString("id")) {
                                Input(
                                    "Screen-time threshold in seconds",
                                    seconds,
                                    { seconds = it },
                                    keyboard = KeyboardType.Number,
                                )
                                Action(
                                    "Create estimated screen-time threshold",
                                    model,
                                    seconds.toLongOrNull()?.let { it > 0 } == true,
                                ) {
                                    usageLimit("screen_time_seconds", period, seconds.toLong())
                                    loadApplications(period, application, category, device)
                                }
                                Action("Alert when usage access is revoked", model) {
                                    healthAlert("permission_revoked")
                                }
                                Action("Alert after one hour without a heartbeat", model) {
                                    healthAlert("device_offline", 3600)
                                }
                                Action(
                                    "Alert after one hour without an accepted usage report",
                                    model,
                                ) {
                                    healthAlert("not_reporting", 3600)
                                }
                                Text(
                                    "In-app health alerts require recurring server monitoring maintenance. Offline permission withdrawal is recorded locally and its health report is retried without resuming collection. Push remains unavailable."
                                )
                            }
                        }
                }
            }
    }
}

private fun known(value: Any?): String =
    if (value == null || value == org.json.JSONObject.NULL) "unknown" else value.toString()

@Composable
private fun LocalApplicationIcon(applicationId: String) {
    val context = LocalContext.current
    val bitmap by
        produceState<ImageBitmap?>(null, applicationId) {
            value =
                withContext(Dispatchers.IO) {
                    try {
                        val drawable = context.packageManager.getApplicationIcon(applicationId)
                        val output = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
                        drawable.setBounds(0, 0, 64, 64)
                        drawable.draw(Canvas(output))
                        output.asImageBitmap()
                    } catch (_: Exception) {
                        null
                    }
                }
        }
    bitmap?.let {
        Image(it, contentDescription = "Visible application icon", modifier = Modifier.size(40.dp))
    }
    // Missing/filtered metadata keeps the package text and no fabricated icon.
}
