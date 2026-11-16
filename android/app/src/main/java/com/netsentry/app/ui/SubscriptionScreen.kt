package com.netsentry.app.ui
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import com.netsentry.app.data.Repository
@Composable fun SubscriptionScreen(state: Repository.View, model: PersonalViewModel) {
 Text("Subscription status")
 Text("Subscription details are read-only. Purchases are currently unavailable. Your existing device permissions and monitoring settings apply.")
 Button(onClick={model.run("Subscription status refreshed") { refreshSubscription() }}, enabled=!model.busy) { Text("Refresh subscription") }
 val value=state.subscription ?: return
 Text("Edition ${value.getString("edition")} · status ${value.getString("status")} · ${value.getString("mode")}")
 Text(if(value.getBoolean("enforced")) "Edition limits are enforced alongside authorization." else "Pre-release evaluation: commercial limits are not enforced.")
 val limits=value.getJSONObject("limits")
 Text("Device allocation ${limits.getInt("devices")} · members ${limits.getInt("members")} · networks ${limits.getInt("networks")}")
 Text("Agent allocation ${limits.getInt("agents")} · raw history limit ${limits.getInt("rawDays")} days · summary limit ${limits.getInt("aggregateDays")} days")
}
