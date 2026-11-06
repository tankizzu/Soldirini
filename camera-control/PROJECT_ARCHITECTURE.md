# PROJECT_ARCHITECTURE – Gimbali (progetto Camera Control)

Nome mostrato: **Gimbali**. applicationId `it.cameracontrol.app`, repository `tankizzu/Camera-Control` e cartella `camera-control/` invariati (cambiarli romperebbe gli aggiornamenti).

## Descrizione
App Android nativa per comandare Sony α6000 (Wi-Fi) e DJI Ronin-SC (Bluetooth Low Energy) e fare regia con inquadrature salvate. Tutto locale: nessun server, account o cloud.

## Tecnologie e versioni
| Componente | Versione |
|---|---|
| Linguaggio | Kotlin 2.0.21 |
| Interfaccia | Jetpack Compose (BOM 2024.12.01), Material 3 |
| Build | Android Gradle Plugin 8.7.3, Gradle 8.11.1, Java 17 |
| Android | minimo 12 (API 31), target 15 (API 35) |
| Compilazione | GitHub Actions (`.github/workflows/build-apk.yml`) |

## Struttura
```
app/src/main/java/it/cameracontrol/app/
  MainActivity.kt            avvio app, schermo intero, tasti volume a schermo acceso, permessi Bluetooth
app/src/main/res/           icona adattiva (drawable/ic_launcher_foreground.xml + mipmap-anydpi-v26), file_paths aggiornamenti
  ronin/                     modulo RoninConnection + RoninControls
    Duml.kt                  formato pacchetti DJI, checksum, ricomposizione notifiche
    RoninCommands.kt         costruzione dei comandi (joystick, posizione, ricentra, REC)
    RoninTelemetry.kt        lettura angoli e stato registrazione
    Glide.kt                 percorso a passi (10/s, curva morbida) per movimenti di durata scelta (puro)
    RoninConnection.kt       Bluetooth: ricerca, connessione, coda di invio, stato
  camera/                    modulo CameraConnection + CameraLiveView + CameraControls
    SonyProtocol.kt          ricerca SSDP, lettura dd.xml, corpo delle richieste JSON (puro)
    LiveviewParser.kt        lettura del flusso Live View (puro)
    SonyCamera.kt            rete Wi-Fi della camera, comandi, Live View, getEvent, stato
  regia/                     modulo ShotPresets + LiveDirector
    ShotLibrary.kt           modello (Scene, Shot), durate dello slider (MOVE_DURATIONS) e regole: max 10 per scena, sposta, duplica… (puro)
    LibraryCodec.kt          formato del file JSON (org.json)
    RegiaRepository.kt       salvataggio atomico, miniature, esporta/importa
  ui/
    Theme.kt                 palette della demo grafica
    AppRoot.kt               navigazione: schermata iniziale, Regia, prove; menu ☰ + ingranaggio + Aggiorna
    RegiaScreen.kt           schermata Regia (griglia con zoom e trascinamento, REC, durata movimento, joystick, scene)
    RegiaDialogs.kt          finestre nuova/modifica inquadratura, nome scena, conferme
    RegiaViewModel.kt        stato della regia, salvataggio, richiamo sul gimbal, stato REC
    StatusBar.kt             barra di stato della Regia (REC/tempo, batterie, ora, avvisi)
    GimbalSetupScreen.kt     calibrazioni guidate (sistema, avanzata, auto-tune)
    BalanceGuide.kt          bilanciamento standard a pagine con disegni
    VoiceRegiaScreen.kt      Regia da voce (prova): persone, registrazione voce, ascolto in tempo reale
    VoiceRegiaViewModel.kt   microfono 16 kHz, finestra 1,5 s ogni 0,5 s, registrazione 20 s
    GimbalControls.kt        joystick condiviso
    UpdateViewModel.kt       stato degli aggiornamenti
    UpdateUi.kt              pulsante giallo "Aggiorna", ingranaggio, finestra impostazioni
  voice/
    VoicePrint.kt            impronte vocali (cosine, media) e VoiceDirector: regole su chi inquadrare (puro)
    VoiceStore.kt            persone e impronte in voices.json (niente audio)
    VoiceEngine.kt           sherpa-onnx: VAD silero + estrattore CAM++ (un solo thread)
  remote/
    ShotRemote.kt            ponte tasti volume/lettore ↔ Regia (inquadratura avanti/indietro, contenuto del lettore)
    VolumeRemoteService.kt   servizio in primo piano: MediaSession con volume remoto + notifica lettore
  update/
    UpdateTag.kt             regole versioni/tag "v<versionCode>" (puro)
    UpdateRepository.kt      GitHub Releases: controllo, download (rimando senza token), intent di installazione
    UpdateWorker.kt          controllo ogni 6 ore e notifica
    LogPanel.kt              registro eventi con "Copia registro"
    GimbalTestViewModel.kt   mantiene la connessione al gimbal
    GimbalTestScreen.kt      schermata di test gimbal (provvisoria)
    CameraTestViewModel.kt   mantiene la connessione alla fotocamera
    CameraTestScreen.kt      schermata di test fotocamera (provvisoria)
app/src/test/java/.../ronin/DumlTest.kt          test sui pacchetti reali registrati
app/src/test/java/.../camera/SonyProtocolTest.kt test del protocollo Sony
docs/PROTOCOLLO_RONIN_SC.md               protocollo Bluetooth decodificato
```
`Duml.kt`, `RoninCommands.kt` e `RoninTelemetry.kt` non usano Android: si possono testare e riusare (es. futuro programma per PC).

## Flusso Bluetooth
1. Ricerca di un dispositivo il cui nome inizia con "RONIN" (timeout 15 s).
2. Connessione GATT, MTU 247, ricerca servizio FFF0.
3. Notifiche attivate su FFF4; i comandi vanno su FFF5 tramite una coda (un invio alla volta).
4. Le notifiche sono ricomposte in frame e lette da `RoninTelemetry`.

## Flusso Wi-Fi (Sony α6000)
1. Sulla camera si avvia "Smart Remote Control", che mostra nome (`DIRECT-…`) e password della sua rete.
2. "Connetti" apre il pannello Wi-Fi di Android (`Settings.Panel.ACTION_WIFI`); l'utente si collega alla rete della camera. Alla chiusura l'app chiede ad Android la rete Wi-Fi senza Internet e usa solo quella. (`WifiNetworkSpecifier` provato in 0.2.2: non funziona sul CMF Phone.)
3. Ricerca SSDP (`urn:schemas-sony-com:service:ScalarWebAPI:1`) → dd.xml → `<ActionList_URL>/camera`; se non risponde: `http://192.168.122.1:8080/sony/camera`.
4. Comandi JSON via HTTP POST: getAvailableApiList, startRecMode, startLiveview, stopLiveview, getEvent. (startMovieRec/stopMovieRec non supportati dalla α6000.)
5. Live View: flusso HTTP di pacchetti (8 + 128 byte di intestazione + JPEG), decodificato in immagini.

## Permessi
- `BLUETOOTH_SCAN` (con `neverForLocation`) e `BLUETOOTH_CONNECT`. Nessun permesso di posizione.
- `INTERNET`, `ACCESS_NETWORK_STATE`, `CHANGE_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`: solo per la rete locale della fotocamera.
- `usesCleartextTraffic="true"`: la Sony risponde solo in http. L'app non contatta server esterni.

## Dati
Cartella privata dell'app (`filesDir`), cancellata solo disinstallando:
- `regia.json`: libreria. Formato `camera-control-regia` v1:
  `{format, version, activeSceneId, scenes:[{id, name, shots:[{id, name, pan, tilt, thumbVersion}]}]}`.
  (Il campo `reference` scritto dalla sola 0.6.0 viene ignorato.)
  (I campi `mode`/`durationSec` dei file 0.3–0.4 sono ignorati in lettura.)
- SharedPreferences `regia_settings`: `move_duration_step` = posizione dello slider Durata movimento (0 = Max).
  Scrittura con `AtomicFile` (mai file a metà). Se illeggibile: copiato in `regia-illeggibile-<data>.json` e si riparte vuoti.
- `thumbs/<idInquadratura>.jpg`: miniature (JPEG 85%), ripulite quando l'inquadratura non esiste più.
- Relazioni: libreria 1→N scene (1–20), scena 1→N inquadrature (0–10). Id univoci UUID.
- Esporta/Importa: stesso formato con in più `thumbnail` (JPEG in base64) per ogni inquadratura; l'importazione sostituisce tutto, dopo conferma.
- Angoli in gradi relativi all'impugnatura del gimbal (pan −180…180, tilt −90…90).

## Servizi esterni
- Dispositivi locali: Ronin-SC (Bluetooth) e α6000 (Wi-Fi diretto).
- **GitHub API (solo aggiornamenti, facoltativo)**: `GET /repos/tankizzu/Camera-Control/releases/latest` e download dell'allegato `.apk` (Accept: application/octet-stream; il rimando 302 è aperto senza token). Autenticazione con codice di accesso a grana fine, sola lettura "Contents" della sola repository, inserito dall'utente e salvato in SharedPreferences privato "updates". Senza codice l'app funziona normalmente e non contatta Internet.
- WorkManager 2.9.1: controllo periodico ogni 6 ore con rete disponibile.

## Compilazione
GitHub Actions: Java 17 + Gradle 8.11.1, `gradle testDebugUnitTest assembleDebug` nella cartella `camera-control/`; l'APK è pubblicato come artifact `camera-control-apk` e, sul ramo principale, come Release `v<versionCode>` (file `camera-control.apk`, sostituito se la Release esiste già). **Ricordarsi di aumentare `versionCode` a ogni versione**, altrimenti l'app non vede l'aggiornamento.

## Firma
- Chiave fissa PKCS12, alias `cameracontrol`, creata dall'utente con un workflow una-tantum (poi eliminato). Copia di riserva del file `.jks` e della password conservata dall'utente.
- Secrets GitHub: `KEYSTORE_BASE64` (chiave in base64) e `KEYSTORE_PASSWORD`. Il workflow la decodifica in una cartella temporanea e la passa a Gradle con `SIGNING_STORE_FILE` / `SIGNING_STORE_PASSWORD`.
- Senza queste variabili (compilazione locale) si usa la firma di debug automatica.
- Se la chiave va persa, l'app non si può più aggiornare sopra la versione installata: servono disinstallazione e reimportazione dei dati.


## Regia da voce (dalla 0.9.0)
- Libreria **sherpa-onnx v2.0.1** (Apache 2.0): file Kotlin originali in `app/src/main/java/com/k2fsa/sherpa/onnx/` (il pacchetto deve restare `com.k2fsa.sherpa.onnx`, le funzioni native sono legate a quei nomi) + `libsherpa-onnx-jni.so` e `libonnxruntime.so` (solo arm64-v8a).
- Modelli negli asset: `speaker_campplus.onnx` (CAM++ VoxCeleb, ~30 MB) e `silero_vad.onnx` (~0,6 MB).
- Librerie e modelli **non sono nel repository**: il task Gradle `prepareVoice` (prima di `preBuild`) li scarica da GitHub Releases in `app/build/voice/`, verifica SHA-256 e li aggiunge a `jniLibs` e `assets`. Per aggiornare la versione: cambiare `sherpaVersion`, le impronte e i 4 file Kotlin alla stessa versione.
- Dati: `filesDir/voices.json` = `[{id, name, embedding:[512 numeri]}]`. Nessun audio salvato.
- Permesso: RECORD_AUDIO (richiesto dalla schermata).
