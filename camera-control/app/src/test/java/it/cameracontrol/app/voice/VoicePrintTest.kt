package it.cameracontrol.app.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoicePrintTest {
    @Test
    fun cosineBasics() {
        assertEquals(1f, VoicePrint.cosine(floatArrayOf(1f, 2f), floatArrayOf(2f, 4f)), 1e-5f)
        assertEquals(0f, VoicePrint.cosine(floatArrayOf(1f, 0f), floatArrayOf(0f, 3f)), 1e-5f)
        assertEquals(0f, VoicePrint.cosine(floatArrayOf(0f, 0f), floatArrayOf(1f, 1f)), 1e-5f)
    }

    @Test
    fun averageIsNormalizedMean() {
        val avg = VoicePrint.average(listOf(floatArrayOf(10f, 0f), floatArrayOf(0f, 1f)))
        assertEquals(0.7071f, avg[0], 1e-3f)
        assertEquals(0.7071f, avg[1], 1e-3f)
    }

    private fun s(marta: Float, giulia: Float) = mapOf("m" to marta, "g" to giulia)

    @Test
    fun switchesOnlyAfterTwoConfidentWindows() {
        val d = VoiceDirector()
        assertNull(d.update(true, s(0.7f, 0.2f)))
        assertEquals("m", d.update(true, s(0.7f, 0.2f)))
        assertEquals("m", d.update(true, s(0.2f, 0.7f)))      // una sola finestra di Giulia: resta su Marta
        assertEquals("g", d.update(true, s(0.2f, 0.7f)))
    }

    @Test
    fun silenceKeepsLastSpeaker() {
        val d = VoiceDirector()
        d.update(true, s(0.7f, 0.1f)); d.update(true, s(0.7f, 0.1f))
        assertEquals("m", d.update(false, emptyMap()))
        assertEquals("m", d.update(false, emptyMap()))
    }

    @Test
    fun overlapKeepsPreviousSpeaker() {
        val d = VoiceDirector()
        d.update(true, s(0.7f, 0.1f)); d.update(true, s(0.7f, 0.1f))
        // voci sovrapposte: punteggi vicini → incerto
        assertEquals("m", d.update(true, s(0.52f, 0.50f)))
        assertEquals("m", d.update(true, s(0.50f, 0.53f)))
    }

    @Test
    fun uncertainWindowBreaksTheStreak() {
        val d = VoiceDirector()
        d.update(true, s(0.7f, 0.1f)); d.update(true, s(0.7f, 0.1f))
        d.update(true, s(0.2f, 0.7f))                          // Giulia 1
        d.update(true, s(0.5f, 0.5f))                          // incerto: si riparte da zero
        assertEquals("m", d.update(true, s(0.2f, 0.7f)))      // Giulia di nuovo 1
        assertEquals("g", d.update(true, s(0.2f, 0.7f)))
    }

    @Test
    fun belowThresholdIsUncertain() {
        val d = VoiceDirector(threshold = 0.4f)
        assertNull(d.confident(s(0.35f, 0.1f)))
        assertEquals("m", d.confident(s(0.45f, 0.1f)))
    }
}
