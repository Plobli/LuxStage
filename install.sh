#!/usr/bin/env bash
set -e

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
step() { echo -e "  →  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  Fehler: $1"; exit 1; }

# ── Konstanten ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/christopherritter/luxstage"
INSTALL_DIR="$HOME/LuxStage"
DATA_DIR="$INSTALL_DIR/data"

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Prüfe Voraussetzungen..."
curl -sf --max-time 5 https://github.com > /dev/null || fail "Kein Internetzugang."
ok "Voraussetzungen erfüllt"

# ── Nutzereingaben ────────────────────────────────────────────────────────────
exec < /dev/tty

read -rp "Hostname [luxstage]: " HOSTNAME
HOSTNAME="${HOSTNAME:-luxstage}"
[[ $HOSTNAME =~ ^[a-zA-Z0-9._-]+$ ]] || fail "Ungültiger Hostname."

set +e
ADMIN_PASSWORD=""
for i in 1 2 3; do
  read -rsp "Admin-Passwort: " PW1; echo
  read -rsp "Admin-Passwort bestätigen: " PW2; echo
  if [[ "$PW1" == "$PW2" && -n "$PW1" ]]; then
    ADMIN_PASSWORD="$PW1"
    PW1=""; PW2=""
    ok "Passwort gespeichert"
    break
  fi
  [[ -z "$PW1" ]] && echo "  Passwort darf nicht leer sein." || echo "  Passwörter stimmen nicht überein."
  [[ $i -eq 3 ]] && { echo -e "  ${RED}✗${RESET}  Fehler: Zu viele Fehlversuche."; exit 1; }
done
set -e
PW1=""; PW2=""

JWT_SECRET=$(openssl rand -hex 32)
TECH_PASSWORD=$(openssl rand -hex 16)

echo ""
echo "  Hostname:    $HOSTNAME"
echo "  Verzeichnis: $INSTALL_DIR"
echo ""

# ── Node.js via nvm ───────────────────────────────────────────────────────────
step "Installiere nvm und Node.js 22..."
if ! command -v nvm &>/dev/null && [ ! -d "$HOME/.nvm" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
nvm alias default 22
ok "Node.js $(node -v) aktiv"

# ── PM2 installieren ──────────────────────────────────────────────────────────
step "Installiere PM2..."
npm install -g pm2 --silent
ok "PM2 installiert"

# ── avahi-daemon (mDNS für .local) ───────────────────────────────────────────
step "Installiere avahi-daemon für mDNS (.local)..."
sudo apt-get update -qq
sudo apt-get install -y avahi-daemon
ok "avahi-daemon installiert"

# ── Hostname setzen ───────────────────────────────────────────────────────────
step "Setze Hostname '$HOSTNAME'..."
OLD_HOSTNAME=$(hostname)
sudo hostnamectl set-hostname "$HOSTNAME"
sudo sed -i "s/\b${OLD_HOSTNAME}\b/$HOSTNAME/g" /etc/hosts
ok "Hostname gesetzt"

# ── Repo klonen ───────────────────────────────────────────────────────────────
step "Klone Repository nach $INSTALL_DIR..."
if [ -d "$INSTALL_DIR/.git" ]; then
  step "Repository existiert bereits, führe git pull aus..."
  git -C "$INSTALL_DIR" pull
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
ok "Repository aktuell"

# ── Web-App bauen ─────────────────────────────────────────────────────────────
step "Installiere Web-App-Abhängigkeiten und baue Web-App..."
(cd "$INSTALL_DIR/web-app" && npm install --silent && npm run build)
ok "Web-App gebaut"

# ── Server-Abhängigkeiten ─────────────────────────────────────────────────────
step "Installiere Server-Abhängigkeiten..."
(cd "$INSTALL_DIR/server" && npm install --silent)
ok "Server-Abhängigkeiten installiert"

# ── Data-Verzeichnis ──────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"
ok "Datenverzeichnis bereit: $DATA_DIR"

# ── PM2 Ecosystem-Datei ───────────────────────────────────────────────────────
step "Erstelle PM2-Konfiguration..."
cat > "$INSTALL_DIR/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [{
    name: 'luxstage',
    script: 'index.js',
    cwd: '$INSTALL_DIR/server',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: '$JWT_SECRET',
      ADMIN_PASSWORD: '$ADMIN_PASSWORD',
      TECH_PASSWORD: '$TECH_PASSWORD',
      DATA_PATH: '$DATA_DIR',
    }
  }]
}
EOF
ok "PM2-Konfiguration erstellt"

# ── PM2 starten und autostart einrichten ──────────────────────────────────────
step "Starte LuxStage mit PM2..."
pm2 start "$INSTALL_DIR/ecosystem.config.cjs"
pm2 save
# PM2 autostart beim Systemstart
PM2_STARTUP=$(pm2 startup | grep "sudo" | tail -1)
eval "$PM2_STARTUP"
ok "LuxStage läuft und startet automatisch beim Booten"

# ── Fertig ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}✓  LuxStage wurde erfolgreich installiert.${RESET}"
echo ""
echo "     Erreichbar unter:  http://$HOSTNAME.local"
echo "     Login:             admin / $ADMIN_PASSWORD"
echo "     Tech-Login:        tech  / $TECH_PASSWORD"
echo ""
echo "  Hinweis: Neustart empfohlen damit der neue Hostname aktiv wird:"
echo "           sudo reboot"
echo ""
