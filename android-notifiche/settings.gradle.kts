// App di prova delle notifiche (D-102). Progetto separato da Soldirini: non usa nulla della cartella soldirini/.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "prova-notifiche"
include(":app")
