package com.netsentry.app.data

import com.netsentry.app.core.Policy
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class ApiFailure(val status: Int, val code: String, message: String, val retryAfterMs: Long? = null) : IOException(message)

/** Blocking adapter: call on IO only. No redirects, permissive TLS, payload logging or auto POST retry. */
class Api(base: String) : Transport {
    private val base = Policy.apiBase(base)
    override fun request(method: String, path: String, token: String?, body: JSONObject?): Any {
        require(path.startsWith("/") && !path.startsWith("//") && !path.contains('#'))
        val connection = URL(base + path).openConnection() as HttpsURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "NetSentry-Android/0.8.0")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            body?.let {
                val bytes = it.toString().toByteArray(Charsets.UTF_8)
                require(bytes.size <= 1_000_000)
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { stream -> stream.write(bytes) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val bytes = stream?.use {
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = it.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 1_000_000) { "API response exceeds the supported size." }
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            } ?: byteArrayOf()
            require(bytes.size <= 1_000_000) { "API response exceeds the supported size." }
            val result = if (bytes.isEmpty()) JSONObject() else JSONTokener(String(bytes, Charsets.UTF_8)).nextValue()
            if (status !in 200..299) {
                val error = result as? JSONObject
                throw ApiFailure(status, error?.optString("code") ?: "HTTP_ERROR",
                    error?.optString("message")?.take(400) ?: "Request failed ($status).",
                    connection.getHeaderField("Retry-After")?.toLongOrNull()?.coerceIn(1, 300)?.times(1000))
            }
            require(result is JSONObject || result is JSONArray) { "Invalid API response." }
            return result
        } finally { connection.disconnect() }
    }
}

fun json(vararg entries: Pair<String, Any?>): JSONObject = JSONObject().apply {
    entries.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) }
}
fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
fun JSONObject.array(key: String): List<JSONObject> = optJSONArray(key)?.objects() ?: emptyList()
