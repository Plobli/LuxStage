# LuxStage — PocketBase Setup

PocketBase ist das Backend für LuxStage. Es ist eine einzelne Binary ohne Installation.

---

## Einrichten (Raspberry Pi / VPS)

### 1. PocketBase herunterladen

```bash
mkdir ~/luxstage && cd ~/luxstage

# Raspberry Pi (ARM64):
wget https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_linux_arm64.zip
unzip pocketbase_linux_arm64.zip

# Linux x86_64:
# wget https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_linux_amd64.zip
```

### 2. Migrations kopieren

```bash
cp -r /pfad/zu/einleuchtplan-v2/pocketbase/pb_migrations ~/luxstage/
```

### 3. Starten

```bash
./pocketbase serve --http="0.0.0.0:8090"
```

Beim ersten Start werden alle Collections **automatisch** angelegt — nichts muss manuell konfiguriert werden.

### 4. Admin-Account anlegen

```bash
./pocketbase superuser upsert deine@email.de "DeinPasswort"
```

### 5. Benutzer anlegen

In der Admin-Oberfläche unter `http://IP:8090/_/`:
**Collections → users → New record** → E-Mail + Passwort eingeben.

Mit diesen Zugangsdaten kann man sich in LuxStage einloggen.

---

## Als Systemdienst einrichten (dauerhaft im Hintergrund)

```bash
sudo nano /etc/systemd/system/luxstage.service
```

```ini
[Unit]
Description=LuxStage PocketBase
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/luxstage
ExecStart=/home/pi/luxstage/pocketbase serve --http="0.0.0.0:8090"
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable luxstage
sudo systemctl start luxstage
```

---

## Lokal entwickeln (macOS)

```bash
brew install pocketbase

mkdir ~/luxstage && cd ~/luxstage
cp -r /pfad/zu/einleuchtplan-v2/pocketbase/pb_migrations .

pocketbase serve
# → http://localhost:8090

pocketbase superuser upsert deine@email.de "DeinPasswort"
```

---

## Backup

```bash
./pocketbase backup create --output ~/backups/luxstage-$(date +%Y%m%d).zip
```

---

## Hinweis zur Datenbankstruktur

`pb_migrations/1_initial_schema.js` legt beim ersten Start alle Collections automatisch an. `collections.json` ist eine lesbare Referenzkopie des Schemas, die auch manuell im Admin-Panel importiert werden kann (`Settings → Import collections`).
