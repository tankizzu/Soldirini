plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.tankizzu.provanotifiche"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.tankizzu.provanotifiche"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Nessuna dipendenza nell'app. JUnit serve solo alle prove sul computer e non entra nell'APK.
    testImplementation("junit:junit:4.13.2")
}
