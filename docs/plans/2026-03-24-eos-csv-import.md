# Eos CSV Import — Kanalmarkierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beleuchter kann eine Eos `START_LEVELS`-CSV hochladen; aktive Kanäle werden in der Kanalliste mit einer grünen/roten Pill markiert, die manuell umschaltbar ist.

**Architecture:** Server erhält neue `eos_active_channels TEXT`-Spalte in `shows` (JSON-Array mit positivem/negativem Vorzeichen). Router leitet das Feld in GET/PUT durch. Im Browser parst eine reine JS-Funktion die CSV und extrahiert aktive Kanäle. Die Pill-Komponente ist inline in `ShowDetailView.vue`. Fehlermeldungen nutzen `window.alert()` da kein dediziertes Toast-System existiert.

**Tech Stack:** Node.js ESM, better-sqlite3, Vue 3 Composition API, Tailwind CSS, useConfirm-Composable mit `{ t, titleKey, messageKey, messageParams, confirmKey, cancelKey }`-Signatur

---

## Wichtige Konventionen (vor Beginn lesen)

**`useConfirm`-Signatur** (aus `web-app/src/composables/useConfirm.js`):
```js
const ok = await confirm({
  t,                          // Pflicht: i18n-Funktion
  titleKey: 'some.key',       // i18n-Key für Titel
  messageKey: 'some.key',     // i18n-Key für Text (optional — wenn weggelassen, kein Text)
  messageParams: { n: 3 },    // Platzhalter für messageKey/titleKey
  confirmKey: 'action.delete',// i18n-Key für Bestätigen-Button
  cancelKey: 'action.cancel', // i18n-Key für Abbrechen-Button
})
```

**Fehlermeldungen:** Es gibt kein Toast-System. Fehler werden mit `window.alert(nachricht)` angezeigt — konform mit dem restlichen Code wo kein besseres System existiert.

**i18n-Keys** werden in `shared/locales/de.json` und `shared/locales/en.json` eingetragen.

---

## Dateiübersicht

| Datei | Änderung |
|---|---|
| `server/db-init.js` | Neue Spalte `eos_active_channels TEXT` + ALTER TABLE Guard |
| `server/db.js` | `eos_active_channels` in `writeShow` erlauben |
| `server/router.js` | GET Show: Feld mitsenden; PUT Meta: Feld mappen |
| `shared/locales/de.json` | Neue i18n-Keys für Eos-Import |
| `shared/locales/en.json` | Neue i18n-Keys (englisch) |
| `web-app/src/views/ShowDetailView.vue` | Import-Button, CSV-Parser, Pill-Badge, Toggle, Re-Import-Dialog |

---

## Task 1: DB — Spalte `eos_active_channels` hinzufügen

**Files:**
- Modify: `server/db-init.js`
- Modify: `server/db.js`

- [ ] **Step 1: `eos_active_channels TEXT` in CREATE TABLE eintragen**

In `server/db-init.js`, im `db.exec(...)` Block, in der `CREATE TABLE IF NOT EXISTS shows`-Anweisung diese Zeile:
```js
    setup_markdown TEXT,
    archived       INTEGER NOT NULL DEFAULT 0,
```
ersetzen durch:
```js
    setup_markdown TEXT,
    eos_active_channels TEXT,
    archived       INTEGER NOT NULL DEFAULT 0,
```

- [ ] **Step 2: ALTER TABLE Guard für bestehende Installationen**

In `server/db-init.js` nach dem gesamten `db.exec(...)` Block (nach der schließenden Backtick-Klammer) einfügen:

```js
// Spalte nachträglich hinzufügen falls noch nicht vorhanden (bestehende DBs)
const showCols = db.pragma('table_info(shows)').map(c => c.name)
if (!showCols.includes('eos_active_channels')) {
  db.exec('ALTER TABLE shows ADD COLUMN eos_active_channels TEXT')
}
```

- [ ] **Step 3: Feld in `writeShow` erlauben**

In `server/db.js` Zeile 25 — `allowed`-Array erweitern. Vorher:
```js
const allowed = ['name', 'datum', 'template', 'untertitel', 'spielzeit', 'setup_markdown']
```
Nachher:
```js
const allowed = ['name', 'datum', 'template', 'untertitel', 'spielzeit', 'setup_markdown', 'eos_active_channels']
```

- [ ] **Step 4: Server starten und Spalte prüfen**

```bash
# ESM-Modul — --input-type=module verwenden
node --input-type=module -e "
import { db } from './server/db-init.js'
const cols = db.pragma('table_info(shows)').map(c => c.name)
console.log(cols.includes('eos_active_channels') ? '✓ OK' : '✗ FEHLT')
"
```

Erwartete Ausgabe: `✓ OK`

- [ ] **Step 5: Commit**

```bash
git add server/db-init.js server/db.js
git commit -m "feat(db): add eos_active_channels column to shows table"
```

---

## Task 2: Router — Feld in GET und PUT durchreichen

**Files:**
- Modify: `server/router.js` (Zeilen ~56–90)

- [ ] **Step 1: GET `/api/shows/:slug` — Feld mitsenden**

Im GET-Handler, im `return json(res, 200, { ... })` Block, nach `setupMarkdown: show.setup_markdown ?? '',` eine neue Zeile einfügen:

```js
eosActiveChannels: show.eos_active_channels ? JSON.parse(show.eos_active_channels) : null,
```

Das vollständige Objekt sieht dann so aus:
```js
return json(res, 200, {
  id: show.slug,
  name: show.name,
  datum: show.datum,
  template: show.template,
  untertitel: show.untertitel,
  spielzeit: show.spielzeit,
  setupMarkdown: show.setup_markdown ?? '',
  eosActiveChannels: show.eos_active_channels ? JSON.parse(show.eos_active_channels) : null,  // neu
  channels,
  lock,
})
```

- [ ] **Step 2: PUT `/api/shows/:slug/meta` — Feld mappen**

Im PUT-Handler — die bestehende Zeile lautet:
```js
const { setupMarkdown, ...rest } = JSON.parse(body)
```
Diese Zeile ersetzen durch:
```js
const { setupMarkdown, eosActiveChannels, ...rest } = JSON.parse(body)
```

Danach, nach der bestehenden Zeile `if (setupMarkdown !== undefined) fields.setup_markdown = setupMarkdown`, folgende neue Zeile einfügen:
```js
if (eosActiveChannels !== undefined) fields.eos_active_channels = JSON.stringify(eosActiveChannels)
```

- [ ] **Step 3: Manuell testen — Server neustarten, GET einer Show aufrufen**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<passwort>"}' | jq -r .token)

curl -s http://localhost:3000/api/shows/hoelle-2026 \
  -H "Authorization: Bearer $TOKEN" | jq '.eosActiveChannels'
```

Erwartete Ausgabe: `null` (noch kein Import).

- [ ] **Step 4: Commit**

```bash
git add server/router.js
git commit -m "feat(router): pass eosActiveChannels through GET and PUT meta"
```

---

## Task 3: i18n-Keys hinzufügen

**Files:**
- Modify: `shared/locales/de.json`
- Modify: `shared/locales/en.json`

- [ ] **Step 1: Deutsche Keys eintragen**

In `shared/locales/de.json` folgende Keys ergänzen (z.B. nach den `csv.*`-Keys):

```json
"eos.import.button": "⬆ Aus Eos importieren",
"eos.import.error.invalid": "Keine gültige Eos-Exportdatei.",
"eos.import.error.parse": "Datei konnte nicht gelesen werden.",
"eos.import.confirm_empty.title": "0 aktive Kanäle",
"eos.import.confirm_empty.message": "Keine aktiven Kanäle gefunden. Trotzdem importieren?",
"eos.import.confirm_empty.confirm": "Importieren",
"eos.reimport.title": "{n} Kanäle nicht mehr aktiv",
"eos.reimport.message": "Folgende Kanäle spielen in der neuen Version nicht mehr mit: {channels}. Trotzdem importieren?",
"eos.reimport.confirm": "Importieren",
"eos.status.active": "● aktiv",
"eos.status.inactive": "● inaktiv"
```

- [ ] **Step 2: Englische Keys eintragen**

In `shared/locales/en.json` die gleichen Keys auf Englisch:

```json
"eos.import.button": "⬆ Import from Eos",
"eos.import.error.invalid": "Not a valid Eos export file.",
"eos.import.error.parse": "Could not read file.",
"eos.import.confirm_empty.title": "0 active channels",
"eos.import.confirm_empty.message": "No active channels found. Import anyway?",
"eos.import.confirm_empty.confirm": "Import",
"eos.reimport.title": "{n} channels no longer active",
"eos.reimport.message": "The following channels are no longer active: {channels}. Import anyway?",
"eos.reimport.confirm": "Import",
```

```json
"eos.status.active": "● active",
"eos.status.inactive": "● inactive"
```

- [ ] **Step 3: Commit**

```bash
git add shared/locales/de.json shared/locales/en.json
git commit -m "feat(i18n): add eos import keys"
```

---

## Task 4: WebApp — CSV-Parser + State + Import-Button

**Files:**
- Modify: `web-app/src/views/ShowDetailView.vue`

- [ ] **Step 1: `eosActiveChannels` State anlegen**

Im `<script setup>` nach `const setupMarkdown = ref('')` einfügen:

```js
const eosActiveChannels = ref(null) // null = noch kein Import; Array<string> (neg. Prefix = inaktiv)
```

- [ ] **Step 2: State beim Laden befüllen**

In der Funktion wo `meta.value` und `setupMarkdown.value` aus `showData` gesetzt werden (Zeile ~854), ergänzen:

```js
eosActiveChannels.value = showData.eosActiveChannels ?? null
```

- [ ] **Step 3: `persistEosChannels` Funktion**

Nach der `persistSetup`-Funktion einfügen:

```js
async function persistEosChannels() {
  await updateMeta(props.id, { ...meta.value, setupMarkdown: setupMarkdown.value, eosActiveChannels: eosActiveChannels.value })
}
```

- [ ] **Step 4: CSV-Parser Funktion**

Nach den Imports und vor dem State-Block einfügen:

```js
// ── Eos CSV Parser ─────────────────────────────────────────────────────────
function parseEosCsv(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== 'START_LEVELS') {
    return { activeChannels: null, error: 'eos.import.error.invalid' }
  }
  const headerIdx = lines.findIndex(l => l.startsWith('TARGET_TYPE,'))
  if (headerIdx === -1) return { activeChannels: null, error: 'eos.import.error.parse' }
  const headers = lines[headerIdx].split(',')
  const colChannel  = headers.indexOf('CHANNEL')
  const colParamType = headers.indexOf('PARAMETER_TYPE_AS_TEXT')
  const colLevel    = headers.indexOf('LEVEL')
  if (colChannel === -1 || colParamType === -1 || colLevel === -1) {
    return { activeChannels: null, error: 'eos.import.error.parse' }
  }
  const active = new Set()
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols[colParamType] === 'Intens' && parseFloat(cols[colLevel]) > 0) {
      const ch = (cols[colChannel] ?? '').trim()
      if (ch) active.add(ch)
    }
  }
  return { activeChannels: [...active], error: null }
}
```

- [ ] **Step 5: Import-Button + hidden file input ins Template**

Im Template, nach dem bestehenden Export-Button (nach `{{ t('channel.export') }}</button>`), einfügen:

```html
<button
  type="button"
  class="rounded-md px-3 py-1.5 text-sm font-semibold text-amber-400 ring-1 ring-amber-400/30 hover:ring-amber-400/60 no-print"
  @click="eosFileInput?.click()"
>
  {{ t('eos.import.button') }}
</button>
<input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="onEosFileSelected" />
```

- [ ] **Step 6: `eosFileInput` ref anlegen**

Im Script-Block bei den anderen template refs:

```js
const eosFileInput = ref(null)
```

- [ ] **Step 7: Commit**

```bash
git add web-app/src/views/ShowDetailView.vue
git commit -m "feat(webapp): add eos CSV parser, state, and import button"
```

---

## Task 5: WebApp — Import-Logik + Re-Import-Dialog

**Files:**
- Modify: `web-app/src/views/ShowDetailView.vue`

- [ ] **Step 1: `onEosFileSelected` Handler schreiben**

```js
async function onEosFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = '' // Reset: dieselbe Datei kann erneut gewählt werden

  const text = await file.text()
  const { activeChannels, error } = parseEosCsv(text)

  if (error) {
    window.alert(t(error))
    return
  }

  // Warnung bei 0 aktiven Kanälen
  if (activeChannels.length === 0) {
    const ok = await confirm({
      t,
      titleKey: 'eos.import.confirm_empty.title',
      messageKey: 'eos.import.confirm_empty.message',
      confirmKey: 'eos.import.confirm_empty.confirm',
      cancelKey: 'action.cancel',
    })
    if (!ok) return
  }

  // Re-Import: prüfe ob bisher aktive Kanäle wegfallen
  if (eosActiveChannels.value !== null) {
    const currentActive = eosActiveChannels.value.filter(ch => !ch.startsWith('-'))
    const removed = currentActive.filter(ch => !activeChannels.includes(ch))
    if (removed.length > 0) {
      const ok = await confirm({
        t,
        titleKey: 'eos.reimport.title',
        messageKey: 'eos.reimport.message',
        messageParams: {
          n: removed.length,
          channels: removed.join(', '),
        },
        confirmKey: 'eos.reimport.confirm',
        cancelKey: 'action.cancel',
      })
      if (!ok) return
    }
  }

  // Import durchführen.
  // Regel (Spec §3): Import ist autoritativ — überschreibt manuelle Overrides.
  // Kanäle im neuen CSV            → immer aktiv (grün), egal ob vorher manuell rot.
  // Kanäle vorher grün, jetzt weg  → werden rot (spec: "weggefallene Kanäle werden rot").
  // Kanäle vorher manuell rot, jetzt weg → bleiben rot.
  // Kanäle vorher manuell rot, jetzt im CSV → werden grün (import wins).
  const prev = eosActiveChannels.value ?? []
  const prevActive   = prev.filter(ch => !ch.startsWith('-'))
  const prevInactive = prev.filter(ch => ch.startsWith('-')).map(ch => ch.slice(1))

  // Kanäle die vorher aktiv oder inaktiv waren, aber nicht im neuen CSV → rot
  const nowGone = [...prevActive, ...prevInactive].filter(ch => !activeChannels.includes(ch))

  eosActiveChannels.value = [
    ...activeChannels,                   // alle neuen: grün
    ...nowGone.map(ch => `-${ch}`),      // weggefallene: rot
  ]
  await persistEosChannels()
}
```

- [ ] **Step 2: Manuell testen — `docs/Hölle.csv` importieren**

1. Server starten (`pm2 restart luxstage` oder lokal `node index.js`)
2. Show "Hölle" in WebApp öffnen
3. "Aus Eos importieren" klicken, `Hölle.csv` wählen
4. Kein Fehler-Dialog erscheint
5. In DevTools → Network → PUT `/api/shows/hoelle-2026/meta`: Body enthält `"eosActiveChannels": ["5","6","103",...]` mit 119 Einträgen
6. Nach Page-Reload: `eosActiveChannels` immer noch befüllt (Persistenz prüfen)

- [ ] **Step 3: Commit**

```bash
git add web-app/src/views/ShowDetailView.vue
git commit -m "feat(webapp): implement Eos CSV import logic with re-import dialog"
```

---

## Task 6: WebApp — Pill-Badge in der Kanalliste

**Files:**
- Modify: `web-app/src/views/ShowDetailView.vue`

- [ ] **Step 1: Helper-Funktion `eosStatus`**

Im Script-Block, nach `eosActiveChannels`:

```js
function eosStatus(channelNr) {
  if (!eosActiveChannels.value) return null
  const nr = String(channelNr)
  if (eosActiveChannels.value.includes(nr)) return 'active'
  if (eosActiveChannels.value.includes(`-${nr}`)) return 'inactive'
  return null
}
```

- [ ] **Step 2: `toggleEosStatus` Handler**

```js
async function toggleEosStatus(channelNr) {
  if (!eosActiveChannels.value) return
  const nr = String(channelNr)
  eosActiveChannels.value = eosActiveChannels.value.map(ch => {
    if (ch === nr) return `-${nr}`          // aktiv → inaktiv
    if (ch === `-${nr}`) return nr          // inaktiv → aktiv
    return ch
  })
  await persistEosChannels()
}
```

- [ ] **Step 3: Pill-Button im Template einfügen**

In der Kanal-Zeile (Zeile ~166) — nach dem `<input>` mit der Kanalnummer (dem `text-2xl font-bold font-mono`-Input), vor dem Adress-Input, einfügen:

```html
<button
  v-if="eosStatus(ch.channel) !== null"
  type="button"
  @click.stop="toggleEosStatus(ch.channel)"
  :class="eosStatus(ch.channel) === 'active'
    ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30'
    : 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'"
  class="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-colors no-print"
>
  {{ t(eosStatus(ch.channel) === 'active' ? 'eos.status.active' : 'eos.status.inactive') }}
</button>
```

- [ ] **Step 4: Manuell testen**

1. Show mit importierten Eos-Daten öffnen
2. Aktive Kanäle zeigen grüne Pill "● aktiv"
3. Inaktive (rote) Kanäle zeigen "● inaktiv"
4. Kanäle ohne Import-Status zeigen keine Pill
5. Klick grün → wird rot, Klick rot → wird grün
6. Nach Page-Reload: geänderter Status ist erhalten

- [ ] **Step 5: Commit**

```bash
git add web-app/src/views/ShowDetailView.vue
git commit -m "feat(webapp): add eos pill badge with toggle in channel list"
```

---

## Task 7: Build + Deploy auf Pi

**Files:**
- `web-app/dist/` (gebaut)

- [ ] **Step 1: Production Build**

```bash
cd web-app
npm run build 2>&1 | tail -10
```

Erwartung: `✓ built in Xs` ohne Fehler oder Warnungen (außer dem bekannten chunk-size Hinweis).

- [ ] **Step 2: Auf Pi deployen**

```bash
rsync -av --delete \
  "/Users/christopher/Library/Mobile Documents/com~apple~CloudDocs/1. Christopher/Basteleien/LuxStage-Projekt/LuxStage/web-app/dist/" \
  christopher@luxstage.local:/home/christopher/LuxStage/web-app/dist/

ssh christopher@luxstage.local "source ~/.nvm/nvm.sh && pm2 restart luxstage"
```

- [ ] **Step 3: Server-Dateien auf Pi aktualisieren**

```bash
rsync -av \
  "/Users/christopher/Library/Mobile Documents/com~apple~CloudDocs/1. Christopher/Basteleien/LuxStage-Projekt/LuxStage/server/db-init.js" \
  "/Users/christopher/Library/Mobile Documents/com~apple~CloudDocs/1. Christopher/Basteleien/LuxStage-Projekt/LuxStage/server/db.js" \
  "/Users/christopher/Library/Mobile Documents/com~apple~CloudDocs/1. Christopher/Basteleien/LuxStage-Projekt/LuxStage/server/router.js" \
  christopher@luxstage.local:/home/christopher/LuxStage/server/

ssh christopher@luxstage.local "source ~/.nvm/nvm.sh && pm2 restart luxstage"
```

- [ ] **Step 4: Auf Pi testen**

1. `http://luxstage.local:3000` öffnen
2. `http://luxstage.local:3000/api/health` → `{"ok":true}`
3. Show öffnen, CSV importieren, Pills erscheinen
4. Toggle funktioniert, Reload erhält Status

- [ ] **Step 5: Push**

```bash
git push origin main
```
