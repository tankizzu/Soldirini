package it.cameracontrol.app.ui

import android.annotation.SuppressLint
import android.app.Application
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import it.cameracontrol.app.voice.Voice
import it.cameracontrol.app.voice.VoiceDirector
import it.cameracontrol.app.voice.VoiceEngine
import it.cameracontrol.app.voice.VoicePrint
import it.cameracontrol.app.voice.VoiceStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.coroutines.coroutineContext

/** Registrazione della voce di una persona in corso. */
data class EnrollState(val voiceId: String, val name: String, val elapsedSec: Float, val speechSec: Float)

data class VoiceUi(
    val voices: List<Voice> = emptyList(),
    val listening: Boolean = false,
    val speech: Boolean = false,
    /** Somiglianza della voce ascoltata con ogni persona (id → 0…1). */
    val scores: Map<String, Float> = emptyMap(),
    /** Persona su cui andrebbe l'inquadratura secondo le regole (in questa prova il gimbal non si muove). */
    val decision: String? = null,
    val enrolling: EnrollState? = null,
    val threshold: Float = VoiceDirector.DEFAULT_THRESHOLD,
    val loading: Boolean = false,
    val message: String? = null,
)

/**
 * Regia da voce – PROVA: registra le voci e mostra in tempo reale chi sta parlando, senza muovere il gimbal.
 * L'audio del microfono resta in memoria per pochi secondi e viene scartato: non si salva e non esce dal telefono.
 */
class VoiceRegiaViewModel(private val app: Application) : AndroidViewModel(app) {
    companion object {
        const val MAX_VOICES = 8
        const val ENROLL_SECONDS = 20
        private const val MIN_ENROLL_SPEECH_SEC = 8f
        private const val SR = VoiceEngine.SAMPLE_RATE
        private const val WINDOW = SR * 3 / 2            // si confronta l'ultimo 1,5 s di voce
        private const val MIN_WINDOW = SR                // ma serve almeno 1 s
        private const val STEP_CHUNKS = 16               // una decisione ogni ~0,5 s
        private const val SILENCE_RESET_CHUNKS = 31      // ~1 s di silenzio: si riparte con una finestra pulita
        private const val ENROLL_PIECE = SR * 2          // pezzi da 2 s per l'impronta di registrazione
    }

    private val store = VoiceStore(app)
    private val director = VoiceDirector()
    // Un solo thread per tutte le chiamate native (microfono, VAD, estrattore)
    private val worker = Executors.newSingleThreadExecutor().asCoroutineDispatcher()
    private var engine: VoiceEngine? = null
    private var job: Job? = null

    private val _ui = MutableStateFlow(VoiceUi(voices = store.load()))
    val ui: StateFlow<VoiceUi> = _ui.asStateFlow()

    fun dismissMessage() = _ui.update { it.copy(message = null) }

    private fun say(text: String) = _ui.update { it.copy(message = text) }

    // ---------- Persone ----------

    fun addVoice(name: String) {
        val clean = name.trim().take(24)
        if (clean.isEmpty()) return
        if (_ui.value.voices.size >= MAX_VOICES) return say("Al massimo $MAX_VOICES persone")
        updateVoices(_ui.value.voices + Voice(UUID.randomUUID().toString(), clean, null))
    }

    fun deleteVoice(id: String) {
        updateVoices(_ui.value.voices.filterNot { it.id == id })
        director.reset()
    }

    private fun updateVoices(list: List<Voice>) {
        _ui.update { it.copy(voices = list) }
        viewModelScope.launch(worker) { runCatching { store.save(list) }.onFailure { say("Salvataggio non riuscito") } }
    }

    fun setThreshold(t: Float) {
        director.threshold = t
        _ui.update { it.copy(threshold = t) }
    }

    // ---------- Motore e microfono ----------

    private fun engineOrNull(): VoiceEngine? {
        engine?.let { return it }
        _ui.update { it.copy(loading = true) }
        return try {
            VoiceEngine(app.assets).also { engine = it }
        } catch (e: Throwable) {
            say("Motore della voce non disponibile: ${e.message ?: e.javaClass.simpleName}")
            null
        } finally {
            _ui.update { it.copy(loading = false) }
        }
    }

    /** Legge il microfono a pezzi da 32 ms finché [onChunk] restituisce true. */
    @SuppressLint("MissingPermission") // il permesso RECORD_AUDIO viene chiesto dalla schermata prima di iniziare
    private suspend fun micLoop(onChunk: (FloatArray) -> Boolean) {
        val minBuf = AudioRecord.getMinBufferSize(SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val rec = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION, // senza effetti aggressivi: voce più naturale per il riconoscimento
            SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBuf, VoiceEngine.CHUNK * 2 * 8),
        )
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            rec.release()
            say("Microfono non disponibile")
            return
        }
        val pcm = ShortArray(VoiceEngine.CHUNK)
        try {
            rec.startRecording()
            while (coroutineContext.isActive) {
                var read = 0
                while (read < pcm.size) {
                    val n = rec.read(pcm, read, pcm.size - read)
                    if (n <= 0) return
                    read += n
                }
                val chunk = FloatArray(pcm.size) { pcm[it] / 32768f }
                if (!onChunk(chunk)) return
            }
        } finally {
            runCatching { rec.stop() }
            rec.release()
        }
    }

    // ---------- Ascolto (riconoscimento in tempo reale) ----------

    fun toggleListening() = if (_ui.value.listening) stopAll() else startListening()

    private fun startListening() {
        stopAll()
        director.reset()
        _ui.update { it.copy(listening = true, decision = null, scores = emptyMap(), speech = false) }
        job = viewModelScope.launch(worker) {
            val eng = engineOrNull() ?: run { _ui.update { it.copy(listening = false) }; return@launch }
            eng.resetVad()
            val window = FloatArray(WINDOW)
            var filled = 0
            var chunks = 0
            var silentChunks = 0
            micLoop { chunk ->
                val speech = eng.isSpeech(chunk)
                if (speech) {
                    silentChunks = 0
                    // finestra scorrevole con solo i pezzi di voce
                    System.arraycopy(window, chunk.size, window, 0, WINDOW - chunk.size)
                    System.arraycopy(chunk, 0, window, WINDOW - chunk.size, chunk.size)
                    filled = minOf(WINDOW, filled + chunk.size)
                } else if (++silentChunks >= SILENCE_RESET_CHUNKS) {
                    filled = 0
                }
                if (++chunks % STEP_CHUNKS == 0) {
                    val voices = _ui.value.voices
                    val scores = if (speech && filled >= MIN_WINDOW && voices.any { it.enrolled }) {
                        eng.embed(window.copyOfRange(WINDOW - filled, WINDOW))?.let { VoicePrint.scores(it, voices) } ?: emptyMap()
                    } else {
                        emptyMap()
                    }
                    val decision = director.update(speech && scores.isNotEmpty(), scores)
                    _ui.update { it.copy(speech = speech, scores = scores, decision = decision) }
                } else if (_ui.value.speech != speech && !speech) {
                    _ui.update { it.copy(speech = false) }
                }
                true
            }
            _ui.update { it.copy(listening = false, speech = false) }
        }
    }

    // ---------- Registrazione della voce di una persona ----------

    fun startEnroll(voiceId: String) {
        val voice = _ui.value.voices.firstOrNull { it.id == voiceId } ?: return
        stopAll()
        _ui.update { it.copy(enrolling = EnrollState(voice.id, voice.name, 0f, 0f)) }
        job = viewModelScope.launch(worker) {
            val eng = engineOrNull() ?: run { _ui.update { it.copy(enrolling = null) }; return@launch }
            eng.resetVad()
            val speechParts = ArrayList<FloatArray>()
            var total = 0
            var speechSamples = 0
            val limit = ENROLL_SECONDS * SR
            micLoop { chunk ->
                total += chunk.size
                if (eng.isSpeech(chunk)) {
                    speechParts += chunk
                    speechSamples += chunk.size
                }
                if (total % (SR / 4) < chunk.size) {
                    _ui.update { u ->
                        u.copy(enrolling = u.enrolling?.copy(elapsedSec = total / SR.toFloat(), speechSec = speechSamples / SR.toFloat()))
                    }
                }
                total < limit
            }
            if (!coroutineContext.isActive) return@launch
            val speechSec = speechSamples / SR.toFloat()
            if (speechSec < MIN_ENROLL_SPEECH_SEC) {
                _ui.update { it.copy(enrolling = null) }
                say("Poca voce registrata (%.0f s): riprova facendo parlare di più ${voice.name}".format(speechSec))
                return@launch
            }
            // Voce continua, a pezzi da 2 s: un'impronta per pezzo, poi la media
            val all = FloatArray(speechSamples)
            var pos = 0
            speechParts.forEach { System.arraycopy(it, 0, all, pos, it.size); pos += it.size }
            val embeddings = (0 until all.size / ENROLL_PIECE).mapNotNull { i ->
                eng.embed(all.copyOfRange(i * ENROLL_PIECE, (i + 1) * ENROLL_PIECE))
            }
            if (embeddings.isEmpty()) {
                _ui.update { it.copy(enrolling = null) }
                say("Registrazione non riuscita: riprova")
                return@launch
            }
            val print = VoicePrint.average(embeddings)
            val list = _ui.value.voices.map { if (it.id == voice.id) it.copy(embedding = print) else it }
            _ui.update { it.copy(enrolling = null) }
            updateVoices(list)
            say("Voce di ${voice.name} registrata (%.0f s di voce)".format(speechSec))
        }
    }

    /** Ferma ascolto o registrazione in corso. */
    fun stopAll() {
        job?.cancel()
        job = null
        _ui.update { it.copy(listening = false, speech = false, enrolling = null) }
    }

    override fun onCleared() {
        job?.cancel()
        val e = engine
        engine = null
        // rilascio sul thread del motore, dopo che il microfono si è fermato
        worker.executor.execute {
            e?.release()
            worker.close()
        }
        super.onCleared()
    }
}
