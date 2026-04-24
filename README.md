# LuxStage

Bühnenmanagement für die Beleuchtung

## Was ist LuxStage?

LuxStage verwaltet Shows, Kanäle und technische Einrichtung für Bühnenshows. Erstelle Vorlagen, speichere Konfigurationen, verfolge Änderungen und exportiere Daten — alles in einer App.

## Features

### Shows verwalten
Erstelle und archiviere Shows. Jede Show enthält Einrichtungs- und Einleuchtnotizen sowie Fotos. Stelle Shows schnell wieder her oder lösche sie dauerhaft.

### Kanäle
Definiere Kanäle mit Nummer, Adresse, Gerät, Position, Farbe und Notizen. Zeige Duplikat-Warnungen für Adressen und Kanalnummern. Sortiere und gruppiere nach Position.

### Sektionen & Notizen
Schreibe Markdown-Notizen oder strukturierte Felder in Sektionen. Reihenfolge per Drag-and-drop veränderbar.

### Grundriss
Zeichne Grundrisse als Canvas über einem Hintergrundbild. Springe direkt zu Kanälen aus dem Grundriss.

### Fotogalerie
Lade Fotos hoch, weise Kanalnummern zu und organisiere sie in einer Galerie.

### Vorlagen
Speichere Kanalkonfigurationen, Sektionen und Grundriss-Bilder als Vorlagen. Neue Shows übernehmen Vorlage-Einstellungen automatisch.

### Import & Export
Importiere EOS-CSV-Dateien. Vorschau vor dem Merge zeigt neue, entfernte und unveränderte Kanäle. Exportiere Shows als CSV oder PDF.

### Versionshistorie
Automatische Snapshots alle 10 Minuten. Frühere Versionen abrufbar und wiederherstellbar.

### Mehrbenutzer
Benutzerverwaltung (nur Admin). Live-Presence zeigt, wer gerade aktiv ist.

### Einstellungen
Konto, Sprache, Backup & Restore, Server-Konfiguration, SMTP und Software-Updates.

## Plattformen

- **Web-App**: Vue 3 + Tailwind CSS
- **iOS-App**: SwiftUI (iPhone & iPad)
- **Server**: Node.js + SQLite

## Mehrsprachig

Deutsch und Englisch verfügbar.

## Installation

LuxStage wird auf einem Linux-Server (z.B. Raspberry Pi) installiert und läuft über den Browser.

### Systemanforderungen

- **Linux-System** (Debian/Ubuntu basiert, z.B. Raspberry Pi OS)
- **Root-Zugriff** für Installation erforderlich
- **Internetverbindung** während der Installation
- **Mindestens 512 MB RAM**

### Installation durchführen

1. **Installer herunterladen und ausführen:**

```bash
curl -fsSL https://raw.githubusercontent.com/Plobli/LuxStage/main/install.sh -o /tmp/luxstage-install.sh
sudo bash /tmp/luxstage-install.sh
```

2. **Installer-Fragen beantworten:**
   - **Systemnutzer** (Standard: `luxstage`)
   - **Hostname** (Standard: `luxstage`) — erreichbar als `http://luxstage.local`
   - **Externe Domain** (optional, z.B. `https://luxstage.example.com`)
   - **Admin-Passwort** (mind. 8 Zeichen)

3. **Warten auf Installation** (~2-3 Minuten)

4. **Nach Installation empfohlen:**

```bash
sudo reboot
```

### Zugriff

Nach der Installation erreichbar unter:
- **Intern:** `http://luxstage.local` oder `http://SERVER-IP`
- **Extern:** Falls Domain angegeben, über diese erreichbar

**Login-Daten:**
- Admin: `admin` / Passwort (vom Installer)
- Techniker: `tech` / Techniker-Passwort (vom Installer generiert)

### Troubleshooting

- **Erreichbar unter `luxstage.local` nicht möglich?**
  - IP des Servers direkt verwenden: `curl http://SERVER-IP`
  - Avahi-Daemon läuft und antwortet: `avahi-resolve-address 127.0.0.1`

- **Server startet nicht nach Reboot?**
  - PM2-Status prüfen: `sudo -u luxstage pm2 status`
  - Logs anschauen: `sudo journalctl -u pm2-luxstage -n 50`

- **Port 3000 wird von anderem Prozess verwendet?**
  - Port in `/home/luxstage/LuxStage/ecosystem.config.cjs` ändern
  - Caddy-Konfiguration anpassen: `/etc/caddy/Caddyfile`
  - Services neu starten: `systemctl restart caddy && sudo -u luxstage pm2 restart all`
