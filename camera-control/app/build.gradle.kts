import java.net.URI
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// ---------- Regia da voce: motore sherpa-onnx (Apache 2.0) e modelli, scaricati durante la compilazione ----------
// Troppo grandi per il caricamento web di GitHub (limite 25 MB per file): li scarica Gradle da GitHub Releases
// e ne controlla l'impronta SHA-256, così un file diverso da quello verificato blocca la compilazione.
// Finiscono dentro l'APK: sul telefono non si scarica nulla e tutto funziona senza Internet.
val sherpaVersion = "v2.0.1"
val voiceDir = layout.buildDirectory.dir("voice")
val voiceFiles = listOf(
    Triple(
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/$sherpaVersion/sherpa-onnx-$sherpaVersion-android.tar.bz2",
        "sherpa-onnx-android.tar.bz2",
        "39003753ec293425ed56723ea9b972b98841a490af3311670c3060548d654330",
    ),
    Triple(
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx",
        "speaker_campplus.onnx",
        "357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b",
    ),
    Triple(
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx",
        "silero_vad.onnx",
        "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6",
    ),
)

fun sha256(f: File): String = MessageDigest.getInstance("SHA-256").let { md ->
    f.inputStream().use { input ->
        val buf = ByteArray(1 shl 16)
        while (true) { val n = input.read(buf); if (n < 0) break; md.update(buf, 0, n) }
    }
    md.digest().joinToString("") { "%02x".format(it) }
}

val prepareVoice by tasks.registering {
    description = "Scarica e controlla motore e modelli della Regia da voce"
    val out = voiceDir
    outputs.dir(out)
    doLast {
        val root = out.get().asFile
        val downloads = File(root, "downloads").apply { mkdirs() }
        val assets = File(root, "assets").apply { mkdirs() }
        val jni = File(root, "jniLibs/arm64-v8a").apply { mkdirs() }
        for ((url, name, expected) in voiceFiles) {
            val f = File(downloads, name)
            if (!f.exists() || sha256(f) != expected) {
                logger.lifecycle("Scarico $name")
                URI(url).toURL().openStream().use { input -> f.outputStream().use { input.copyTo(it) } }
            }
            val got = sha256(f)
            check(got == expected) { "Impronta SHA-256 diversa per $name: $got (attesa $expected)" }
        }
        // Dal pacchetto Android servono solo le due librerie per telefoni a 64 bit (arm64-v8a, come il CMF Phone 1)
        project.copy {
            from(project.tarTree(project.resources.bzip2(File(downloads, "sherpa-onnx-android.tar.bz2"))))
            include("**/arm64-v8a/libsherpa-onnx-jni.so", "**/arm64-v8a/libonnxruntime.so")
            eachFile { path = name }
            includeEmptyDirs = false
            into(jni)
        }
        listOf("speaker_campplus.onnx", "silero_vad.onnx").forEach { File(downloads, it).copyTo(File(assets, it), overwrite = true) }
    }
}

android {
    namespace = "it.cameracontrol.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.cameracontrol.app"
        minSdk = 31          // Android 12 o successivo
        targetSdk = 35
        versionCode = 28
        versionName = "0.9.0"
    }

    // Firma fissa: la chiave arriva dai Secrets di GitHub (KEYSTORE_BASE64, KEYSTORE_PASSWORD)
    // tramite variabili d'ambiente impostate dal workflow. Non è mai scritta nel codice.
    val signingFile = System.getenv("SIGNING_STORE_FILE")
    val signingPassword = System.getenv("SIGNING_STORE_PASSWORD")
    val hasFixedKey = !signingFile.isNullOrBlank() && !signingPassword.isNullOrBlank()

    signingConfigs {
        if (hasFixedKey) {
            create("fixed") {
                storeFile = file(signingFile!!)
                storePassword = signingPassword
                keyAlias = "cameracontrol"
                keyPassword = signingPassword
            }
        }
    }

    buildTypes {
        debug {
            // Senza chiave (es. compilazione locale) resta la firma di debug automatica
            if (hasFixedKey) signingConfig = signingConfigs.getByName("fixed")
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    // Regia da voce: librerie native e modelli preparati da prepareVoice (cartella build/voice, non nel codice)
    sourceSets["main"].jniLibs.srcDir(File(layout.buildDirectory.get().asFile, "voice/jniLibs"))
    sourceSets["main"].assets.srcDir(File(layout.buildDirectory.get().asFile, "voice/assets"))
}

tasks.named("preBuild") { dependsOn(prepareVoice) }

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.core:core-ktx:1.13.1")          // FileProvider e notifiche
    implementation("androidx.work:work-runtime-ktx:2.9.1")   // controllo aggiornamenti in sottofondo

    testImplementation("junit:junit:4.13.2")
    // org.json reale per i test sul JVM (in Android è già incluso nel sistema)
    testImplementation("org.json:json:20240303")
}
