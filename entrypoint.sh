#!/bin/sh
set -e

# Nutzer initialisieren, falls noch nicht geschehen
if [ ! -f /app/data/.bootstrap-done ]; then
  echo "Initializing database..."

  # ADMIN_EMAIL und ADMIN_PASSWORD sind erforderlich — die E-Mail ist der Login-Name.
  if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo ""
    echo "❌ ERROR: ADMIN_EMAIL and/or ADMIN_PASSWORD are not set!"
    echo ""
    echo "Please set both environment variables in your .env file:"
    echo "  ADMIN_EMAIL=you@example.com"
    echo "  ADMIN_PASSWORD=your_secure_password"
    echo ""
    echo "Then restart the container:"
    echo "  docker compose up -d"
    echo ""
    exit 1
  fi

  cd /app/server
  node bootstrap.js

  touch /app/data/.bootstrap-done
  echo "Database initialized successfully"
fi

# Server starten
cd /app/server
exec node index.js
