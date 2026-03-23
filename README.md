# LuxStage

Lichttechnik-Verwaltung für Theaterproduktionen — Kanallisten, Aufbaunotizen, Einleucht-Checklisten und Fotodokumentation.

## Was LuxStage kann

- **Shows** — jede Produktion hat eine Kanalliste, Aufbaunotizen und eine Fotogalerie
- **Einleuchten** — Checklisten-Ansicht mit OSC-Steuerung pro Kanal (Full/Out via ETC EOS oder kompatible Pulte)
- **Vorlagen** — wiederverwendbare Kanallisten und Sektionen pro Spielstätte
- **PDF-Export** — druckbare Kanalliste aus der Web-App
- **iOS-App** — native iPhone/iPad-App mit Offline-Unterstützung, Foto-Upload und OSC-Numpad

---

## Installation (Raspberry Pi)

### Voraussetzungen

- Raspberry Pi mit **Raspberry Pi OS Lite** (64-bit empfohlen)
- Internetzugang während der Installation
- SSH-Zugang zum Pi

### Installieren

Per SSH einloggen und ausführen:

```bash
curl -fsSL https://raw.githubusercontent.com/christopherritter/luxstage/main/install.sh | sudo bash
```

Das Script fragt nach:
- **Hostname** (Vorauswahl: `luxstage`) — die App ist danach unter `http://luxstage.local` erreichbar
- **Admin-Passwort** für den Login

Die Installation richtet ein:
- LuxStage-Server (startet automatisch beim Boot)
- Web-App (im Browser aufrufbar)
- Caddy als Reverse Proxy (kein Port nötig)

Nach der Installation: `sudo reboot`

### Erster Aufruf

Nach dem Neustart im Browser öffnen:

```
http://luxstage.local
```

Login mit Benutzername `admin` und dem während der Installation vergebenen Passwort.

---

## iOS-App einrichten

1. App aus dem App Store installieren *(Link folgt)*
2. App öffnen → **Einstellungen** → **Server-URL** eintragen:
   ```
   http://luxstage.local
   ```
3. Mit `admin` und dem Admin-Passwort einloggen

---

## Vorlagen (Venue Templates)

Kanallisten werden als CSV-Datei hochgeladen. Format: Semikolon-getrennt, UTF-8.

```
channel;address;device;position;color;notes
1;1/001;ETC Source Four;Portal LKS;;;
```

| Spalte | Beschreibung |
|--------|-------------|
| `channel` | Kanalnummer (Pflicht) |
| `address` | DMX-Adresse, Format `universe/adresse` z.B. `1/042` |
| `device` | Gerätetyp |
| `position` | Gruppe in der Einleucht-Ansicht |
| `color` | Gel/Filter |
| `notes` | Freitext, wird in der Einleucht-Ansicht angezeigt |

Upload über **Vorlagen** in der Web-App. Der Dateiname (ohne `.csv`) wird als Anzeigename verwendet — z.B. `kammer-1.csv` → **Kammer 1**.

---

## OSC-Steuerung (ETC EOS)

OSC pro Spielstätte in der iOS-App unter **Einstellungen → OSC pro Bühne** konfigurieren:

- **IP-Adresse** des EOS-Pultes
- **Port** (Standard: `8000`)
- **EOS User ID** (Standard: `1`)

Im Einleuchten-Modus sendet jeder Kanal-Button `Full` beim ersten Tippen und `Out` beim zweiten. Das OSC-Numpad ermöglicht freie Kommandoeingabe direkt ans Pult.
