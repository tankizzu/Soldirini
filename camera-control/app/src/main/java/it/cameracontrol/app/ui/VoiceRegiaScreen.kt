package it.cameracontrol.app.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import it.cameracontrol.app.voice.Voice
import kotlinx.coroutines.delay

/**
 * Regia da voce (PROVA, nome provvisorio): sezione separata dalla Regia.
 * Si registrano le voci, poi "Ascolta" mostra chi parla e su chi andrebbe l'inquadratura. Il gimbal NON si muove.
 */
@Composable
fun VoiceRegiaScreen(vm: VoiceRegiaViewModel = viewModel()) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var hasMic by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
    }
    var pending by remember { mutableStateOf<(() -> Unit)?>(null) }
    val askMic = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasMic = granted
        if (granted) pending?.invoke()
        pending = null
    }
    val withMic: (() -> Unit) -> Unit = { action ->
        if (hasMic) action() else { pending = action; askMic.launch(Manifest.permission.RECORD_AUDIO) }
    }
    var addOpen by remember { mutableStateOf(false) }
    var toDelete by remember { mutableStateOf<Voice?>(null) }

    // Uscendo dalla sezione il microfono si spegne
    DisposableEffect(Unit) { onDispose { vm.stopAll() } }
    LaunchedEffect(ui.message) {
        if (ui.message != null) { delay(3500); vm.dismissMessage() }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Prova: l'app riconosce chi parla e mostra su chi andrebbe l'inquadratura. Il gimbal non si muove. " +
                "L'audio resta sul telefono e non viene salvato.",
            color = Palette.TextMuted, fontSize = 13.sp,
        )
        if (!hasMic) {
            Text("Serve il permesso del microfono: te lo chiedo al primo ascolto o registrazione.", color = Palette.Warning, fontSize = 13.sp)
        }
        ui.message?.let {
            Text(it, color = Palette.Text, fontSize = 14.sp, modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Palette.Raised).padding(12.dp))
        }

        // ---------- Ascolto ----------
        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Ascolto", color = Palette.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                if (ui.listening) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(if (ui.speech) Palette.Live else Palette.Border))
                    Text(if (ui.speech) "  voce" else "  silenzio", color = Palette.TextMuted, fontSize = 13.sp)
                }
            }
            BigAction(
                label = when {
                    ui.loading -> "Avvio…"
                    ui.listening -> "Ferma ascolto"
                    else -> "Avvia ascolto"
                },
                color = if (ui.listening) Palette.Raised else Palette.Accent,
                enabled = ui.enrolling == null && !ui.loading,
            ) { if (ui.listening) vm.stopAll() else withMic { vm.toggleListening() } }

            if (ui.listening) {
                val decided = ui.voices.firstOrNull { it.id == ui.decision }
                Text("Inquadratura", color = Palette.TextMuted, fontSize = 12.sp)
                Text(
                    decided?.name ?: "— (nessuna ancora)",
                    color = if (decided != null) Palette.Text else Palette.TextMuted,
                    fontSize = 26.sp, fontWeight = FontWeight.SemiBold,
                )
                if (ui.voices.none { it.enrolled }) {
                    Text("Registra almeno una voce qui sotto per vedere i riconoscimenti.", color = Palette.Warning, fontSize = 13.sp)
                }
                ui.voices.filter { it.enrolled }.forEach { v ->
                    ScoreRow(v.name, ui.scores[v.id], ui.threshold, highlighted = v.id == ui.decision)
                }
            }
        }

        // ---------- Persone ----------
        Card {
            Text("Persone (${ui.voices.size}/${VoiceRegiaViewModel.MAX_VOICES})", color = Palette.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Per registrare: fai parlare la persona in modo naturale per ${VoiceRegiaViewModel.ENROLL_SECONDS} secondi, " +
                    "da sola e alla distanza a cui sarà durante la ripresa.",
                color = Palette.TextMuted, fontSize = 13.sp,
            )
            ui.enrolling?.let { e ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Palette.Inset).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("Registro la voce di ${e.name}: parla normalmente…", color = Palette.Text, fontSize = 14.sp)
                    LinearProgressIndicator(
                        progress = { (e.elapsedSec / VoiceRegiaViewModel.ENROLL_SECONDS).coerceIn(0f, 1f) },
                        color = Palette.RecLight, trackColor = Palette.Border,
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                    )
                    Text(
                        "%.0f / %d s · voce rilevata %.0f s".format(e.elapsedSec, VoiceRegiaViewModel.ENROLL_SECONDS, e.speechSec),
                        color = Palette.TextMuted, fontSize = 12.sp, fontFamily = FontFamily.Monospace,
                    )
                    SmallAction("Annulla") { vm.stopAll() }
                }
            }
            ui.voices.forEach { v ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Palette.Inset).padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(v.name, color = Palette.Text, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                        Text(
                            if (v.enrolled) "Voce registrata ✓" else "Voce da registrare",
                            color = if (v.enrolled) Palette.Live else Palette.Warning, fontSize = 12.sp,
                        )
                    }
                    SmallAction(if (v.enrolled) "Riregistra" else "Registra", enabled = ui.enrolling == null) {
                        withMic { vm.startEnroll(v.id) }
                    }
                    SmallAction("Elimina", enabled = ui.enrolling == null) { toDelete = v }
                }
            }
            if (ui.voices.size < VoiceRegiaViewModel.MAX_VOICES) {
                SmallAction("+ Aggiungi persona", enabled = ui.enrolling == null) { addOpen = true }
            }
        }

        // ---------- Sensibilità ----------
        Card {
            Text("Sicurezza minima: ${(ui.threshold * 100).toInt()}%", color = Palette.Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Sotto questa somiglianza la voce è \"incerta\" e l'inquadratura resta dov'è. " +
                    "Alzala se scambia le persone, abbassala se non riconosce mai nessuno.",
                color = Palette.TextMuted, fontSize = 13.sp,
            )
            Slider(
                value = ui.threshold,
                onValueChange = { vm.setThreshold((it * 20).toInt() / 20f) },
                valueRange = 0.2f..0.8f,
                colors = SliderDefaults.colors(thumbColor = Palette.Accent, activeTrackColor = Palette.Accent, inactiveTrackColor = Palette.Border),
            )
            Text(
                "Regole: silenzio → resta sull'ultima persona; voci sovrapposte → resta su chi parlava prima; " +
                    "cambia solo dopo circa 1 secondo di voce sicura della nuova persona.",
                color = Palette.TextMuted, fontSize = 12.sp,
            )
        }
    }

    if (addOpen) {
        NameDialog(
            title = "Nuova persona",
            initial = "",
            hint = "Nome (es. Marta)",
            onConfirm = { vm.addVoice(it); addOpen = false },
            onDismiss = { addOpen = false },
        )
    }
    toDelete?.let { v ->
        ConfirmDialog(
            title = "Eliminare ${v.name}?",
            text = "Si cancella anche l'impronta della sua voce.",
            confirm = "Elimina",
            onConfirm = { vm.deleteVoice(v.id); toDelete = null },
            onDismiss = { toDelete = null },
        )
    }
}

@Composable
private fun Card(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Palette.Panel).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

/** Barra della somiglianza con una persona; la linea indica la soglia. */
@Composable
private fun ScoreRow(name: String, score: Float?, threshold: Float, highlighted: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(name, color = if (highlighted) Palette.Text else Palette.TextMuted, fontSize = 14.sp, modifier = Modifier.width(96.dp), maxLines = 1)
        Box(Modifier.weight(1f).height(14.dp).clip(RoundedCornerShape(7.dp)).background(Palette.Inset)) {
            val v = (score ?: 0f).coerceIn(0f, 1f)
            Box(
                Modifier.fillMaxWidth(v).height(14.dp).clip(RoundedCornerShape(7.dp))
                    .background(if (highlighted) Palette.Accent else if (v >= threshold) Palette.Live else Palette.Border),
            )
            Box(Modifier.fillMaxWidth(threshold).height(14.dp)) {
                Box(Modifier.align(Alignment.CenterEnd).width(2.dp).height(14.dp).background(Palette.Warning))
            }
        }
        Text(score?.let { "${(it * 100).toInt()}%" } ?: "—", color = Palette.Text, fontSize = 13.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.width(44.dp))
    }
}

@Composable
private fun BigAction(label: String, color: Color, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(12.dp))
            .background(if (enabled) color else Palette.Raised)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (enabled) Color.White else Palette.TextMuted, fontSize = 17.sp, fontWeight = FontWeight.SemiBold) }
}

@Composable
private fun SmallAction(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier.height(44.dp).clip(shape).border(1.dp, Palette.Border, shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (enabled) Palette.Text else Palette.TextMuted, fontSize = 14.sp) }
}
