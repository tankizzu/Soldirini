#!/usr/bin/env bash
# Controllo dell'APK dell'app di prova (D-102; A1 di 03, tornata 27). Si ferma al primo problema.
# Uso: controlla-apk.sh <file.apk>   (serve ANDROID_HOME con i build-tools, come sui runner di GitHub)
set -euo pipefail
APK="$1"
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
AAPT2="$BT/aapt2"
errore() { echo "::error::$1"; exit 1; }
T=$(mktemp -d); cd "$T" # file di lavoro fuori dal repository
APK=$(cd "$OLDPWD" && realpath "$APK")
echo "Strumenti: $BT"

echo "== Impronta SHA-256 dell'APK (da confrontare con il file scaricato)"
sha256sum "$APK"
echo "== Certificato di firma (chiave di debug creata dal runner per questa compilazione)"
"$BT/apksigner" verify --print-certs "$APK"

echo "== Pacchetto e versioni"
"$AAPT2" dump badging "$APK" | grep -E "^(package|sdkVersion|targetSdkVersion|application-debuggable)" || true
"$AAPT2" dump badging "$APK" | grep -q "^package: name='io.github.tankizzu.provanotifiche'" || errore "Nome del pacchetto inatteso."

echo "== Permessi (attesi: nessuno)"
"$AAPT2" dump permissions "$APK" | tee permessi.txt
if grep -qE "uses-permission" permessi.txt; then
  errore "L'APK chiede dei permessi (uses-permission o uses-permission-sdk-23): non deve chiederne nessuno, in particolare INTERNET."
fi

"$AAPT2" dump xmltree --file AndroidManifest.xml "$APK" > manifesto.txt
echo "== Componenti (attesi: 1 schermata, 1 servizio, nessun provider né receiver)"
conta() { grep -cE "^[[:space:]]+E: $1 \(" manifesto.txt || true; }
for c in provider receiver activity-alias; do
  [ "$(conta "$c")" = "0" ] || errore "Trovato un componente \"$c\": non ci deve essere."
done
[ "$(conta activity)" = "1" ] || errore "Le schermate devono essere esattamente una."
[ "$(conta service)" = "1" ] || errore "I servizi devono essere esattamente uno."
esportati=$(grep -cE "exported\([^)]*\)=(true|0xffffffff)" manifesto.txt || true)
echo "Componenti esportati: $esportati (attesi 2: la schermata principale e il servizio)"
[ "$esportati" -le 2 ] || errore "Troppi componenti esportati."
grep -q '"android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"' manifesto.txt || errore "Il servizio non è protetto da BIND_NOTIFICATION_LISTENER_SERVICE."
grep -q '"android.service.notification.NotificationListenerService"' manifesto.txt || errore "Manca il filtro del servizio."

echo "== Pacchetti in <queries> (attesi: solo i due di ING)"
awk '/E: queries/{q=1;next} q&&/E: application/{q=0} q' manifesto.txt | grep -oE 'name\([^)]*\)="[^"]+"' | sed -E 's/.*="([^"]+)"/\1/' | sort > queries.txt
cat queries.txt
printf 'it.ing.banking\nit.ingdirect.app\n' | sort | diff -q - queries.txt > /dev/null || errore "<queries> deve contenere solo it.ing.banking e it.ingdirect.app."

echo "== Backup"
grep -E "allowBackup|dataExtractionRules" manifesto.txt
grep -qE "allowBackup\([^)]*\)=(false|0x0)" manifesto.txt || errore "allowBackup non è false."
grep -q "dataExtractionRules" manifesto.txt || errore "Mancano le regole che escludono i dati dal backup."
"$AAPT2" dump xmltree --file res/xml/regole_dati.xml "$APK" > regole.txt || errore "Il file delle regole dei dati non è nell'APK."
grep -q "E: cloud-backup" regole.txt || errore "Le regole non escludono il backup su Google."
grep -q "E: device-transfer" regole.txt || errore "Le regole non escludono il passaggio a un altro telefono."
echo "Regole dei dati: cloud-backup e device-transfer presenti."

echo "Controllo dell'APK: tutto in ordine."
