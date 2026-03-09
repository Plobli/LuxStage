# LuxStage

Lighting plan management for theatre productions.

## Project Structure

```
einleuchtplan-v2/
  ios-app/        Native SwiftUI App (offline-first, iPad/iPhone, App Store)
  web-app/        Vue.js 3 web app (preparation tool, runs in browser)
  pocketbase/     Backend setup & documentation (single binary)
  shared/
    locales/      de.json + en.json  (UI strings for both clients)
    filters.json  Rosco/Lee gel filter list
  docs/
    venue-template-format.md   CSV format specification
    example-template.csv       Example template for theatres
```

## Quick Start — Web App

```bash
# 1. Start PocketBase (see pocketbase/README.md)
./pocketbase serve

# 2. Install dependencies & start dev server
cd web-app
npm install
npm run dev
# → http://localhost:5173

# 3. Build for production (output → pocketbase/pb_public/)
npm run build
```

## Quick Start — iOS App

See `ios-app/README.md` (after Xcode project is created).

## Venue Template Format

See `docs/venue-template-format.md` and download `docs/example-template.csv`.

## Languages

The app supports German and English. Language can be changed in Settings.
All internal identifiers (database fields, API, CSV headers) are English.
