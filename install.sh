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

# set -e während der Passwort-Schleife deaktivieren, damit Nichtübereinstimmungen
# den Skriptabbruch nicht auslösen; Fehler werden explizit behandelt.
set +e
ADMIN_PASSWORD=""
for i in 1 2 3; do
  read -rsp "Admin-Passwort: " PW1; echo
  read -rsp "Admin-Passwort bestätigen: " PW2; echo
  if [[ "$PW1" == "$PW2" && -n "$PW1" ]]; then
    ADMIN_PASSWORD="$PW1"
    break
  fi
  echo "  Passwörter stimmen nicht überein oder sind leer. Bitte erneut eingeben."
  if [[ $i -eq 3 ]]; then
    echo -e "  ${RED}✗${RESET}  Fehler: Zu viele Fehlversuche."
    exit 1
  fi
done
set -e

JWT_SECRET=$(openssl rand -hex 32)
TECH_PASSWORD=$(openssl rand -hex 16)

echo ""
echo "  Hostname:    $HOSTNAME"
echo "  Verzeichnis: $INSTALL_DIR"
echo ""
