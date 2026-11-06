package it.cameracontrol.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import it.cameracontrol.app.camera.CameraLink
import it.cameracontrol.app.ronin.LinkStatus

/** Schermate dell'app. */
enum class Screen { HOME, REGIA, GIMBAL, CAMERA, SETUP, VOICE }

/** Voce aggiuntiva del menu ☰ (es. Esporta/Importa nella Regia). */
data class MenuEntry(val label: String, val action: () -> Unit)

/**
 * Radice dell'app: schermata iniziale → Regia; schermate di prova Gimbal e Fotocamera dal menu ☰.
 * Il tasto Indietro del telefono riporta alla schermata iniziale.
 * I ViewModel sono legati all'Activity: le connessioni restano attive cambiando schermata.
 */
@Composable
fun AppRoot(updates: UpdateViewModel = viewModel()) {
    var screen by rememberSaveable { mutableStateOf(Screen.HOME) }
    var settingsOpen by remember { mutableStateOf(false) }
    var setupKind by rememberSaveable { mutableStateOf(SetupKind.BALANCE) }
    val update by updates.state.collectAsStateWithLifecycle()

    BackHandler(enabled = screen != Screen.HOME) { screen = Screen.HOME }

    InstallLauncher(update, onLaunched = updates::installLaunched, onError = { settingsOpen = true })
    if (settingsOpen) {
        UpdateSettingsDialog(
            state = update,
            onSaveToken = updates::saveToken,
            onRemoveToken = updates::removeToken,
            onCheck = updates::check,
            onUpdate = updates::downloadAndInstall,
            onDismiss = { settingsOpen = false },
        )
    }

    // Gruppo in alto a destra, uguale in tutte le schermate: Aggiorna (se c'è), ingranaggio, menu ☰
    val topActions: @Composable (List<MenuEntry>) -> Unit = { extra ->
        TopActions(
            update = update,
            onUpdate = updates::downloadAndInstall,
            onSettings = { settingsOpen = true },
            current = screen,
            onNavigate = { screen = it },
            extra = extra,
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Palette.Ground)
            .safeDrawingPadding(),
    ) {
        when (screen) {
            Screen.HOME -> HomeScreen(
                onRegia = { screen = Screen.REGIA },
                onSetup = { setupKind = it; screen = Screen.SETUP },
                topActions = topActions,
            )
            Screen.SETUP -> TestScreenFrame(setupKind.title, topActions, onBack = { screen = Screen.HOME }) {
                GimbalSetupScreen(kind = setupKind, onOpenAutoTune = { setupKind = SetupKind.AUTOTUNE })
            }
            Screen.REGIA -> RegiaScreen(onOpenCamera = { screen = Screen.CAMERA }, topActions = topActions)
            Screen.GIMBAL -> TestScreenFrame("Gimbal · prova", topActions, onBack = { screen = Screen.HOME }) { GimbalTestScreen() }
            Screen.VOICE -> TestScreenFrame("Regia da voce · prova", topActions, onBack = { screen = Screen.HOME }) { VoiceRegiaScreen() }
            Screen.CAMERA -> TestScreenFrame("Fotocamera · Live View", topActions, onBack = { screen = Screen.HOME }) { CameraTestScreen() }
        }
    }
}

@Composable
fun TopActions(
    update: UpdateState,
    onUpdate: () -> Unit,
    onSettings: () -> Unit,
    current: Screen,
    onNavigate: (Screen) -> Unit,
    extra: List<MenuEntry>,
) {
    var menu by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        UpdateButton(update, onClick = onUpdate)
        SettingsButton(onClick = onSettings)
        Box {
            Box(
                modifier = Modifier
                    .size(44.dp, 40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(role = Role.Button) { menu = true }
                    .semantics { contentDescription = "Menu" },
                contentAlignment = Alignment.Center,
            ) { MenuIcon() }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                listOf(
                    Screen.HOME to "Schermata iniziale",
                    Screen.REGIA to "Regia",
                    Screen.VOICE to "Regia da voce (prova)",
                    Screen.GIMBAL to "Gimbal (prova)",
                    Screen.CAMERA to "Fotocamera e Live View",
                ).forEach { (target, label) ->
                    DropdownMenuItem(
                        text = { Text(if (target == current) "● $label" else label) },
                        onClick = { onNavigate(target); menu = false },
                    )
                }
                if (extra.isNotEmpty()) {
                    HorizontalDivider()
                    extra.forEach { entry ->
                        DropdownMenuItem(text = { Text(entry.label) }, onClick = { entry.action(); menu = false })
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuIcon() {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(3) { Box(Modifier.width(20.dp).height(2.dp).background(Palette.Text)) }
    }
}

/** Cornice delle schermate di prova: titolo, pulsante "← Inizio" e gruppo in alto a destra. */
@Composable
private fun TestScreenFrame(
    title: String,
    topActions: @Composable (List<MenuEntry>) -> Unit,
    onBack: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Piccola freccia in alto a sinistra: torna alla schermata iniziale (funziona anche il gesto Indietro)
            if (onBack != null) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onBack)
                        .semantics { contentDescription = "Torna alla schermata iniziale" },
                    contentAlignment = Alignment.Center,
                ) { Text("←", color = Palette.Text, fontSize = 22.sp) }
            }
            Text(title, color = Palette.Text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 4.dp))
            Spacer(Modifier.weight(1f))
            topActions(emptyList())
        }
        Box(Modifier.weight(1f).fillMaxWidth()) { content() }
    }
}

// ---------- Schermata iniziale ----------

/**
 * Schermata d'apertura a tutto schermo: Connetti gimbal, Connetti fotocamera e, sotto, il grande pulsante Regia.
 */
@Composable
fun HomeScreen(
    onRegia: () -> Unit,
    onSetup: (SetupKind) -> Unit,
    topActions: @Composable (List<MenuEntry>) -> Unit,
    gimbalVm: GimbalTestViewModel = viewModel(),
    cameraVm: CameraTestViewModel = viewModel(),
) {
    val gimbal by gimbalVm.ronin.state.collectAsStateWithLifecycle()
    val cam by cameraVm.camera.state.collectAsStateWithLifecycle()
    val connectCamera = rememberCameraConnector(cameraVm.camera)

    val gimbalReady = gimbal.status == LinkStatus.READY
    val gimbalBusy = gimbal.status == LinkStatus.SCANNING || gimbal.status == LinkStatus.CONNECTING
    val camReady = cam.status == CameraLink.READY
    val camBusy = cam.status == CameraLink.WAITING_WIFI || cam.status == CameraLink.SEARCHING

    val gimbalCard: @Composable (Modifier) -> Unit = { m ->
        ConnectCard(
            title = "Gimbal Ronin-SC",
            subtitle = "Movimenti, inquadrature e REC",
            status = when {
                gimbalReady -> gimbal.battery?.let { "Connesso · batteria ${it.percent}%" } ?: "Connesso"
                gimbalBusy -> "Connessione…"
                gimbal.status == LinkStatus.BLUETOOTH_OFF -> "Bluetooth spento"
                gimbal.status == LinkStatus.NOT_FOUND -> "Non trovato: è acceso?"
                gimbal.status == LinkStatus.ERROR || gimbal.status == LinkStatus.DISCONNECTED -> "Non connesso: riprova"
                else -> "Non connesso"
            },
            statusColor = if (gimbalReady) Palette.Live else if (gimbalBusy) Palette.Accent else Palette.TextMuted,
            action = if (gimbalReady || gimbalBusy) "Disconnetti" else "Connetti gimbal",
            primary = !gimbalReady && !gimbalBusy,
            onClick = { if (gimbalReady || gimbalBusy) gimbalVm.ronin.disconnect() else gimbalVm.ronin.connect() },
            modifier = m,
        )
    }
    val cameraCard: @Composable (Modifier) -> Unit = { m ->
        ConnectCard(
            title = "Fotocamera α6000",
            subtitle = "Facoltativa: Live View e miniature (Smart Remote attivo)",
            status = when {
                camReady -> "Connessa"
                camBusy -> "Connessione…"
                cam.status == CameraLink.ERROR -> "Non connessa: riprova"
                else -> "Non connessa"
            },
            statusColor = if (camReady) Palette.Live else if (camBusy) Palette.Accent else Palette.TextMuted,
            action = if (camReady || camBusy) "Disconnetti" else "Connetti fotocamera",
            primary = !camReady && !camBusy,
            onClick = { if (camReady || camBusy) cameraVm.camera.disconnect() else connectCamera() },
            modifier = m,
        )
    }

    BoxWithConstraints(Modifier.fillMaxSize().padding(16.dp)) {
        val portrait = maxHeight > maxWidth
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Gimbali", color = Palette.Text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                topActions(emptyList())
            }
            if (portrait) {
                // Verticale: schede una sotto l'altra, REGIA tondo al centro dello spazio libero
                Spacer(Modifier.height(16.dp))
                gimbalCard(Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
                cameraCard(Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
                SetupMenuButton(onSetup, Modifier.fillMaxWidth())
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    RegiaRoundButton(size = 168.dp, onClick = onRegia)
                }
            } else {
                Spacer(Modifier.weight(1f))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    gimbalCard(Modifier.weight(1f))
                    cameraCard(Modifier.weight(1f))
                    RegiaRoundButton(size = 150.dp, onClick = onRegia)
                }
                Spacer(Modifier.height(12.dp))
                SetupMenuButton(onSetup, Modifier.fillMaxWidth())
                Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** "Bilanciamento / Calibrazione": un tocco apre il menu con le quattro procedure guidate. */
@Composable
private fun SetupMenuButton(onSetup: (SetupKind) -> Unit, modifier: Modifier) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, Palette.Border, RoundedCornerShape(12.dp))
                .clickable(role = Role.Button) { open = true }
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Bilanciamento / Calibrazione", color = Palette.Text, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Text("▾", color = Palette.Text, fontSize = 15.sp)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            SetupKind.entries.forEachIndexed { i, kind ->
                DropdownMenuItem(
                    text = { Text("${i + 1}. ${kind.title}") },
                    onClick = { open = false; onSetup(kind) },
                )
            }
        }
    }
}

/** Pulsante REGIA tondo (richiesta utente: più piccolo e tondo, non a tutta larghezza). */
@Composable
private fun RegiaRoundButton(size: Dp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Palette.Accent)
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text("REGIA", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp)
    }
}

@Composable
private fun ConnectCard(
    title: String,
    subtitle: String,
    status: String,
    statusColor: Color,
    action: String,
    primary: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Palette.Panel)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, color = Palette.Text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        Text(subtitle, color = Palette.TextMuted, fontSize = 12.sp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(statusColor))
            Spacer(Modifier.width(8.dp))
            Text(status, color = statusColor, fontSize = 13.sp)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .clip(RoundedCornerShape(10.dp))
                .then(if (primary) Modifier.background(Palette.Accent) else Modifier.border(1.dp, Palette.Border, RoundedCornerShape(10.dp)))
                .clickable(role = Role.Button, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Text(action, color = if (primary) Color.White else Palette.Text, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }
    }
}
