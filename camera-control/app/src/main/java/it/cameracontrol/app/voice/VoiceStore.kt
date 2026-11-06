package it.cameracontrol.app.voice

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Persone registrate della Regia da voce, nella cartella privata dell'app (voices.json).
 * Contiene solo nomi e impronte (numeri): nessuna registrazione audio viene salvata.
 */
class VoiceStore(context: Context) {
    private val file = AtomicFile(File(context.applicationContext.filesDir, "voices.json"))

    fun load(): List<Voice> {
        if (!file.baseFile.exists()) return emptyList()
        return runCatching {
            val arr = JSONArray(file.readFully().toString(Charsets.UTF_8))
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val e = o.optJSONArray("embedding")
                Voice(
                    id = o.optString("id").ifEmpty { return@mapNotNull null },
                    name = o.optString("name"),
                    embedding = e?.let { a -> FloatArray(a.length()) { a.optDouble(it, 0.0).toFloat() } },
                )
            }
        }.getOrElse { emptyList() }
    }

    fun save(voices: List<Voice>) {
        val arr = JSONArray()
        voices.forEach { v ->
            val o = JSONObject().put("id", v.id).put("name", v.name)
            v.embedding?.let { e -> o.put("embedding", JSONArray().apply { e.forEach { put(it.toDouble()) } }) }
            arr.put(o)
        }
        val out = file.startWrite()
        try {
            out.write(arr.toString().toByteArray(Charsets.UTF_8))
            file.finishWrite(out)
        } catch (e: Exception) {
            file.failWrite(out)
            throw e
        }
    }
}
