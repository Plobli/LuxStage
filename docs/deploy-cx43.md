# LuxStage SaaS — Deployment auf dem CX43 (geteilter Server)

Konkreter Fahrplan für den bestehenden Hetzner CX43 (`188.245.171.222`), auf dem
schon Caddy + ~15 Dienste laufen. Mandanten laufen unter `<team>.luxstage.app`,
Betreiber-Panel unter `admin.luxstage.app`.

Reihenfolge bewusst: LuxStage-SaaS zuerst **ohne** Domain starten (gefahrlos),
den riskanten Caddy-Umbau zuletzt und mit Rollback.

## Vorbedingungen (erledigt)

- [x] Swap 4 GB aktiv (`swapon --show`)
- [x] DNS: `luxstage.app` + `*.luxstage.app` → `188.245.171.222` (mit `dig` verifiziert)
- [ ] SMTP-Dienst eingerichtet (z. B. Brevo — kostenlos bis 300 Mails/Tag)

## Reservierte Subdomains

`thema`, `appreview`, `docs` (bestehende feste Subdomains) sowie generische/Mail-Namen
sind im Code gesperrt — kein Mandant kann sie kapern. `thema.luxstage.app`
(aktueller Single-Tenant-LuxStage) läuft unberührt weiter.

---

## Schritt 1 — Repo auf den Server

```sh
cd /opt   # oder wo deine Stacks liegen
git clone -b feature/saas https://github.com/Plobli/LuxStage.git luxstage-saas
cd luxstage-saas
```

(Oder als Dockge-Stack anlegen — dann Compose-Datei dort einhängen.)

## Schritt 2 — .env anlegen

```sh
cp .env.saas.example .env
nano .env
```

Werte:

```
JWT_SECRET=<openssl rand -hex 32>
BASE_DOMAIN=luxstage.app
APP_URL=https://luxstage.app
CORS_ORIGINS=https://luxstage.app
SMTP_HOST=<vom SMTP-Dienst>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<vom SMTP-Dienst>
SMTP_PASS=<vom SMTP-Dienst>
SMTP_FROM=LuxStage <noreply@luxstage.app>
OPERATOR_USER=operator
OPERATOR_PASSWORD=<starkes Passwort>
```

> Hinweis: `APP_URL` ist die **Root**-Domain — Registrierungs-/Reset-Links zeigen
> dorthin (der Mandant existiert beim Confirm noch nicht).

## Schritt 3 — LuxStage-SaaS starten (noch ohne Domain)

Das Image wird von GitHub Actions bei jedem `v*`-Tag nach GHCR gebaut
(`ghcr.io/plobli/luxstage-saas`). Der Server **zieht** es nur — kein Build vor Ort.

Einmalig am GHCR anmelden (privates Image):
```sh
# GitHub → Settings → Developer settings → Personal access token (classic)
# Scope: read:packages
echo "<TOKEN>" | docker login ghcr.io -u Plobli --password-stdin
```

Starten:
```sh
docker compose -f docker-compose.saas.server.yml pull
docker compose -f docker-compose.saas.server.yml up -d
docker logs luxstage-saas | head
```

Erwartung: `LuxStage Server … läuft auf Port 3000` + `[backup] Täglicher … Job aktiv`.
Kein `ports:`-Mapping — der Container ist noch nicht von außen erreichbar. Das ist
gewollt: erst Caddy macht ihn erreichbar.

Interner Funktionstest (aus einem Container im selben Netz):
```sh
docker run --rm --network luxstage-saas-net curlimages/curl \
  -s -o /dev/null -w '%{http_code}\n' http://luxstage-saas:3000/api/health
# erwartet: 200
```

## Schritt 4 — Caddy ins LuxStage-Netz hängen

```sh
docker network connect luxstage-saas-net caddy
docker inspect caddy --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}'
# luxstage-saas-net muss jetzt gelistet sein
```

## Schritt 5 — Caddy-Image mit INWX-Plugin (RISKANTER SCHRITT)

Dein `caddy:2.8-alpine` hat kein DNS-Plugin. Für das Wildcard-Zertifikat
`*.luxstage.app` (DNS-Challenge) braucht Caddy `caddy-dns/inwx`.

**5a. Neues Image bauen (ändert noch nichts am Laufenden):**
```sh
docker build -t caddy-inwx:2.8 - <<'EOF'
FROM caddy:2.8-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/inwx
FROM caddy:2.8-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
EOF
```

**5b. INWX-API-Zugang bereitlegen.** Bei INWX einen eigenen API-/Sub-User anlegen
(nicht das Haupt-Login). Als Env in den Caddy-Stack:
```
INWX_USER=<inwx-api-user>
INWX_PASSWORD=<inwx-api-passwort>
```

**5c. Caddyfile ergänzen** — den Block **ans Ende** (nach den festen Subdomains,
damit `thema/appreview/docs.luxstage.app` als spezifischere Blöcke gewinnen):
```caddyfile
# LuxStage SaaS — alle Mandanten-Subdomains + Root (Wildcard via INWX)
*.luxstage.app {
    import common_headers
    tls {
        dns inwx {
            username {env.INWX_USER}
            password {env.INWX_PASSWORD}
        }
    }
    reverse_proxy luxstage-saas:3000 {
        header_up Host {host}
    }
}
```

> `header_up Host {host}` ist ZWINGEND — der Server leitet den Mandanten aus dem
> Host-Header ab.

**5d. Caddy-Image tauschen** (im Caddy-Stack/Compose: `caddy:2.8-alpine` →
`caddy-inwx:2.8`), INWX-Env ergänzen, neu starten:
```sh
# im Caddy-Stack-Verzeichnis
docker compose up -d
docker logs caddy --tail 30    # auf TLS-/Config-Fehler achten
```

**5e. Rollback (falls etwas hängt):** Image zurück auf `caddy:2.8-alpine`,
`*.luxstage.app`-Block auskommentieren, `docker compose up -d`. Die bestehenden
Zertifikate liegen im Caddy-Volume — alte Domains sind sofort wieder da.

## Schritt 6 — Betreiber-Panel & Registrierung testen

```sh
# Panel erreichbar?
curl -s -o /dev/null -w '%{http_code}\n' https://admin.luxstage.app/
# Registrierung (echte Mail an eine Adresse, die du prüfen kannst)
curl -s -X POST https://luxstage.app/api/register \
  -H 'Content-Type: application/json' \
  -d '{"teamId":"testteam","email":"DEINE@mail.de","password":"testpasswort1"}'
```

Dann: Bestätigungsmail abrufen → Link klicken → auf `testteam.luxstage.app`
einloggen. Danach `testteam` im Panel wieder löschen.

## Schritt 7 — Aufräumen / Go-Live

- Test-Mandant im Betreiber-Panel löschen.
- `feature/saas` → `main` mergen, wenn alles läuft.
- Erste echte Kunden einladen.

## Updates einspielen

1. Lokal: Version in `package.json` erhöhen, committen, Tag pushen:
   ```sh
   git tag v2026.6.14 && git push origin v2026.6.14
   ```
2. GitHub Actions baut das Image und pusht `ghcr.io/plobli/luxstage-saas:2026.6.14`
   und `:latest`.
3. Auf dem Server:
   ```sh
   cd /opt/luxstage-saas
   docker compose -f docker-compose.saas.server.yml pull
   docker compose -f docker-compose.saas.server.yml up -d
   ```
   Der Container startet mit dem neuen Image neu; das Datenvolume bleibt erhalten.
   Schema-Migrationen laufen beim Start automatisch (idempotent).

## Betrieb

- **Backups:** täglicher Auto-Snapshot je Mandant unter `/app/data/backups/<id>/`
  (im Volume `luxstage-saas-data`). Restore/Download über das Betreiber-Panel.
- **Ressourcen:** Container ist auf 768 MB / 1.5 CPU gedeckelt — kann die anderen
  Dienste nicht überrennen.
- **Monitoring:** `admin.luxstage.app` zeigt Mandanten + offene Registrierungen;
  optional in uptime-kuma einen Check auf `https://luxstage.app/api/health`.
