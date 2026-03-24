# Eos CSV Import — Kanalmarkierung Design Spec

## Ziel

Beleuchter exportiert aus ETC Eos eine `START_LEVELS`-CSV (`File → Export → Levels as CSV`). LuxStage importiert diese Datei und markiert in der Kanalliste welche Kanäle in der Show aktiv sind. So sieht man auf einen Blick welche Kanäle Notizen brauchen.

## CSV-Format (Eos Export)

```
START_LEVELS
TARGET_TYPE,TARGET_TYPE_AS_TEXT,TARGET_LIST_NUMBER,TARGET_ID,...,CHANNEL,PARAMETER_TYPE_AS_TEXT,LEVEL,...
1,Cue,1,1,,5,Intens,100.0000,...
1,Cue,1,1,,103,Intens,55.3000,...
```

Ein Kanal gilt als **aktiv**, wenn er in mindestens einem Cue als `PARAMETER_TYPE_AS_TEXT = Intens` mit `LEVEL > 0` vorkommt. Kanalwerte werden als Strings verglichen (wie in der bestehenden `channels`-Tabelle).

**Validierung beim Import:**
- Erste Zeile muss `START_LEVELS` sein → sonst Fehlermeldung: „Keine gültige Eos-Exportdatei."
- Keine Zeilen mit `Intens > 0` gefunden → Warnung: „0 aktive Kanäle gefunden. Trotzdem importieren?"
- CSV strukturell fehlerhaft (fehlende Spalten) → Fehlermeldung: „Datei konnte nicht gelesen werden."
- Alle Fehler werden als Toast-Nachricht (bestehender Alert-Mechanismus) angezeigt.

## UI-Komponenten

### 1. Import-Button (Toolbar)

Neben dem bestehenden "Export CSV"-Button erscheint ein zweiter Button **"Aus Eos importieren"**.

- Öffnet einen nativen Datei-Dialog (`.csv` Filter)
- Verarbeitung vollständig im Browser (kein Server-Upload nötig)
- Parst die CSV und extrahiert alle aktiven Kanal-Nummern

### 2. Pill-Badge in der Kanalliste

Jede Zeile mit einem bekannten Status zeigt eine kleine Kapsel (Pill) direkt rechts neben der Kanalnummer. Die Pill ist ein **klickbarer Toggle-Button**.

| Zustand | Pill | Bedeutung |
|---|---|---|
| Aktiv im letzten Import | grün, Text "● aktiv" | Kanal spielt in der Show mit |
| Manuell oder per Import inaktiv | rot, Text "● inaktiv" | Kanal spielt nicht mit |
| Noch kein Import | keine Pill | Kanal wurde noch nie vom Pult eingelesen |

**Toggle-Verhalten:** Klick auf die Pill wechselt zwischen grün ("aktiv") und rot ("inaktiv") — manuell, ohne neuen Import.

### 3. Re-Import-Verhalten

**Nur Hinzufügungen (kein Kanal fällt weg):** Direkt importieren, kein Dialog.

**Kanäle fallen weg:** Dialog erscheint:
> „3 Kanäle spielen in der neuen Version nicht mehr mit: **5, 12, 47**. Trotzdem importieren?"
- Bei Bestätigung: weggefallene Kanäle werden rot, neue Kanäle werden grün
- Bei Abbruch: nichts ändert sich

**Verhalten bei manuellen Overrides beim Re-Import:**
Ein Kanal der manuell auf rot gesetzt wurde (`"-103"`), wird beim Re-Import **durch den Import überschrieben**:
- Ist er im neuen CSV: wird grün (`"103"`)
- Ist er nicht im neuen CSV: bleibt rot (`"-103"`)

Import-Daten haben Vorrang vor manuellen Korrekturen. Begründung: ein neuer Import ist eine explizite Aktion des Beleuchters und gilt als autoritativ.

## Datenhaltung

`eos_active_channels` wird als JSON-Array in der `shows`-Tabelle gespeichert (nullable TEXT-Spalte).

```json
["5", "6", "103", "108", "136"]
```

Ein negatives Vorzeichen (`"-103"`) bedeutet: Kanal war importiert oder manuell gesetzt, ist aber aktuell inaktiv.

```json
["5", "6", "-103", "108", "136"]
```

Kanäle ohne Eintrag in diesem Array haben keine Pill (noch kein Import).

## Dateien die sich ändern

**Server:**
- `server/db-init.js` — `eos_active_channels TEXT` Spalte in `shows`-Tabelle (nullable). Zusätzlich: `ALTER TABLE shows ADD COLUMN eos_active_channels TEXT` mit Existenzprüfung für laufende Installationen.
- `server/db.js` — `eos_active_channels` in `writeShow` erlauben
- `server/router.js` — GET `/api/shows/:slug`: `eosActiveChannels` aus `eos_active_channels` parsen und mitsenden. PUT `/api/shows/:slug/meta`: `eosActiveChannels` → `eos_active_channels` mappen.

**WebApp:**
- `web-app/src/api/shows.js` — `updateMeta` sendet `eosActiveChannels` mit
- `web-app/src/views/ShowDetailView.vue`:
  - Import-Button + CSV-Parser + Validierung
  - Pill-Badge als klickbarer Toggle in der Kanal-Zeile
  - Re-Import-Dialog (nutzt bestehenden `useConfirm`)
  - Toggle-Handler + `persistMeta`-Aufruf nach Änderung

## Was explizit nicht implementiert wird

- Kein iOS-Support (nur WebApp)
- Keine Anzeige der Intensitätswerte (nur aktiv/nicht aktiv)
- Kein automatischer Import via OSC/TCP — immer manueller Datei-Upload
- Keine Filterung nach aktiven Kanälen — alle Kanäle bleiben in der Liste sichtbar
- Keine Prüfung ob die CSV zur richtigen Show gehört
