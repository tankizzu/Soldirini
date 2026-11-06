# Componenti di terze parti

| Componente | Uso in Gimbali | Licenza | Fonte |
|---|---|---|---|
| sherpa-onnx v2.0.1 (librerie Android arm64 + file Kotlin `com/k2fsa/sherpa/onnx/*.kt`, non modificati) | Regia da voce: riconoscimento di chi parla, tutto sul telefono | Apache 2.0 (copia in `app/src/main/assets/licenses/sherpa-onnx-LICENSE.txt`) | https://github.com/k2-fsa/sherpa-onnx |
| onnxruntime (incluso nel pacchetto sherpa-onnx) | esecuzione dei modelli | MIT | https://github.com/microsoft/onnxruntime |
| Modello `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` (CAM++, 3D-Speaker) | impronta della voce | Apache 2.0 (progetto 3D-Speaker) | release "speaker-recongition-models" di sherpa-onnx |
| Modello `silero_vad.onnx` (Silero VAD) | capire quando qualcuno parla | MIT | release "asr-models" di sherpa-onnx |

Librerie e modelli non sono nel codice: li scarica la compilazione (`prepareVoice` in `app/build.gradle.kts`) con controllo SHA-256.
