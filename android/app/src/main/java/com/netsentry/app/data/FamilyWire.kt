package com.netsentry.app.data

import com.netsentry.app.core.Policy
import org.json.JSONObject

/** Capability information is never an enforcement grant. Consumer Android has no verified restriction adapter. */
object FamilyWire {
    fun receipt(configuration: JSONObject, generation: Int): JSONObject? {
        require(configuration.getInt("schemaVersion") == 1)
        val assignment = configuration.optJSONObject("assignment") ?: return null
        Policy.uuid(assignment.getString("profileId"))
        require(assignment.getInt("generation") == generation)
        val profileRevision = assignment.getInt("profileRevision")
        val revision = assignment.getInt("policyRevision")
        require(profileRevision > 0 && revision >= 0)
        require(assignment.getString("enforcement") == "unsupported") { "No verified Android enforcement adapter is installed." }
        val rules = assignment.optJSONObject("rules") ?: return null
        if (revision == 0) return null
        // Never turn a remote capability or a desired restriction into an applied receipt.
        return json("generation" to generation, "profileRevision" to profileRevision, "policyRevision" to revision,
            "status" to if (rules.getBoolean("enabled")) "unsupported" else "not_requested")
    }
}
