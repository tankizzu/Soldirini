package it.cameracontrol.app.voice

import kotlin.math.sqrt

/** Una persona registrata: nome e "impronta" della voce (numeri, non audio). */
data class Voice(val id: String, val name: String, val embedding: FloatArray?) {
    val enrolled: Boolean get() = embedding != null

    override fun equals(other: Any?): Boolean =
        other is Voice && other.id == id && other.name == name &&
            (other.embedding?.contentEquals(embedding) ?: (embedding == null))

    override fun hashCode(): Int = id.hashCode() * 31 + name.hashCode()
}

/** Calcoli sulle impronte vocali (puri, senza Android: testati sul computer). */
object VoicePrint {
    fun normalize(v: FloatArray): FloatArray {
        var n = 0.0
        for (x in v) n += x * x
        val norm = sqrt(n).toFloat()
        return if (norm == 0f) v.copyOf() else FloatArray(v.size) { v[it] / norm }
    }

    /** Somiglianza fra due impronte: 1 = identiche, 0 = nessuna relazione. */
    fun cosine(a: FloatArray, b: FloatArray): Float {
        require(a.size == b.size) { "Impronte di dimensioni diverse" }
        var dot = 0.0
        var na = 0.0
        var nb = 0.0
        for (i in a.indices) {
            dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
        }
        if (na == 0.0 || nb == 0.0) return 0f
        return (dot / (sqrt(na) * sqrt(nb))).toFloat()
    }

    /** Impronta di una persona: media delle impronte dei pezzi di registrazione (ognuno normalizzato). */
    fun average(parts: List<FloatArray>): FloatArray {
        require(parts.isNotEmpty()) { "Nessun pezzo di voce" }
        val out = FloatArray(parts[0].size)
        for (p in parts) {
            val n = normalize(p)
            for (i in out.indices) out[i] += n[i]
        }
        return normalize(out)
    }

    /** Somiglianza della finestra ascoltata con ogni persona registrata. */
    fun scores(window: FloatArray, voices: List<Voice>): Map<String, Float> =
        voices.mapNotNull { v -> v.embedding?.let { v.id to cosine(window, it) } }.toMap()
}

/**
 * Decide su chi tenere l'inquadratura (regole dell'utente, 2026-11-06):
 * - silenzio → resta sull'ultima persona che ha parlato;
 * - voci sovrapposte o incerte → resta su chi parlava prima;
 * - cambia persona solo dopo [confirmWindows] finestre consecutive sicure su di lei (evita il ping-pong).
 * Una finestra è "sicura" se la persona migliore supera [threshold] e stacca la seconda di almeno [margin].
 */
class VoiceDirector(
    var threshold: Float = DEFAULT_THRESHOLD,
    var margin: Float = DEFAULT_MARGIN,
    var confirmWindows: Int = DEFAULT_CONFIRM_WINDOWS,
) {
    companion object {
        const val DEFAULT_THRESHOLD = 0.40f
        const val DEFAULT_MARGIN = 0.08f
        const val DEFAULT_CONFIRM_WINDOWS = 2
    }

    /** Persona su cui è l'inquadratura (null = nessuna ancora). */
    var current: String? = null
        private set

    private var candidate: String? = null
    private var candidateCount = 0

    /** Esito di una finestra: chi sembra parlare con sicurezza (null = silenzio o incerto). */
    fun confident(scores: Map<String, Float>): String? {
        if (scores.isEmpty()) return null
        val sorted = scores.entries.sortedByDescending { it.value }
        val best = sorted[0]
        val second = sorted.getOrNull(1)?.value ?: -1f
        return if (best.value >= threshold && best.value - second >= margin) best.key else null
    }

    /** speech = c'è voce in questa finestra; restituisce la persona inquadrata dopo la decisione. */
    fun update(speech: Boolean, scores: Map<String, Float>): String? {
        val who = if (speech) confident(scores) else null
        if (who == null) {
            // silenzio o sovrapposizione: si resta dove si è, e si azzera il candidato
            candidate = null
            candidateCount = 0
            return current
        }
        if (who == current) {
            candidate = null
            candidateCount = 0
            return current
        }
        if (who == candidate) candidateCount++ else { candidate = who; candidateCount = 1 }
        if (candidateCount >= confirmWindows) {
            current = who
            candidate = null
            candidateCount = 0
        }
        return current
    }

    fun reset() {
        current = null
        candidate = null
        candidateCount = 0
    }
}
