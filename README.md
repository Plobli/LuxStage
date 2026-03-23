# LuxStage

Lighting plan management for theatre productions — channel lists, setup notes, focus checklists, and photo documentation.

## Features

- **Shows** — each production has a channel list (CSV), setup notes (Markdown + custom fields), and a photo gallery
- **Sections** — configurable sections per show (Markdown or field grids), displayed in a two-column layout
- **Venues (Templates)** — reusable channel lists and section layouts per venue, imported via CSV
- **Focus mode** — checklist view with OSC toggle per channel (Full/Out via EOS or compatible consoles)
- **PDF export** — printable channel list from the web app
- **Bilingual** — German and English UI, switchable in settings
- **iOS app** — native SwiftUI app with offline support, photo upload, lightbox with pinch-to-zoom, and Markdown rendering

## Project Structure

```
LuxStage/
  ios-app/        Native SwiftUI app (iPhone/iPad) – iOS 18.6+
  web-app/        Vue.js 3 web app (browser, production build served by server)
  server/         Node.js backend (file-based, no database)
  shared/
    locales/      de.json + en.json  (UI strings for both clients)
    filters.json  Rosco/Lee gel filter presets
  data/           Show and template data (git-ignored)
    shows/        One folder per show (show.md, channels.csv, photos/)
    templates/    Venue CSV files + section definitions
```

## Versions

- **Web App**: `1.0 Build 3` (version shown in footer)
- **iOS App**: Build 18

## Installation (Raspberry Pi)

Auf einem frischen **Raspberry Pi OS Lite** per SSH einloggen und ausführen:

```bash
curl -fsSL https://raw.githubusercontent.com/christopherritter/luxstage/main/install.sh | sudo bash
```

Das Script fragt nach:
- **Hostname** (Vorauswahl: `luxstage`) → die App ist danach unter `http://luxstage.local` erreichbar
- **Admin-Passwort** für den Login

Was installiert wird:
- Node.js 18, git, Caddy
- LuxStage-Server als systemd-Service (startet automatisch beim Boot)
- Caddy als Reverse Proxy auf Port 80

Nach der Installation einen Neustart empfohlen: `sudo reboot`

### iOS App einrichten

In der iOS App unter **Einstellungen → Server-URL** eintragen:
```
http://luxstage.local
```

---

## Entwicklung (lokal)

### Server

```bash
cd server
npm install
node index.js
# → http://localhost:3000
```

### Web App (Entwicklung)

```bash
cd web-app
npm install
npm run dev
# → http://localhost:5173 (proxied API auf :3000)
```

### Web App (Produktion)

```bash
cd web-app
npm run build
# Ausgabe wird vom Server automatisch aus web-app/dist/ ausgeliefert
```

### iOS App

`ios-app/LuxStageApp/LuxStageApp.xcodeproj` in Xcode öffnen. Server-URL in den App-Einstellungen setzen.

## Venue Template Format

Templates are semicolon-separated CSV files (UTF-8):

```
channel;address;device;position;color;notes
1;1/001;ETC Source Four;Portal LKS;;;
```

| Column | Description |
|---|---|
| `channel` | Channel number (required) |
| `address` | DMX address, format `universe/address` e.g. `1/042` |
| `device` | Fixture type |
| `position` | Grouping label in focus view |
| `color` | Gel/filter |
| `notes` | Free text, shown in focus view |

Upload templates via the Templates section in the web app. The filename (without `.csv`) becomes the venue display name — e.g. `kammer-1.csv` → **Kammer 1**.

## Section Types

Each show can have multiple configurable sections:

- **Markdown** — free text with headings, bullet lists, checkboxes, bold/italic
- **Fields** — key/value grid (e.g. stage dimensions, rigging positions)

Sections are ordered by drag-and-drop in the web app and rendered as cards in the iOS app.

## OSC

Configure OSC per venue in iOS Settings → *OSC pro Bühne*. Global Full/Out command patterns use `{chan}` as placeholder:

```
/eos/chan/{chan}/full
/eos/chan/{chan}/out
```

In focus mode, each channel row shows a toggle button that sends Full on first tap and Out on second tap.

## iOS App – Markdown Rendering

- `##` → Section title (accent color, bold, rendered as card header)
- `###` → Subheading (uppercase, accent color, kerning, with horizontal rule)
- `- [ ]` / `- [x]` → Interactive checkboxes (persisted per device via UserDefaults)
- `**text**` → Bold, `*text*` → Italic

## Languages

The app supports German and English. Language can be changed in Settings. All internal identifiers (API routes, CSV headers, file names) are English.
