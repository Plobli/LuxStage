# ── Build-Stage: Web-App ──────────────────────────────────────────────────────
FROM node:22-alpine AS web-builder

WORKDIR /build/web-app
COPY web-app/package*.json ./
RUN npm ci --silent
COPY web-app/ ./
RUN npm run build

# ── Runtime-Stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine

# Native-Module-Build-Tools (bcrypt, sharp, better-sqlite3)
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --silent

COPY server/ ./

# router.js erwartet ../web-app/dist relativ zu server/
COPY --from=web-builder /build/web-app/dist /app/web-app/dist

EXPOSE 3000

CMD ["node", "index.js"]
