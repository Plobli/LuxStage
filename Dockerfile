# ── Build-Stage: Web-App ──────────────────────────────────────────────────────
FROM node:22-alpine AS web-builder

WORKDIR /build
COPY package.json package-lock.json ./
COPY web-app/package.json ./web-app/
COPY server/package.json ./server/
RUN npm ci --silent
COPY shared/ ./shared/
COPY web-app/ ./web-app/
RUN npm run build --workspace=web-app

# ── Runtime-Stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine

# Native-Module-Build-Tools (bcrypt, sharp, better-sqlite3)
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app
COPY package.json package-lock.json ./
COPY web-app/package.json ./web-app/
COPY server/package.json ./server/
RUN npm ci --omit=dev --silent

COPY server/ ./server/
# Self-Hosted-Image: SaaS-Module entfernen (nur im SaaS-Image enthalten).
# Der Kern lädt sie bedingt (saas.js) — ohne BASE_DOMAIN werden sie nie referenziert.
RUN rm -f server/tenants.js server/registry.js server/operator.js \
          server/tenant-resolve.js server/tenant-backup.js \
          server/routes/operator.js server/routes/register.js \
          server/operator-panel.html
COPY shared/ ./shared/
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# router.js erwartet ../web-app/dist relativ zu server/
COPY --from=web-builder /build/web-app/dist /app/web-app/dist

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
