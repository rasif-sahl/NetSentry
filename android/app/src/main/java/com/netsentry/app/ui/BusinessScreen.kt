package com.netsentry.app.ui

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

@Composable
fun BusinessScreen(state: Repository.View, model: PersonalViewModel) {
    Panel("Business organization") { BusinessContent(state, model) }
}

@Composable
private fun BusinessContent(state: Repository.View, model: PersonalViewModel) {
    Text(
        "Use a Business workspace. Manage locations, departments, employees and reporting policies in the web dashboard. Organization sharing does not enable monitoring or grant OS permissions."
    )
    Button(
        onClick = { model.run("Business assignments refreshed") { refreshBusiness() } },
        enabled = !model.busy,
    ) {
        Text("Refresh organization")
    }
    val detail = state.businessOverview
    if (detail == null) {
        Text(
            "No organization details loaded. Select a Business workspace and refresh organization."
        )
        return
    }
    Text(detail.getJSONObject("organization").getString("name"))
    Text(detail.getString("qualityNote"))
    Text(detail.getJSONObject("disclosure").getString("text"))
    val ownProfiles =
        detail
            .getJSONArray("employees")
            .objects()
            .filter { it.optString("userId") == state.profile?.optString("id") }
            .map { it.getString("id") }
            .toSet()
    detail.getJSONArray("devices").objects().forEach { device ->
        val assignment =
            detail.getJSONArray("assignments").objects().firstOrNull {
                it.getString("deviceId") == device.getString("id")
            } ?: return@forEach
        if (assignment.getString("employeeId") !in ownProfiles) return@forEach
        Text(
            "${device.getString("name")} · ${device.getString("platform")} · custody ${device.getString("ownership")}"
        )
        val compliance = device.getJSONObject("compliance")
        Text(
            "Reporting checks: ${compliance.getString("state").replace('_', ' ')} · ${compliance.getJSONArray("checks")}. This is not security certification."
        )
        Text(
            if (assignment.isNull("consentedAt")) "Sharing awaiting acceptance"
            else
                "Sharing from ${assignment.optString("reportFrom")} · generation ${assignment.getInt("generation")}"
        )
        var accepted by
            remember(
                device.getString("id"),
                assignment.getInt("revision"),
                device.getInt("generation"),
            ) {
                mutableStateOf(false)
            }
        Check(
            "I accept business-sharing-v1 for this displayed device generation and assignment.",
            accepted,
            { accepted = it },
            enabled = !model.busy,
        )
        Button(
            onClick = {
                model.run("Organization sharing accepted; collection stays separately controlled") {
                    acceptBusinessSharing(
                        device.getString("id"),
                        assignment.getInt("revision"),
                        device.getInt("generation"),
                        accepted,
                    )
                }
            },
            enabled = !model.busy && accepted && device.getString("state") == "ACTIVE",
        ) {
            Text("Accept organization sharing")
        }
        OutlinedButton(
            onClick = {
                model.run("Organization sharing withdrawn; personal data retained") {
                    withdrawBusinessSharing(device.getString("id"))
                }
            },
            enabled = !model.busy,
        ) {
            Text("Withdraw organization sharing")
        }
    }
}
