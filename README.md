# LuxStage

Lighting plan management for theatre productions — channel lists, setup notes, focus checklists, and OSC control.

## Features

- **Shows** — each production has a channel list (CSV), setup notes (Markdown + custom fields), and a photo gallery
- **Venues (Templates)** — reusable channel lists and section layouts per venue, imported via CSV
- **Focus mode** — checklist view with OSC toggle per channel (Full/Out via EOS or compatible consoles)
- **PDF export** — printable channel list from the web app
- **Bilingual** — German and English UI, switchable in settings

## Project Structure

```
LuxStage/
  ios-app/        Native SwiftUI app (iPhone/iPad)
  web-app/        Vue.js 3 web app (browser, production build served by server)
  server/         Node.js/Express backend (file-based, no database)
  shared/
    locales/      de.json + en.json  (UI strings for both clients)
    filters.json  Rosco/Lee gel filter presets
  data/           Show and template data (git-ignored)
    shows/        One folder per show (show.md, channels.csv, photos/)
    templates/    Venue CSV files + section definitions
```

## Quick Start

### Server

```bash
cd server
npm install
node index.js
# → http://localhost:3000
```

### Web App (development)

```bash
cd web-app
npm install
npm run dev
# → http://localhost:5173 (proxies API to :3000)
```

### Web App (production)

```bash
cd web-app
npm run build
# Output is served automatically by the server from web-app/dist/
```

### iOS App

Open `ios-app/LuxStageApp/LuxStageApp.xcodeproj` in Xcode. Set the server URL in the app's Settings tab.

## Venue Template Format

Templates are semicolon-separated CSV files (UTF-8) with the following columns:

```
channel;address;device;position;color;notes
1;1/001;ETC Source Four;Portal LKS;;;
```

- `channel` — channel number (required)
- `address` — DMX address, format `universe/address` e.g. `1/042`
- `device` — fixture type
- `position` — grouping label in focus view
- `color` — gel/filter
- `notes` — free text, shown in focus view

Upload templates via the Templates section in the web app. The filename (without `.csv`) becomes the venue display name — e.g. `kammer-1.csv` → **Kammer 1**.

## OSC

Configure OSC per venue in iOS Settings → *OSC pro Bühne*. Global Full/Out command patterns use `{chan}` as placeholder:

```
/eos/chan/{chan}/full
/eos/chan/{chan}/out
```

In focus mode, each channel row shows a toggle button (lightbulb) that sends Full on first tap and Out on second tap.

## Languages

The app supports German and English. Language can be changed in Settings.
All internal identifiers (API routes, CSV headers, file names) are English.
