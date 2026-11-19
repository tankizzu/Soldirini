package io.github.tankizzu.provanotifiche;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.AtomicFile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Le righe trovate, in un file JSON nella cartella privata dell'app che Android esclude sempre
 * da backup e trasferimenti (getNoBackupFilesDir). Nessun testo delle notifiche: solo importo,
 * esercente, ora, pacchetto e un'impronta per non salvare due volte la stessa notifica.
 */
final class Archivio {
    private Archivio() {}

    static final int MASSIMO_RIGHE = 500;
    private static final String NOME_FILE = "spese.json";
    private static final Object BLOCCO = new Object();
    private static final List<Runnable> ASCOLTI = new CopyOnWriteArrayList<>();
    private static final Handler PRINCIPALE = new Handler(Looper.getMainLooper());

    /** Una riga dell'elenco. centesimi = -1: notifica non riconosciuta (esercente null). */
    static final class Riga {
        final String impronta;
        final long quando;
        final long centesimi;
        final String esercente;
        final String pacchetto;

        Riga(String impronta, long quando, long centesimi, String esercente, String pacchetto) {
            this.impronta = impronta;
            this.quando = quando;
            this.centesimi = centesimi;
            this.esercente = esercente;
            this.pacchetto = pacchetto;
        }

        boolean riconosciuta() {
            return centesimi >= 0;
        }
    }

    /** Impronta della notifica (pacchetto, id, tag, ora): non contiene il testo e non permette di risalirci. */
    static String impronta(String pacchetto, int id, String tag, long quando) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest((pacchetto + "|" + id + "|" + tag + "|" + quando).getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 12; i++) b.append(String.format("%02x", h[i]));
            return b.toString();
        } catch (NoSuchAlgorithmException e) {
            return pacchetto + "|" + quando; // SHA-256 c'è sempre su Android: non succede
        }
    }

    /** Aggiunge la riga se non c'è già. @return true se aggiunta */
    static boolean aggiungi(Context c, Riga r) {
        synchronized (BLOCCO) {
            List<Riga> righe = leggiSenzaBlocco(c);
            for (Riga x : righe) if (x.impronta.equals(r.impronta)) return false;
            righe.add(r);
            Collections.sort(righe, (a, b) -> Long.compare(b.quando, a.quando));
            while (righe.size() > MASSIMO_RIGHE) righe.remove(righe.size() - 1);
            if (!scriviSenzaBlocco(c, righe)) return false;
        }
        avvisa();
        return true;
    }

    /** Righe dalla più recente. */
    static List<Riga> leggi(Context c) {
        synchronized (BLOCCO) {
            return leggiSenzaBlocco(c);
        }
    }

    static void cancellaTutto(Context c) {
        synchronized (BLOCCO) {
            file(c).delete();
        }
        avvisa();
    }

    static void ascolta(Runnable r) {
        ASCOLTI.add(r);
    }

    static void smettiDiAscoltare(Runnable r) {
        ASCOLTI.remove(r);
    }

    private static void avvisa() {
        for (Runnable r : ASCOLTI) PRINCIPALE.post(r);
    }

    private static AtomicFile file(Context c) {
        return new AtomicFile(new File(c.getNoBackupFilesDir(), NOME_FILE));
    }

    private static List<Riga> leggiSenzaBlocco(Context c) {
        List<Riga> righe = new ArrayList<>();
        try {
            // readFully riprende anche la copia di riserva se una scrittura si è interrotta; se il file non c'è: FileNotFoundException
            JSONArray a = new JSONArray(new String(file(c).readFully(), StandardCharsets.UTF_8));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o == null) continue;
                String k = o.optString("k", "");
                long t = o.optLong("t", 0);
                if (k.isEmpty() || t <= 0) continue;
                long cent = o.optLong("c", -1);
                String es = cent >= 0 ? o.optString("e", "") : null;
                righe.add(new Riga(k, t, cent, es, o.optString("p", "")));
            }
        } catch (IOException | JSONException e) {
            // file illeggibile: si riparte da un elenco vuoto (sono solo dati di prova)
        }
        return righe;
    }

    private static boolean scriviSenzaBlocco(Context c, List<Riga> righe) {
        JSONArray a = new JSONArray();
        try {
            for (Riga r : righe) {
                JSONObject o = new JSONObject();
                o.put("k", r.impronta);
                o.put("t", r.quando);
                o.put("p", r.pacchetto);
                if (r.riconosciuta()) {
                    o.put("c", r.centesimi);
                    o.put("e", r.esercente);
                }
                a.put(o);
            }
        } catch (JSONException e) {
            return false;
        }
        AtomicFile f = file(c);
        FileOutputStream out = null;
        try {
            out = f.startWrite();
            out.write(a.toString().getBytes(StandardCharsets.UTF_8));
            f.finishWrite(out);
            return true;
        } catch (IOException e) {
            if (out != null) f.failWrite(out);
            return false;
        }
    }
}
