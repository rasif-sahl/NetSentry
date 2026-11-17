package com.netsentry.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.netsentry.app.data.Repository
import com.netsentry.app.data.objects
import java.util.UUID

@Composable fun FamilyScreen(state: Repository.View, model: PersonalViewModel, section: String) {
    Panel("Family and digital wellbeing") { FamilyContent(state, model, section) }
}

@Composable private fun FamilyContent(state: Repository.View, model: PersonalViewModel, section: String) {
    Text("Use a Family workspace. Owners/admins create profiles and invite guardians from the web dashboard. Guardian membership alone does not grant access to a child.")
    Button(onClick = { model.run("Family observations refreshed") { refreshFamily() } }, enabled = !model.busy) { Text("Refresh family") }
    state.familyOverview?.getJSONArray("profiles")?.objects()?.forEach { p ->
        OutlinedButton(onClick = { model.run("Child selected") { refreshFamily(p.getString("id")) } }, enabled = !model.busy) { Text("${familyAvatar(p.optString("avatar"))} · ${p.getString("name")}") }
    }
    Text("Saved policies do not prove restrictions. Current consumer Android and router adapters report unsupported; no app, network or domain block is claimed applied.")
    if (section == "Wellbeing reports & policy status") {
        Text(state.familySync)
        Button(onClick = { model.run("Phone policy status checked") { checkFamilyPolicy() } }, enabled = !model.busy && state.ownDevice != null) { Text("Check phone policy status") }
    }
    if (section == "Sharing & consent") state.devices.filter { it.optString("registeredById") == state.profile?.optString("id") }.forEach { d ->
        OutlinedButton(onClick = { model.run("Your device family sharing was withdrawn") { withdrawOwnFamily(d.getString("id")) } }, enabled = !model.busy) { Text("Withdraw family sharing on ${d.getString("name")}") }
    }
    val detail = state.familyDetail
    if (detail == null) {
        Text("Select an authorized child profile above to view this section.")
        return
    }
    val profile = detail.getJSONObject("profile")
    Text("${familyAvatar(profile.getString("avatar"))} ${profile.getString("name")} · ${profile.getString("ageBand")}")
    if (section == "Wellbeing reports & policy status") {
        Text(detail.getJSONObject("disclosure").getString("text"))
        Text("Policy intent: ${detail.getJSONObject("desired").getString("state").replace('_', ' ')}")
        Text("Warnings: ${detail.getJSONObject("desired").getJSONArray("warnings")}")
        val report = detail.getJSONObject("report")
        Text("Weekly observed minutes: ${report.getDouble("currentWeekMinutes").toInt()} · confidence ${report.getString("confidence")}")
        Text(report.getString("evidence"))
        Text("Education ${report.getDouble("educationMinutes").toInt()} minutes · entertainment ${report.getDouble("entertainmentMinutes").toInt()} minutes")
    }
    if (section == "Sharing & consent") {
        var accepted by remember(profile.getString("id"), profile.getInt("revision")) { mutableStateOf(false) }
        Check("I accept family-sharing-v1 for this phone and this child profile. Collection permissions remain separate.",
            accepted, { accepted = it }, enabled = !model.busy)
        Button(onClick = { model.run("Family sharing consent recorded") { consentFamily() } }, enabled = !model.busy && accepted && state.ownDevice != null) { Text("Share this phone with this child profile") }
        detail.getJSONArray("devices").objects().forEach { d ->
            Text("${d.getString("name")}: ${d.getString("enforcement")} (device report)")
            OutlinedButton(onClick = { model.run("Family sharing withdrawn") { withdrawFamily(d.getString("deviceId")) } }, enabled = !model.busy) { Text("Withdraw family sharing") }
        }
    }
    if (section == "Time requests & decisions") {
        val manage = detail.getBoolean("canManage")
        if (!profile.getBoolean("archived") && !detail.isNull("policy") && (manage || detail.getBoolean("canRequest"))) {
            var reason by remember(profile.getString("id")) { mutableStateOf("") }
            var minutes by remember(profile.getString("id")) { mutableStateOf("15") }
            var requestId by remember(profile.getString("id"), detail.getJSONObject("policy").getInt("revision")) { mutableStateOf(UUID.randomUUID().toString()) }
            Input("Minutes (1–120)", minutes, { minutes = it; requestId = UUID.randomUUID().toString() }, keyboard = androidx.compose.ui.text.input.KeyboardType.Number)
            Input("Reason", reason, { reason = it.take(200); requestId = UUID.randomUUID().toString() })
            Button(onClick = { val id = requestId; val requestedMinutes=minutes.toInt(); val requestedReason=reason; model.run("Time request recorded") { familyTime(id, requestedMinutes, requestedReason, manage) } }, enabled = !model.busy && (minutes.toIntOrNull() ?: 0) in 1..120 && reason.isNotBlank()) { Text(if (manage) "Grant temporary exception" else "Request more time") }
        }
        detail.getJSONArray("requests").objects().forEach { r ->
            Column {
                Text("${r.getString("reason")} · ${r.getInt("minutes")} minutes · ${r.getString("state").replace('_', ' ')}")
                if (r.getString("state") == "pending") {
                    (if (manage) listOf("approved", "rejected") else if (detail.getBoolean("canRequest")) listOf("cancelled") else emptyList()).forEach { decision ->
                        OutlinedButton(onClick = { model.run("Decision recorded") { decideFamily(r.getString("id"), decision) } }, enabled = !model.busy) { Text(decision) }
                    }
                }
            }
        }
    }
    Text("Restrictions and notifications depend on separately authorized platform support.")
}

private fun familyAvatar(name: String): String = when (name) {
    "leaf" -> "🌿"; "fox" -> "🦊"; "owl" -> "🦉"; "rocket" -> "🚀"; "sun" -> "☀️"; else -> "⭐"
}
