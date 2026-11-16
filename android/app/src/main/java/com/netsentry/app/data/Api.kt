package com.netsentry.app.data

import com.netsentry.app.core.Policy
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okio.BufferedSink

class ApiFailure(val status: Int, val code: String, message: String, val retryAfterMs: Long? = null) : IOException(message)

/** Raised only before a command POST; the UI must obtain a new confirmation. */
class ObservationChanged : IllegalArgumentException("Service observation changed. Refresh the computer and confirm its current service again.")

/** IO only. Verified TLS, no redirect/log/cookie/cache, connection recovery off, one-shot mutations. */
class Api(base: String) : Transport {
    private val base = Policy.apiBase(base)
    override fun request(method: String, path: String, token: String?, body: JSONObject?): Any {
        require(path.startsWith("/") && !path.startsWith("//") && !path.contains('#'))
        val bytes = body?.toString()?.toByteArray(Charsets.UTF_8)
        require(bytes == null || bytes.size <= 1_000_000)
        val content = bytes ?: if (method !in setOf("GET","HEAD")) "{}".toByteArray() else null
        val payload = content?.let { raw -> object : RequestBody() {
            override fun contentType() = JSON
            override fun contentLength() = raw.size.toLong()
            override fun isOneShot() = true
            override fun writeTo(sink: BufferedSink) { sink.write(raw) }
        } }
        val request = Request.Builder().url(base + path).method(method, payload)
            .header("Accept", "application/json").header("User-Agent", "NetSentry-Android/0.9.0")
        token?.let { request.header("Authorization", "Bearer $it") }
        client.newCall(request.build()).execute().use { response ->
            val content = response.body?.byteStream()?.use { stream ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    require(output.size()+count <= 1_000_000) { "API response exceeds the supported size." }
                    output.write(buffer,0,count)
                }
                output.toByteArray()
            } ?: byteArrayOf()
            val result = if (content.isEmpty()) JSONObject() else JSONTokener(String(content,Charsets.UTF_8)).nextValue()
            if (!response.isSuccessful) {
                val error = result as? JSONObject
                throw ApiFailure(response.code,error?.optString("code") ?: "HTTP_ERROR",
                    error?.optString("message")?.take(400) ?: "Request failed (${response.code}).",
                    response.header("Retry-After")?.toLongOrNull()?.coerceIn(1,300)?.times(1000))
            }
            require(result is JSONObject || result is JSONArray) { "Invalid API response." }
            return result
        }
    }
    private companion object {
        val JSON = "application/json; charset=utf-8".toMediaType()
        val client: OkHttpClient by lazy { OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
            .retryOnConnectionFailure(false).connectTimeout(10,TimeUnit.SECONDS).readTimeout(15,TimeUnit.SECONDS)
            .writeTimeout(15,TimeUnit.SECONDS).callTimeout(30,TimeUnit.SECONDS).build() }
    }
}
fun json(vararg entries: Pair<String, Any?>): JSONObject = JSONObject().apply { entries.forEach { (key,value) -> put(key,value ?: JSONObject.NULL) } }
fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
fun JSONObject.array(key: String): List<JSONObject> = optJSONArray(key)?.objects() ?: emptyList()
