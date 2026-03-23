# LuxStage

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Lichttechnik-Verwaltung für Theaterproduktionen** — Kanallisten, Aufbaunotizen, Einleucht-Checklisten und Fotodokumentation.

## Was LuxStage kann

- ✅ **Kanallisten verwalten** — CSV-Import, Gerätetypen, DMX-Adressen, Gel-Filter
- ✅ **Einleuchten** — Checklisten-Ansicht mit OSC-Steuerung direkt ans EOS-Pult
- ✅ **Aufbaunotizen** — Markdown-Sektionen und Felder pro Produktion
- ✅ **Fotos** — Dokumentation direkt aus der iOS-App, mit Lightbox
- ✅ **Spielstätten-Vorlagen** — Kanallisten einmal anlegen, für jede Produktion wiederverwenden

## Schnellstart

```
http://luxstage.local
```

Nach der Installation auf dem Raspberry Pi ist LuxStage sofort im Browser erreichbar — kein Port, kein Konfigurieren.

---

## Installation (Raspberry Pi)

### Voraussetzungen

- Raspberry Pi mit **Raspberry Pi OS Lite** (64-bit empfohlen)
- Internetzugang während der Installation
- SSH-Zugang zum Pi

### Installieren

Per SSH einloggen und ausführen:

```bash
curl -fsSL https://raw.githubusercontent.com/Plobli/LuxStage/main/install.sh | sudo bash
```

Das Script fragt nach:
- **Hostname** (Vorauswahl: `luxstage`) — die App ist danach unter `http://luxstage.local` erreichbar
- **Admin-Passwort** für den Login

Was eingerichtet wird:
- LuxStage-Server (startet automatisch beim Boot)
- Web-App (im Browser aufrufbar)
- Caddy als Reverse Proxy (kein Port nötig)

Nach der Installation: `sudo reboot`

### Erster Aufruf

Nach dem Neustart im Browser öffnen:

```
http://luxstage.local
```

Login: Benutzername `admin`, Passwort wie bei der Installation vergeben.

---

## iOS-App einrichten

1. App aus dem App Store installieren *(Link folgt)*
2. App öffnen → **Einstellungen** → **Server-URL** eintragen:
   ```
   http://luxstage.local
   ```
3. Mit `admin` und dem Admin-Passwort einloggen

---

## Spielstätten-Vorlagen

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

| Einstellung | Beschreibung | Standard |
|-------------|-------------|---------|
| IP-Adresse | IP des EOS-Pultes im Netzwerk | — |
| Port | OSC-Empfangsport am Pult | `8000` |
| EOS User ID | Aktiver EOS-User für Kommandos | `1` |

Im Einleuchten-Modus sendet jeder Kanal-Button `Full` beim ersten Tippen und `Out` beim zweiten. Das **OSC-Numpad** ermöglicht freie Kommandoeingabe (Kanal, Gruppe, Thru, @, Full, Out) direkt ans Pult.

---

## Fehlerbehebung

### LuxStage nicht erreichbar unter `luxstage.local`

- Pi läuft? `ping luxstage.local` im Terminal testen
- Gleicher WLAN-Kanal wie der Pi?
- Nach der Installation neu gestartet? `sudo reboot`

### Login schlägt fehl

- Benutzername ist immer `admin`
- Passwort wurde bei der Installation vergeben — bei Verlust muss LuxStage neu installiert werden

### Service neu starten

Per SSH:
```bash
sudo systemctl restart luxstage
```

---

## Lizenz

- **Server & Web-App** — MIT © Christopher Rohde
- **iOS-App** (`ios-app/`) — Alle Rechte vorbehalten © Christopher Rohde
