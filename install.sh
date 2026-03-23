#!/usr/bin/env bash
set -e

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
step() { echo -e "  →  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  Fehler: $1"; exit 1; }

# ── Konstanten ────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/christopherritter/luxstage"
INSTALL_DIR="/opt/luxstage"

# ── Preflight ─────────────────────────────────────────────────────────────────
step "Prüfe Voraussetzungen..."
[[ $EUID -eq 0 ]] || fail "Bitte als root oder mit sudo ausführen."
curl -sf --max-time 5 https://github.com > /dev/null || fail "Kein Internetzugang."
ok "Voraussetzungen erfüllt"

# ── Nutzereingaben ────────────────────────────────────────────────────────────
# Wenn das Script via "curl | sudo bash" aufgerufen wird, ist stdin eine Pipe.
# exec < /dev/tty stellt die Terminal-Eingabe wieder her, damit read funktioniert.
exec < /dev/tty

read -rp "Hostname [luxstage]: " HOSTNAME
HOSTNAME="${HOSTNAME:-luxstage}"
[[ $HOSTNAME =~ ^[a-zA-Z0-9._-]+$ ]] || fail "Hostname darf nur alphanumerische Zeichen, Punkte und Bindestriche enthalten."

# set -e während der Passwort-Schleife deaktivieren, damit Nichtübereinstimmungen
# den Skriptabbruch nicht auslösen; Fehler werden explizit behandelt.
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
  if [[ -z "$PW1" ]]; then
    echo "  Passwort darf nicht leer sein. Bitte erneut eingeben."
  else
    echo "  Passwörter stimmen nicht überein. Bitte erneut eingeben."
  fi
  if [[ $i -eq 3 ]]; then
    echo -e "  ${RED}✗${RESET}  Fehler: Zu viele Fehlversuche."
    exit 1
  fi
done
set -e
PW1=""; PW2=""

JWT_SECRET=$(openssl rand -hex 32)
TECH_PASSWORD=$(openssl rand -hex 16)

echo ""
echo "  Hostname:    $HOSTNAME"
echo "  Verzeichnis: $INSTALL_DIR"
echo ""

# ── apt-Listen aktualisieren ──────────────────────────────────────────────────
step "Aktualisiere Paketlisten..."
apt-get update -qq
ok "Paketlisten aktualisiert"

# ── NodeSource-Repository (Node.js 18) ────────────────────────────────────────
step "Füge NodeSource-Repository hinzu (Node.js 18)..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
ok "NodeSource-Repository hinzugefügt"

# ── Caddy-Repository ──────────────────────────────────────────────────────────
step "Füge Caddy-Repository hinzu..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
ok "Caddy-Repository hinzugefügt"

# ── Pakete installieren ───────────────────────────────────────────────────────
step "Installiere Pakete (git, nodejs, caddy)..."
apt-get install -y git nodejs caddy
ok "Pakete installiert"

# ── Repo klonen ───────────────────────────────────────────────────────────────
step "Klone Repository nach $INSTALL_DIR..."
git clone "$REPO_URL" "$INSTALL_DIR"
ok "Repository geklont"

# ── Web-App bauen (als root, vor chown) ───────────────────────────────────────
# Subshell verwenden damit cwd sich nicht ändert und Vite korrekt baut.
step "Installiere Web-App-Abhängigkeiten und baue Web-App..."
(cd "$INSTALL_DIR/web-app" && npm install --silent && npm run build)
ok "Web-App gebaut"

# ── Server-Abhängigkeiten (als root, vor chown) ───────────────────────────────
step "Installiere Server-Abhängigkeiten..."
(cd "$INSTALL_DIR/server" && npm install --silent)
ok "Server-Abhängigkeiten installiert"

# ── Data-Verzeichnis anlegen (vor chown-R, damit es mit übernommen wird) ──────
mkdir -p "$INSTALL_DIR/data"

# ── System-User anlegen ───────────────────────────────────────────────────────
step "Erstelle System-User 'luxstage'..."
# Guard: kein Fehler falls User bereits existiert (z.B. nach abgebrochenem Lauf)
id luxstage &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin luxstage
ok "System-User bereit"

# ── Eigentümer setzen (ein Aufruf deckt repo + data ab) ──────────────────────
step "Setze Eigentümer..."
chown -R luxstage:luxstage "$INSTALL_DIR"
ok "Eigentümer gesetzt"

# ── systemd Service ───────────────────────────────────────────────────────────
step "Erstelle systemd-Service..."
# Unquoted EOF: Variablen werden bewusst in die Unit-Datei expandiert.
cat > /etc/systemd/system/luxstage.service << EOF
[Unit]
Description=LuxStage Server
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR/server
ExecStart=/usr/bin/node index.js
Restart=always
User=luxstage
Environment=NODE_ENV=production
Environment=JWT_SECRET=$JWT_SECRET
Environment=ADMIN_PASSWORD=$ADMIN_PASSWORD
Environment=TECH_PASSWORD=$TECH_PASSWORD

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now luxstage
ok "systemd-Service aktiv"
