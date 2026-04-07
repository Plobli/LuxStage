// LuxStage/server/ocr.js
import Anthropic from '@anthropic-ai/sdk'
import { config } from './config.js'

const PROMPT = `Du bist ein Assistent für Theatertechnik. Dieses Bild zeigt einen handausgefüllten oder gedruckten Leuchtplan / Showplan aus dem Theaterbereich.

Extrahiere alle lesbaren Informationen und gib ein JSON-Objekt mit genau zwei Feldern zurück:

1. "aufbau": String in Markdown. Enthält alle allgemeinen Angaben außerhalb der Kanal-Tabelle:
   - Stückname / Titel
   - Datum
   - Aufbau-Freitext (z.B. Requisitenaufbau, Bühnenbild-Hinweise)
   - Sonstige Kopf- oder Fußzeilen-Infos (z.B. Seitenzahl)
   Wenn kein solcher Text vorhanden ist, gib einen leeren String zurück.

2. "kanaele": Array aller Zeilen aus der Kanal-Tabelle. Jedes Objekt:
   - "channel": Kanalnummer als Zahl (Spalte "Kreis" oder "Kanal" oder erste Spalte)
   - "color": Farbfilter als String (Spalte "Farbe"), z.B. "w", "20l", "R27" — leer lassen wenn keine Angabe
   - "device": Gerät/Scheinwerfer (Spalte "Gerät"), z.B. "PAR64", "Stufenlinse 1,2 kW"
   - "notes": Handgeschriebene Notizen rechts neben der Zeile oder in einer Notizen-Spalte, exakt so wie lesbar
   - "address": DMX-Adresse falls vorhanden, sonst weglassen
   - "position": Positionsbezeichnung falls vorhanden (z.B. "SD", "MZ1"), sonst weglassen
   Zeilen ohne erkennbare Kanalnummer und ohne Gerät weglassen.

Wichtige Hinweise:
- Handschriftliche Notizen neben einer Tabellenzeile gehören zum "notes"-Feld dieser Zeile.
- Farben wie "w", "20l", "201", "R27" etc. in der Farbe-Spalte exakt übernehmen.
- Leere Felder als leeren String oder weglassen — niemals erfinden.
- Bei mehreren Seiten: alle erkannten Zeilen in ein gemeinsames "kanaele"-Array.

Gib ausschließlich valides JSON zurück, ohne Markdown-Codeblock.`

/**
 * @param {Array<{buffer: Buffer, mimeType: string}>} images — ein oder mehrere Fotos
 * @returns {Promise<{aufbau: string, kanaele: Array}>}
 */
export async function ocrShowplan(images) {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY nicht konfiguriert')
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey })

  // Alle Bilder als content-Blöcke, Prompt am Ende
  const content = [
    ...images.map(({ buffer, mimeType }) => ({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') },
    })),
    { type: 'text', text: PROMPT },
  ]

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  })

  const text = message.content[0].text.trim()

  try {
    return JSON.parse(text)
  } catch {
    const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
    return JSON.parse(cleaned)
  }
}
