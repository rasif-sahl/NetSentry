import com.netsentry.app.data.FamilyWire
import com.netsentry.app.data.json
fun main() {
 val id="11111111-1111-4111-8111-111111111111"
 val assignment=json("profileId" to id,"profileRevision" to 2,"policyRevision" to 3,"generation" to 4,"enforcement" to "unsupported","rules" to json("enabled" to true))
 val config=json("schemaVersion" to 1,"assignment" to assignment)
 check(FamilyWire.receipt(config,4)!!.getString("status")=="unsupported")
 assignment.put("enforcement","applied");check(runCatching{FamilyWire.receipt(config,4)}.isFailure)
 assignment.put("enforcement","unsupported");check(runCatching{FamilyWire.receipt(config,5)}.isFailure)
 assignment.getJSONObject("rules").put("enabled",false);check(FamilyWire.receipt(config,4)!!.getString("status")=="not_requested")
 check(FamilyWire.receipt(json("schemaVersion" to 1,"assignment" to null),4)==null)
 println("Kotlin family synchronization rejects stale generations and never converts a policy into applied enforcement.")
}
