# LuxStage v1.1 — Architektur-Konzept

Stand: 2026-03-14

## Kernprinzipien

- **Daten als Dateien** — keine opake Datenbank, alles lesbar und portabel
- **Maximale Schlankheit** — so wenig Dependencies wie möglich
- **Raspberry Pi im Technikkoffer** — alle Dateien liegen direkt auf dem Pi, kein SMB/WebDAV
- **Backup als Funktion** — ZIP-Download aller Shows + Templates auf Knopfdruck

---

## Dateistruktur (Ziel)

```
/LuxStage-Daten/                  ← Ordner auf dem Pi, nur über den Server zugänglich
  shows/
    norden.md                     ← Metadaten (YAML frontmatter) + Aufbau-Text
    norden.channels.csv           ← Kanaldaten, Semikolon-getrennt
    norden/
      foto-01.jpg                 ← Fotos als Binärdateien
  templates/
    theater-magdeburg-k1.csv      ← Venue-Templates (wie heute)
```

### Show-Datei (.md)
```yaml
---
name: Norden
venue: Kammer 1
datum: 2025-09-10
---
## Aufbau
Freitext mit Live-Preview-Markdown...
## Felder
| Feld | Wert |
...
```

### Kanal-Datei (.channels.csv)
```
channel;device;color;address;category;position;notes
101;1,2kW Profil;201;1/1;Brücke;Brücke;Ecke LKS
```

---

## Tech-Stack v1.1

### Server (Raspberry Pi)
- **Kleiner Node.js- oder Go-Server** (~100 Zeilen) — liest/schreibt Dateien, stellt REST-API bereit
- **Kein PocketBase** — fällt weg
- Authentifizierung: einfaches shared secret / HTTP Basic Auth reicht
- Realtime: Server-Sent Events (SSE) statt PocketBase-Subscriptions — 20 Zeilen Code

### Web-App (Browser)
- **Framework offen** — Vue.js behalten oder zu Vanilla JS / Preact wechseln (TBD)
- **Editor**: EasyMDE oder CodeMirror — Live-Preview-Markdown, keine WYSIWYG-Toolbar nötig
- **Kein Tiptap / ProseMirror** — entfällt komplett (~480KB Bundle-Einsparung)
- **Kein vue-i18n** — einfaches `useLocale()` Composable (20 Zeilen)
- CSS: bleibt plain CSS

### iOS-App (SwiftUI)
- **OSC bleibt** — Key Feature, unverändert
- Direkter HTTP-Zugriff auf den neuen schlanken Server
- **Offline**: einfaches Caching beim Öffnen — Show lokal speichern, bei Reconnect sync
- **Kein SwiftData / SyncEngine** — entfällt wenn Offline "nice to have" reicht
- Markdown-Rendering: bereits vorhanden (`HTMLTextView.swift`)

---

## Was wegfällt

| Komponente | Grund |
|---|---|
| PocketBase | ersetzt durch einfachen Datei-Server |
| Tiptap + ProseMirror | ersetzt durch EasyMDE / CodeMirror |
| vue-i18n | ersetzt durch 20-Zeilen Composable |
| SwiftData + SyncEngine | entfällt wenn Offline = nice to have |
| `backup.js` + `csv.js` separat | zusammenführen zu `io.js` |

---

## Offene Entscheidungen

- [x] **Web-Framework**: Vue.js behalten — Team kennt es, Einsparung kommt durch Dependency-Reduktion
- [x] **Server-Sprache**: Node.js — kein Kompilieren, npm bereits vorhanden
- [x] **Authentifizierung**: Zwei Rollen — Admin (alles) + Techniker (Shows lesen/bearbeiten, keine Templates/Backup/Update). Token-Login → JWT → localStorage.
- [x] **Offline iOS**: "Nice to have" — einfaches Caching, kein vollständiges Sync nötig
- [x] **File-Locking**: `norden.lock`-Datei beim Öffnen im Edit-Modus, auto-Ablauf nach 10 Min Inaktivität
- [x] **iOS-App**: Nicht neu bauen — API-Client anpassen, OSC unverändert, SwiftData/SyncEngine entfällt
- [x] **Realtime**: SSE (Server-Sent Events) für Kanal-Updates — ~20 Zeilen Node.js, kein Overhead
- [x] **Foto-Komprimierung**: Server-seitig (schont Browser + iPad)
- [x] **Mehrere Spielstätten**: Pro Theater mehrere Templates möglich, je eine CSV pro Spielstätte
- [x] **Archivierung**: Archiv-Ordner `/shows/archiv/` auf dem Pi, kein Löschen nötig
- [x] **Updates**: Update-Funktion in der Web-App (Admin only) — `git pull` + Neustart auf dem Pi
- [x] **Web-App ist Dreh- und Angelpunkt** — iOS/iPhone ist Lese- und Einleuchtwerkzeug

---

## Features

- Suchfunktion über Shows und Kanäle
- Show duplizieren ("Als Vorlage verwenden") — entfällt (nicht benötigt)
- QR-Code für iPad-Verbindung — entfällt (nicht benötigt)
- Pi-Status in Web-App (Festplattenplatz, letzte Backup-Zeit, Server-Version)
- Onboarding beim ersten Start (keine Shows → direkt zum Template-Upload)
- Atomares Schreiben (tmp → rename, kein Datenverlust bei Absturz)
- Versionierung: letzte 5 Versionen einer Show-Datei als Backup behalten
- Hängerei: eigene Markdown-Sektion im Aufbau-Feld — theaterindividuell, kein fixes Schema
- iOS/iPhone: Kanal-Schnellsuche mit Numpad-Tastatur, große Ziffern
- iOS/iPhone: temporäres "eingebaut ✓" pro Kanal — nur für aktuelle Session, nicht gespeichert
- Duplikat-Warnung bei gleicher DMX-Adresse
- Server-seitiger PDF-Export (Puppeteer oder PDFKit) — funktioniert auch vom iPhone

## Weitere Entscheidungen

- [x] **Fotos**: Wenige pro Show (5–20) — Komprimierung wie heute reicht
- [x] **Templates**: Liegen als CSV direkt auf dem Pi in `/templates/`, aber editierbar über die Web-App
- [x] **Checklist**: Bleibt als eigene Sektion pro Show
- [x] **PDF-Export**: Gleiches Layout wie bisheriger Word-Plan — Kanäle nach Position gruppiert, mit Abschnitts-Überschriften. Ersetzt Word-Workflow vollständig.
- [x] **Setup**: Interaktives `setup.sh`-Script für den Pi — fragt nach Passwort und Theaternamen, richtet alles ein. Ziel: LuxStage auch anderen Theatern anbieten.

## Vorgehen

1. Git-Branch `v1.1` vom aktuellen `main`
2. Server zuerst (Node.js, Dateisystem-API, Auth, Lock, Backup-ZIP)
3. `setup.sh` für Pi-Einrichtung
4. Web-App migrieren (Vue.js, EasyMDE statt Tiptap, eigenes i18n)
5. iOS-App anpassen (neuer API-Client, SwiftData/SyncEngine raus)
