// File di sherpa-onnx v2.0.1 (https://github.com/k2-fsa/sherpa-onnx), licenza Apache 2.0, NON modificato.
// Va tenuto identico alla versione delle librerie native scaricate in app/build.gradle.kts (prepareVoice).
package com.k2fsa.sherpa.onnx

data class SpeakerEmbeddingExtractorConfig(
    val model: String = "",
    var numThreads: Int = 1,
    var debug: Boolean = false,
    var provider: String = "cpu",
)
