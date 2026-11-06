package it.cameracontrol.app.voice

import android.content.res.AssetManager
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractor
import com.k2fsa.sherpa.onnx.SpeakerEmbeddingExtractorConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig

/**
 * Motore della Regia da voce, tutto sul telefono (sherpa-onnx, nessuna connessione):
 * - VAD (silero): dice se in questo momento qualcuno sta parlando;
 * - estrattore (CAM++, VoxCeleb): trasforma 1–2 s di voce in un'impronta da confrontare.
 * Da usare sempre dallo stesso thread (le parti native non sono pensate per thread diversi).
 */
class VoiceEngine(assets: AssetManager) {
    companion object {
        const val SAMPLE_RATE = 16_000
        /** Campioni per pezzo letto dal microfono (= finestra del VAD silero, 32 ms). */
        const val CHUNK = 512
        private const val VAD_MODEL = "silero_vad.onnx"
        private const val SPEAKER_MODEL = "speaker_campplus.onnx"
    }

    private val vad = Vad(
        assetManager = assets,
        config = VadModelConfig(
            sileroVadModelConfig = SileroVadModelConfig(
                model = VAD_MODEL,
                threshold = 0.5f,
                minSilenceDuration = 0.25f,
                minSpeechDuration = 0.25f,
                windowSize = CHUNK,
                maxSpeechDuration = 5f,
            ),
            sampleRate = SAMPLE_RATE,
            numThreads = 1,
        ),
    )

    private val extractor = SpeakerEmbeddingExtractor(
        assetManager = assets,
        config = SpeakerEmbeddingExtractorConfig(model = SPEAKER_MODEL, numThreads = 2),
    )

    /** true se nel pezzo appena ascoltato c'è voce. */
    fun isSpeech(chunk: FloatArray): Boolean {
        vad.acceptWaveform(chunk)
        val speech = vad.isSpeechDetected()
        while (!vad.empty()) vad.pop() // i segmenti completi non servono: si svuota per non accumulare memoria
        return speech
    }

    /** Impronta di un pezzo di voce (servono almeno ~0,5 s), null se troppo corto. */
    fun embed(samples: FloatArray): FloatArray? {
        val stream = extractor.createStream()
        return try {
            stream.acceptWaveform(samples, SAMPLE_RATE)
            stream.inputFinished()
            if (extractor.isReady(stream)) extractor.compute(stream) else null
        } finally {
            stream.release()
        }
    }

    fun resetVad() = vad.reset()

    fun release() {
        vad.release()
        extractor.release()
    }
}
