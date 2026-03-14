#!/usr/bin/env bash
# LuxStage v1.1 — Setup-Script für Raspberry Pi
# Aufruf: bash setup.sh

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     LuxStage v1.1 — Setup           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Voraussetzungen prüfen ─────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js nicht gefunden. Bitte installieren:${NC} curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"; exit 1; }
NODE_VERSION=$(node --version | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}Node.js 18+ benötigt (gefunden: $(node --version))${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

command -v git >/dev/null 2>&1 && echo -e "${GREEN}✓ git $(git --version | cut -d' ' -f3)${NC}" || echo -e "${YELLOW}⚠ git nicht gefunden — Update-Funktion nicht verfügbar${NC}"

# ── Eingaben ───────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Konfiguration${NC}"
echo ""

read -p "Theatername (z.B. Theater Magdeburg): " THEATER_NAME
THEATER_NAME="${THEATER_NAME:-Mein Theater}"

read -p "Admin-Passwort: " -s ADMIN_PASSWORD; echo ""
if [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${RED}Kein Passwort eingegeben. Abbruch.${NC}"
  exit 1
fi

read -p "Techniker-Passwort (leer lassen um Techniker-Account zu deaktivieren): " -s TECH_PASSWORD; echo ""

read -p "Port [3000]: " PORT
PORT="${PORT:-3000}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DEFAULT="$SCRIPT_DIR/data"
read -p "Datenpfad [$DATA_DEFAULT]: " DATA_PATH
DATA_PATH="${DATA_PATH:-$DATA_DEFAULT}"

# ── Ordner anlegen ─────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Ordner anlegen...${NC}"
mkdir -p "$DATA_PATH/shows/archiv"
mkdir -p "$DATA_PATH/templates"
echo -e "${GREEN}✓ $DATA_PATH${NC}"

# ── Beispiel-Template kopieren wenn vorhanden ──────────────────────────────

if [ -f "$SCRIPT_DIR/docs/theater-magdeburg-k1.csv" ] && [ ! -f "$DATA_PATH/templates/kammer1.csv" ]; then
  cp "$SCRIPT_DIR/docs/theater-magdeburg-k1.csv" "$DATA_PATH/templates/kammer1.csv"
  echo -e "${GREEN}✓ Beispiel-Template kopiert${NC}"
fi

# ── npm install ────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Dependencies installieren...${NC}"
cd "$SCRIPT_DIR/server"
npm install --omit=dev --silent
echo -e "${GREEN}✓ npm install${NC}"

# ── .env erstellen ─────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}.env erstellen...${NC}"

USERS_JSON="[{\"username\":\"admin\",\"password\":\"$ADMIN_PASSWORD\",\"role\":\"admin\"}"
if [ -n "$TECH_PASSWORD" ]; then
  USERS_JSON="$USERS_JSON,{\"username\":\"techniker\",\"password\":\"$TECH_PASSWORD\",\"role\":\"techniker\"}"
fi
USERS_JSON="$USERS_JSON]"

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cat > "$SCRIPT_DIR/server/.env" <<EOF
PORT=$PORT
DATA_PATH=$DATA_PATH
JWT_SECRET=$JWT_SECRET
USERS=$USERS_JSON
THEATER_NAME=$THEATER_NAME
EOF

echo -e "${GREEN}✓ server/.env${NC}"

# ── Web-App bauen ──────────────────────────────────────────────────────────

if [ -d "$SCRIPT_DIR/web-app" ]; then
  echo ""
  echo -e "${BOLD}Web-App bauen...${NC}"
  cd "$SCRIPT_DIR/web-app"
  npm install --silent
  npm run build --silent
  echo -e "${GREEN}✓ web-app/dist${NC}"
fi

# ── systemd Service ────────────────────────────────────────────────────────

if command -v systemctl >/dev/null 2>&1; then
  echo ""
  read -p "systemd Service einrichten? (empfohlen) [J/n]: " SETUP_SYSTEMD
  SETUP_SYSTEMD="${SETUP_SYSTEMD:-J}"
  if [[ "$SETUP_SYSTEMD" =~ ^[Jj] ]]; then
    SERVICE_FILE="/etc/systemd/system/luxstage.service"
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=LuxStage Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/server
EnvironmentFile=$SCRIPT_DIR/server/.env
ExecStart=$(which node) index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable luxstage
    sudo systemctl start luxstage
    echo -e "${GREEN}✓ systemd Service aktiv${NC}"
  fi
fi

# ── Abschluss ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║     LuxStage ist einsatzbereit!          ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Theater:    ${BOLD}$THEATER_NAME${NC}"
echo -e "  URL:        ${BOLD}http://$(hostname -I | awk '{print $1}'):$PORT${NC}"
echo -e "  Daten:      $DATA_PATH"
echo ""
echo -e "  Admin:      ${BOLD}admin${NC} / (dein Passwort)"
if [ -n "$TECH_PASSWORD" ]; then
  echo -e "  Techniker:  ${BOLD}techniker${NC} / (dein Passwort)"
fi
echo ""
