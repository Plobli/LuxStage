#!/bin/sh
set -e

# SaaS-Modus: KEIN Bootstrap, KEIN vorangelegter Admin.
# User entstehen ausschließlich pro Mandant durch die Registrierung.
# Der Server startet ohne ADMIN_PASSWORD.

cd /app/server
exec node index.js
