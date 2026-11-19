# Prova notifiche (D-102)

Piccola app Android **di prova, separata da Soldirini**. Legge solo le notifiche di pagamento dell'app ING Italia e mostra le spese trovate: importo, esercente, data e ora.

- **Nessun permesso.** Niente `INTERNET`: l'app non può mandare dati da nessuna parte. L'accesso alle notifiche lo attiva l'utente in Impostazioni.
- **Solo ING:** pacchetti `it.ing.banking` (app attuale) e `it.ingdirect.app` (vecchia app). Le notifiche delle altre app vengono ignorate subito, senza leggerle.
- **Cosa salva:** importo, esercente, data e ora, pacchetto. Mai il testo della notifica. Un testo diverso dal formato noto diventa "Notifica non riconosciuta", senza contenuto.
- **Dove:** solo sul telefono, in una cartella esclusa da backup e trasferimenti (`allowBackup=false` e `dataExtractionRules`). Disinstallando l'app si cancella tutto.

## Come si compila
Su GitHub, con il workflow `.github/workflows/android-notifiche.yml` ("App di prova notifiche"). Parte quando cambia questa cartella, oppure a mano da Actions → "App di prova notifiche" → "Run workflow". Passi:
1. prove del lettore (`app/src/test`, solo esempi inventati);
2. APK di debug;
3. controllo dell'APK con `aapt2`: nessun permesso, `allowBackup` falso, regole dei dati presenti;
4. l'APK `prova-notifiche.apk` resta allegato alla run per 7 giorni.

In locale, con Android SDK e JDK 17: `gradle :app:testDebugUnitTest :app:assembleDebug` dentro questa cartella (Gradle 9.6.1 o successivo).

Versioni: Android Gradle Plugin 9.5.0, Gradle 9.6.1, JDK 17, `compileSdk`/`targetSdk` 36, `minSdk` 26 (Android 8). Nessuna libreria: solo le classi di Android (JUnit 4.13.2 solo per le prove, non entra nell'APK).

**Firma:** l'APK di debug è firmato con una chiave creata dal runner a ogni compilazione; nel repository non c'è nessuna chiave. Per installare una compilazione nuova bisogna prima disinstallare la vecchia.

## File
| File | Ruolo |
|---|---|
| `app/src/main/java/…/LettoreNotifica.java` | legge titolo e testo, restituisce importo ed esercente (Java puro) |
| `app/src/main/java/…/Ascoltatore.java` | `NotificationListenerService`: scarta subito ciò che non è ING |
| `app/src/main/java/…/Archivio.java` | le righe in `spese.json` dentro `getNoBackupFilesDir()`, al massimo 500 |
| `app/src/main/java/…/MainActivity.java` | schermata unica |
| `app/src/main/res/` | testi, colori e raggi di Soldirini (chiaro e scuro), icona vettoriale, regole dei dati |
| `app/src/test/java/…/LettoreNotificaTest.java` | prove del lettore |
