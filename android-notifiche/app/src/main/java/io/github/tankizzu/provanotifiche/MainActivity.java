package io.github.tankizzu.provanotifiche;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** Schermata unica: stato del permesso, app ING trovata, elenco delle spese, "Cancella tutto". */
public class MainActivity extends Activity {

    private final Runnable aggiorna = this::mostraElenco;
    private TextView statoValore;
    private TextView ingValore;
    private TextView titoloElenco;
    private LinearLayout elenco;
    private TextView vuoto;
    private Button cancella;
    private Button apri;
    private TextView pallino;
    private TextView statoNota;
    private LinearLayout colonna;
    private View spiegazione;
    private View stato;
    private View bloccoElenco;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        statoValore = findViewById(R.id.stato_valore);
        ingValore = findViewById(R.id.ing_valore);
        titoloElenco = findViewById(R.id.titolo_elenco);
        elenco = findViewById(R.id.elenco);
        vuoto = findViewById(R.id.vuoto);
        cancella = findViewById(R.id.cancella);
        apri = findViewById(R.id.apri_impostazioni);
        pallino = findViewById(R.id.stato_pallino);
        statoNota = findViewById(R.id.stato_nota);
        colonna = findViewById(R.id.colonna);
        spiegazione = findViewById(R.id.spiegazione);
        stato = findViewById(R.id.stato);
        bloccoElenco = findViewById(R.id.blocco_elenco);
        apri.setOnClickListener(v -> apriImpostazioni());
        cancella.setOnClickListener(v -> chiediCancella());
        bordiDelloSchermo();
    }

    @Override
    protected void onStart() {
        super.onStart();
        Archivio.ascolta(aggiorna);
    }

    @Override
    protected void onResume() {
        super.onResume();
        boolean attivo = accessoAttivo();
        statoValore.setText(attivo ? R.string.stato_attivo : R.string.stato_non_attivo);
        statoValore.setTextColor(getColor(attivo ? R.color.ok : R.color.err));
        pallino.setTextColor(getColor(attivo ? R.color.ok : R.color.err));
        statoNota.setVisibility(attivo ? View.GONE : View.VISIBLE);
        // 02 (tornata 27 §5): pulsante pieno finché l'accesso non è attivo, poi a bordo
        apri.setBackgroundResource(attivo ? R.drawable.pulsante_contorno : R.drawable.pulsante);
        apri.setTextColor(getColor(attivo ? R.color.pri : R.color.pri_ink));
        ordina(attivo);
        // accesso dato ma servizio scollegato (per esempio fermato dal risparmio energetico): chiede ad Android di ricollegarlo
        if (attivo && !Ascoltatore.collegato) NotificationListenerService.requestRebind(componente());
        mostraIng();
        mostraElenco();
    }

    @Override
    protected void onStop() {
        Archivio.smettiDiAscoltare(aggiorna);
        super.onStop();
    }

    /** Ordine dei blocchi (02): senza accesso spiegazione, stato, elenco; con l'accesso stato, elenco e la spiegazione in fondo. */
    private void ordina(boolean attivo) {
        View[] ordine = attivo ? new View[] {stato, bloccoElenco, spiegazione} : new View[] {spiegazione, stato, bloccoElenco};
        for (View v : ordine) {
            colonna.removeView(v);
            colonna.addView(v);
        }
    }

    private ComponentName componente() {
        return new ComponentName(this, Ascoltatore.class);
    }

    private boolean accessoAttivo() {
        if (Build.VERSION.SDK_INT >= 27) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            return nm != null && nm.isNotificationListenerAccessGranted(componente());
        }
        String elenco = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (elenco == null) return false;
        String mio = componente().flattenToString();
        for (String s : elenco.split(":")) if (mio.equals(s)) return true;
        return false;
    }

    private void apriImpostazioni() {
        if (Build.VERSION.SDK_INT >= 30) {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            i.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, componente().flattenToString());
            try {
                startActivity(i);
                return;
            } catch (ActivityNotFoundException e) {
                // alcuni telefoni non hanno la pagina della singola app: si apre l'elenco
            }
        }
        try {
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        } catch (ActivityNotFoundException e) {
            statoValore.setText(R.string.impostazioni_non_trovate);
        }
    }

    /** Quale dei pacchetti ING è installato (si vede grazie a &lt;queries&gt; nel manifesto, senza permessi). */
    private void mostraIng() {
        List<String> trovati = new ArrayList<>();
        PackageManager pm = getPackageManager();
        for (String p : Ascoltatore.PACCHETTI_ING) {
            try {
                pm.getPackageInfo(p, 0);
                trovati.add(p);
            } catch (PackageManager.NameNotFoundException e) {
                // non installato
            }
        }
        Collections.sort(trovati);
        ingValore.setText(trovati.isEmpty() ? getString(R.string.ing_nessuna) : String.join(", ", trovati));
    }

    private void mostraElenco() {
        List<Archivio.Riga> righe = Archivio.leggi(this);
        titoloElenco.setText(getString(R.string.titolo_elenco, righe.size()));
        elenco.removeAllViews();
        vuoto.setVisibility(righe.isEmpty() ? View.VISIBLE : View.GONE);
        elenco.setVisibility(righe.isEmpty() ? View.GONE : View.VISIBLE);
        cancella.setEnabled(!righe.isEmpty());
        cancella.setAlpha(righe.isEmpty() ? 0.45f : 1f);
        SimpleDateFormat quando = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.ITALY);
        LayoutInflater li = getLayoutInflater();
        for (int i = 0; i < righe.size(); i++) {
            Archivio.Riga r = righe.get(i);
            View v = li.inflate(R.layout.riga, elenco, false);
            TextView nome = v.findViewById(R.id.riga_esercente);
            TextView dettagli = v.findViewById(R.id.riga_dettagli);
            TextView importo = v.findViewById(R.id.riga_importo);
            String data = quando.format(new Date(r.quando));
            dettagli.setText(getString(R.string.riga_dettagli, data, r.pacchetto));
            if (r.riconosciuta()) {
                nome.setText(r.esercente);
                importo.setText(LettoreNotifica.formattaImporto(r.centesimi));
                v.setContentDescription(getString(R.string.riga_letta, LettoreNotifica.formattaImporto(r.centesimi), r.esercente, data));
            } else {
                nome.setText(R.string.non_riconosciuta);
                nome.setTextColor(getColor(R.color.err));
                importo.setText("");
                v.findViewById(R.id.riga_nota).setVisibility(View.VISIBLE);
                v.setContentDescription(getString(R.string.non_riconosciuta) + ", " + data + ". " + getString(R.string.non_riconosciuta_nota));
            }
            if (i == righe.size() - 1) v.findViewById(R.id.riga_linea).setVisibility(View.GONE);
            elenco.addView(v);
        }
    }

    private void chiediCancella() {
        AlertDialog d = new AlertDialog.Builder(this)
                .setTitle(R.string.cancella_titolo)
                .setMessage(R.string.cancella_testo)
                .setNegativeButton(R.string.annulla, null)
                .setPositiveButton(R.string.cancella_conferma, (x, w) -> Archivio.cancellaTutto(this))
                .show();
        Button rosso = d.getButton(AlertDialog.BUTTON_POSITIVE); // [Cancella] rosso (02)
        if (rosso != null) rosso.setTextColor(getColor(R.color.err));
    }

    /** Da Android 15 l'app disegna sotto le barre di sistema: si lascia lo spazio delle barre. */
    private void bordiDelloSchermo() {
        if (Build.VERSION.SDK_INT < 30) return;
        getWindow().setDecorFitsSystemWindows(false);
        View radice = findViewById(R.id.radice);
        final int sx = radice.getPaddingLeft(), su = radice.getPaddingTop(), dx = radice.getPaddingRight(), giu = radice.getPaddingBottom();
        radice.setOnApplyWindowInsetsListener((v, ins) -> {
            Insets b = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            v.setPadding(sx + b.left, su + b.top, dx + b.right, giu + b.bottom);
            return ins;
        });
        radice.requestApplyInsets();
    }
}
