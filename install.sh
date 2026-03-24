#!/usr/bin/env bash
set -e

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
step() { echo -e "  →  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  Fehler: $1"; exit 1; }

# ── Konstanten ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Plobli/luxstage"
INSTALL_DIR="$HOME/LuxStage"
DATA_DIR="$INSTALL_DIR/data"
# Als root kein sudo nötig
[ "$(id -u)" = "0" ] && SUDO="" || SUDO="sudo"
# systemd verfügbar?
[ "$(ps -p 1 -o comm= 2>/dev/null)" = "systemd" ] && HAS_SYSTEMD=1 || HAS_SYSTEMD=0

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

# ── Paketlisten aktualisieren ─────────────────────────────────────────────────
step "Aktualisiere Paketlisten..."
$SUDO apt-get update -qq
ok "Paketlisten aktualisiert"

# ── Node.js via nvm ───────────────────────────────────────────────────────────
step "Installiere nvm und Node.js 22..."
if [ ! -d "$HOME/.nvm" ]; then
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

# ── Caddy installieren ────────────────────────────────────────────────────────
step "Installiere Caddy..."
$SUDO apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | $SUDO gpg --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
$SUDO apt-get update -qq
$SUDO apt-get install -y caddy
ok "Caddy installiert"

# ── Hostname setzen ───────────────────────────────────────────────────────────
step "Setze Hostname '$HOSTNAME'..."
OLD_HOSTNAME=$(hostname)
if [ "$HAS_SYSTEMD" = "1" ]; then
  $SUDO hostnamectl set-hostname "$HOSTNAME" 2>/dev/null || true
fi
echo "$HOSTNAME" | $SUDO tee /etc/hostname > /dev/null 2>&1 || true
$SUDO hostname "$HOSTNAME" 2>/dev/null || true
if [ "$OLD_HOSTNAME" != "$HOSTNAME" ]; then
  $SUDO sed -i "s/\b${OLD_HOSTNAME}\b/$HOSTNAME/g" /etc/hosts 2>/dev/null || true
fi
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
if [ "$HAS_SYSTEMD" = "1" ]; then
  PM2_STARTUP=$(pm2 startup | grep "sudo" | tail -1)
  eval "$PM2_STARTUP"
  ok "LuxStage läuft und startet automatisch beim Booten"
else
  ok "LuxStage läuft (kein systemd — Autostart nicht eingerichtet)"
fi

# ── Caddy konfigurieren ───────────────────────────────────────────────────────
step "Konfiguriere Caddy..."
$SUDO tee /etc/caddy/Caddyfile > /dev/null << EOF
http://$HOSTNAME.local {
    reverse_proxy localhost:3000
}
EOF
if [ "$HAS_SYSTEMD" = "1" ]; then
  $SUDO systemctl restart caddy
else
  pkill caddy 2>/dev/null || true
  nohup caddy run --config /etc/caddy/Caddyfile >/var/log/caddy.log 2>&1 &
fi
ok "Caddy konfiguriert"

# ── Fertig ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}✓  LuxStage wurde erfolgreich installiert.${RESET}"
echo ""
echo "     Erreichbar unter:  http://$HOSTNAME.local"
echo "     Login:             admin / $ADMIN_PASSWORD"
echo "     Tech-Login:        tech  / $TECH_PASSWORD"
echo ""
if [ "$HAS_SYSTEMD" = "1" ]; then
  echo "  Hinweis: Neustart empfohlen damit der neue Hostname aktiv wird:"
  echo "           sudo reboot"
fi
echo ""
