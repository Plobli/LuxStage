#!/usr/bin/env bash
set -e

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
step() { echo -e "  →  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  Fehler: $1"; exit 1; }

# ── TTY-Check + Root-Check ────────────────────────────────────────────────────
if [ ! -t 0 ] || [ "$(id -u)" -ne 0 ]; then
  echo ""
  echo "  LuxStage installieren — bitte diese zwei Befehle ausführen:"
  echo ""
  echo "    curl -fsSL https://raw.githubusercontent.com/Plobli/LuxStage/main/install.sh -o /tmp/luxstage-install.sh"
  echo "    sudo bash /tmp/luxstage-install.sh"
  echo ""
  exit 1
fi

# ── Konstanten ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/Plobli/luxstage"

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Prüfe Voraussetzungen..."
curl -sf --max-time 5 https://github.com > /dev/null || fail "Kein Internetzugang."
ok "Voraussetzungen erfüllt"

# ── Nutzereingaben ────────────────────────────────────────────────────────────
read -rp "Systemnutzer für LuxStage [luxstage]: " SERVICE_USER
SERVICE_USER="${SERVICE_USER:-luxstage}"
[[ $SERVICE_USER =~ ^[a-z_][a-z0-9_-]*$ ]] || fail "Ungültiger Nutzername (nur Kleinbuchstaben, Ziffern, - und _)."

read -rp "Hostname [luxstage]: " HOSTNAME
HOSTNAME="${HOSTNAME:-luxstage}"
[[ $HOSTNAME =~ ^[a-zA-Z0-9._-]+$ ]] || fail "Ungültiger Hostname."

MIN_PW_LEN=8
set +e
ADMIN_PASSWORD=""
for i in 1 2 3; do
  read -rsp "Admin-Passwort (mind. ${MIN_PW_LEN} Zeichen): " PW1; echo
  read -rsp "Admin-Passwort bestätigen: " PW2; echo
  if [[ -z "$PW1" ]]; then
    echo "  Passwort darf nicht leer sein."
  elif [[ ${#PW1} -lt $MIN_PW_LEN ]]; then
    echo "  Passwort zu kurz (mind. ${MIN_PW_LEN} Zeichen)."
    PW1=""; PW2=""
  elif [[ "$PW1" != "$PW2" ]]; then
    echo "  Passwörter stimmen nicht überein."
    PW1=""; PW2=""
  else
    ADMIN_PASSWORD="$PW1"
    PW1=""; PW2=""
    ok "Passwort gespeichert"
    break
  fi
  [[ $i -eq 3 ]] && { echo -e "  ${RED}✗${RESET}  Fehler: Zu viele Fehlversuche."; exit 1; }
done
set -e
PW1=""; PW2=""

JWT_SECRET=$(openssl rand -hex 32)
TECH_PASSWORD=$(openssl rand -hex 16)

SERVICE_HOME="/home/$SERVICE_USER"
INSTALL_DIR="$SERVICE_HOME/LuxStage"
DATA_DIR="$INSTALL_DIR/data"

echo ""
echo "  Systemnutzer: $SERVICE_USER"
echo "  Hostname:     $HOSTNAME"
echo "  Verzeichnis:  $INSTALL_DIR"
echo ""

# ── Paketlisten aktualisieren ─────────────────────────────────────────────────
step "Aktualisiere Paketlisten..."
apt-get update -qq
ok "Paketlisten aktualisiert"

# ── Systemnutzer anlegen ──────────────────────────────────────────────────────
step "Lege Systemnutzer '$SERVICE_USER' an..."
if id "$SERVICE_USER" &>/dev/null; then
  ok "Nutzer '$SERVICE_USER' existiert bereits"
else
  useradd --create-home --shell /bin/bash "$SERVICE_USER"
  chmod 755 "$SERVICE_HOME"
  ok "Nutzer '$SERVICE_USER' angelegt"
fi

# ── Build-Tools für native Node-Module (bcrypt, sharp) ───────────────────────
step "Installiere Build-Tools..."
apt-get install -y build-essential python3
ok "Build-Tools installiert"

# ── Caddy installieren ────────────────────────────────────────────────────────
step "Installiere Caddy..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
apt-get update -qq
apt-get install -y caddy
ok "Caddy installiert"

# ── avahi-daemon installieren (für *.local) ───────────────────────────────────
step "Installiere avahi-daemon..."
apt-get install -y avahi-daemon
systemctl enable avahi-daemon
systemctl start avahi-daemon
ok "avahi-daemon installiert und gestartet"

# ── Hostname setzen ───────────────────────────────────────────────────────────
step "Setze Hostname '$HOSTNAME'..."
OLD_HOSTNAME=$(hostname)
hostnamectl set-hostname "$HOSTNAME"
sed -i "s/\b${OLD_HOSTNAME}\b/$HOSTNAME/g" /etc/hosts
ok "Hostname gesetzt"

# ── Hilfs-Script für Service-User-Schritte ───────────────────────────────────
# Alle Schritte die als $SERVICE_USER laufen müssen in ein echtes Script,
# damit $HOME korrekt auf /home/$SERVICE_USER zeigt und kein Quoting-Problem entsteht.
USERSCRIPT=$(mktemp /tmp/luxstage-user.XXXXXX.sh)
chmod 755 "$USERSCRIPT"

cat > "$USERSCRIPT" << SCRIPT
#!/usr/bin/env bash
set -e

cd "\$HOME"
NVM_DIR="\$HOME/.nvm"
INSTALL_DIR="$INSTALL_DIR"
REPO_URL="$REPO_URL"

# nvm + Node.js 22
if [ ! -d "\$NVM_DIR" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "\$NVM_DIR/nvm.sh"
nvm install 22 --no-progress
nvm use 22
nvm alias default 22
echo "node_ok:\$(node -v)"

# PM2
npm install -g pm2 --silent
echo "pm2_ok"

# Repository
if [ -d "\$INSTALL_DIR/.git" ]; then
  git -C "\$INSTALL_DIR" pull
else
  git clone "\$REPO_URL" "\$INSTALL_DIR"
fi
echo "repo_ok"

# Web-App bauen
echo "  →  Installiere Web-App-Abhängigkeiten..."
cd "\$INSTALL_DIR/web-app"
npm install --silent
echo "  →  Baue Web-App (kann 1-2 Minuten dauern)..."
npm run build
echo "webapp_ok"

# Server-Abhängigkeiten
echo "  →  Installiere Server-Abhängigkeiten..."
cd "\$INSTALL_DIR/server"
npm install --silent
echo "server_ok"

echo "setup_ok"
SCRIPT

# ── Alle User-Schritte als Service-User ausführen ────────────────────────────
step "Installiere nvm, Node.js 22, PM2 und Repository für '$SERVICE_USER'..."
sudo -u "$SERVICE_USER" bash "$USERSCRIPT"
ok "Node.js, PM2, Repository und Web-App bereit"

rm -f "$USERSCRIPT"

# ── Data-Verzeichnis ──────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
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
      CORS_ORIGIN: 'http://$HOSTNAME.local',
    }
  }]
}
EOF
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/ecosystem.config.cjs"
chmod 600 "$INSTALL_DIR/ecosystem.config.cjs"
ok "PM2-Konfiguration erstellt"

# ── PM2 starten und autostart einrichten ─────────────────────────────────────
step "Starte LuxStage mit PM2..."

# Absoluten Node- und PM2-Pfad ermitteln
NODE_BIN=$(sudo -u "$SERVICE_USER" bash -c '. $HOME/.nvm/nvm.sh && which node')
PM2_BIN=$(sudo -u "$SERVICE_USER" bash -c '. $HOME/.nvm/nvm.sh && which pm2')

# Node systemweit verfügbar machen damit PM2-Daemon es findet
ln -sf "$NODE_BIN" /usr/local/bin/node

sudo -u "$SERVICE_USER" bash -c "HOME=$SERVICE_HOME $PM2_BIN start '$INSTALL_DIR/ecosystem.config.cjs' && $PM2_BIN save"

PM2_STARTUP=$(sudo -u "$SERVICE_USER" bash -c "HOME=$SERVICE_HOME $PM2_BIN startup systemd -u $SERVICE_USER --hp $SERVICE_HOME" | grep "sudo env" || true)
[ -n "$PM2_STARTUP" ] && eval "$PM2_STARTUP"
ok "LuxStage läuft und startet automatisch beim Booten"

# ── Caddy konfigurieren ───────────────────────────────────────────────────────
step "Konfiguriere Caddy..."
tee /etc/caddy/Caddyfile > /dev/null << EOF
http://$HOSTNAME.local {
    reverse_proxy localhost:3000
}
EOF
systemctl restart caddy
ok "Caddy konfiguriert"

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
