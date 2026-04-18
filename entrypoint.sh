#!/bin/sh
set -e

# Nutzer initialisieren, falls noch nicht geschehen
if [ ! -f /app/data/.bootstrap-done ]; then
  echo "Initializing database..."

  # ADMIN_PASSWORD ist erforderlich
  if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "" ]; then
    echo ""
    echo "❌ ERROR: ADMIN_PASSWORD is not set!"
    echo ""
    echo "Please set the ADMIN_PASSWORD environment variable in your .env file:"
    echo "  ADMIN_PASSWORD=your_secure_password"
    echo ""
    echo "Then restart the container:"
    echo "  docker compose up -d"
    echo ""
    exit 1
  fi

  export TECH_PASSWORD="${TECH_PASSWORD:-}"

  cd /app/server
  node bootstrap.js

  touch /app/data/.bootstrap-done
  echo "Database initialized successfully"
fi

# Server starten
cd /app/server
exec node index.js
