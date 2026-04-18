#!/bin/sh
set -e

# Nutzer initialisieren, falls noch nicht geschehen
if [ ! -f /app/data/.bootstrap-done ]; then
  echo "Initializing database..."

  # Standard-Passwörter, falls nicht gesetzt
  export ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
  export TECH_PASSWORD="${TECH_PASSWORD:-techniker}"

  cd /app/server
  node bootstrap.js

  touch /app/data/.bootstrap-done
  echo "Database initialized successfully"
fi

# Server starten
cd /app/server
exec node index.js
