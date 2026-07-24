# LuxStage SaaS — Deployment auf dem CX43 (geteilter Server)

Konkreter Fahrplan für den bestehenden Hetzner CX43 (`188.245.171.222`), auf dem
schon Caddy + ~15 Dienste laufen. Mandanten laufen unter `<team>.luxstage.app`,
Betreiber-Panel unter `admin.luxstage.app`.

Reihenfolge bewusst: LuxStage-SaaS zuerst **ohne** Domain starten (gefahrlos),
den riskanten Caddy-Umbau zuletzt und mit Rollback.

## Vorbedingungen (erledigt)

- [x] Swap 4 GB aktiv (`swapon --show`)
- [x] DNS: `luxstage.app` + `*.luxstage.app` → `188.245.171.222` (mit `dig` verifiziert)
- [x] SMTP-Dienst eingerichtet (Netcup-Mailserver, `hello@luxstage.app`)

## Reservierte Subdomains

`thema`, `appreview`, `docs` (bestehende feste Subdomains) sowie generische
(`www`, `app`, `api`, `admin`, …) und Marketing/Mail-Namen (`mail`, `mx`, `cdn`,
`status`, …) sind im Code gesperrt (`RESERVED` in `tenant-resolve.js`) — kein
Mandant kann sie registrieren. `thema.luxstage.app` (aktueller Single-Tenant-
LuxStage) läuft unberührt weiter.

---

## Schritt 0 — GHCR-Login (einmalig)

Das Image ist privat. Server einmal an der GitHub Container Registry anmelden:
```sh
# GitHub → Settings → Developer settings → Personal access token (classic)
# Scope: read:packages
echo "<TOKEN>" | docker login ghcr.io -u Plobli --password-stdin
```

## Schritt 1 — Stack in Dockge anlegen

Kein Repo-Clone nötig — das Image kommt aus GHCR, es wird nur die Compose-Datei
gebraucht. In Dockge einen neuen Stack `luxstage-saas` anlegen und den Inhalt von
`docker-compose.saas.server.yml` (aus dem Repo) einfügen.

## Schritt 2 — .env im Dockge-Stack setzen

Im Dockge-Stack die Umgebungsvariablen hinterlegen (Vorlage: `.env.saas.example`):

```
JWT_SECRET=<openssl rand -hex 32>
BASE_DOMAIN=luxstage.app
APP_URL=https://api.luxstage.app
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

> Hinweis: `APP_URL` zeigt auf `api.<baseDomain>`, nicht auf die Root-Domain —
> Root (`luxstage.app`) ist die Marketing-Website (`luxstage-website`), dort
> läuft keine SPA. Registrierungs-/Reset-Links brauchen die SaaS-Oberfläche,
> die unter `api.luxstage.app` läuft (der Mandant existiert beim Confirm noch
> nicht, seine eigene Subdomain würde 404 liefern).

## Schritt 3 — LuxStage-SaaS starten (noch ohne Domain)

Stack in Dockge deployen (zieht das Image aus GHCR, startet den Container).
Erwartung im Log: `LuxStage Server … läuft auf Port 3000` + `[backup] Täglicher … Job aktiv`.

Kein `ports:`-Mapping — der Container ist noch nicht von außen erreichbar. Das ist
gewollt: erst Caddy macht ihn erreichbar. Beim Deploy entsteht das Netzwerk
`luxstage-saas-net`.

Interner Funktionstest (aus einem Container im selben Netz):
```sh
docker run --rm --network luxstage-saas-net curlimages/curl \
  -s -o /dev/null -w '%{http_code}\n' http://luxstage-saas:3000/api/health
# erwartet: 200
```

## Schritt 4 — Caddy ins LuxStage-Netz hängen

Erst jetzt (nach Schritt 3) existiert das Netz `luxstage-saas-net`:
```sh
docker network connect luxstage-saas-net caddy
docker inspect caddy --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}'
# luxstage-saas-net muss jetzt gelistet sein
```

## Schritt 5 — Caddy-Konfiguration: On-Demand-TLS statt INWX-Wildcard

Kein DNS-Plugin, kein INWX-API-Zugang nötig: statt eines Wildcard-Zertifikats
per DNS-Challenge holt Caddy für jede Mandanten-Subdomain automatisch ein
eigenes Zertifikat per HTTP/TLS-ALPN-Challenge (On-Demand-TLS), sobald sie das
erste Mal aufgerufen wird. Dafür fragt Caddy vorher den bereits vorhandenen
`ask`-Endpoint (`/api/tls-check`), der nur bekannte Domains (Root, `admin.`,
existierende Mandanten) mit 200 bestätigt — verhindert, dass Fremd-Hostnamen
Caddy zu Zertifikatsanfragen zwingen. `caddy:2.8-alpine` (Standard-Image)
reicht, kein Image-Wechsel nötig.

**5a. Globalen `on_demand_tls`-Block ergänzen** (im obersten `{ admin off }`-Block):
```caddyfile
{
    admin off

    on_demand_tls {
        ask http://luxstage-saas:3000/api/tls-check
    }
}
```

**5b. Feste Blöcke für Panel und Registrierung** — direkt nach `docs.luxstage.app`
einfügen (normales ACME-Zertifikat, wie bei `thema.`/`docs.`):
```caddyfile
# LuxStage SaaS — Betreiber-Panel (fest, normales ACME-Zertifikat)
admin.luxstage.app {
    import common_headers
    reverse_proxy luxstage-saas:3000 {
        header_up Host {host}
    }
}

# LuxStage SaaS — Registrierung / öffentliche API (fest, normales ACME-Zertifikat)
api.luxstage.app {
    import common_headers
    reverse_proxy luxstage-saas:3000 {
        header_up Host {host}
    }
}
```

> Root-Domain `luxstage.app` bleibt unverändert bei `luxstage-website` (Marketing-
> Seite). Registrierung/API laufen bewusst unter `api.luxstage.app`, nicht Root.

**5c. Mandanten-Subdomains** — Wildcard-Matcher, aber On-Demand statt DNS-Challenge:
```caddyfile
# LuxStage SaaS — Mandanten-Subdomains (team.luxstage.app), On-Demand-TLS
*.luxstage.app {
    import common_headers
    tls {
        on_demand
    }
    reverse_proxy luxstage-saas:3000 {
        header_up Host {host}
    }
}
```

> `header_up Host {host}` ist ZWINGEND — der Server leitet den Mandanten aus dem
> Host-Header ab. `admin.`/`api.` matchen als spezifischere Blöcke vor dem
> `*.luxstage.app`-Wildcard.

**5d. Übernehmen:** Caddyfile im Stack-Verzeichnis bearbeiten, `caddy validate`
gegen die Datei laufen lassen, dann Container neu starten (kein `caddy reload`
möglich, da `admin off` die lokale Admin-API deaktiviert):
```sh
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker restart caddy
docker logs caddy --tail 30    # auf "certificate obtained successfully" achten
```

**5e. Rollback (falls etwas hängt):** Backup der vorherigen Caddyfile
(`Caddyfile.bak-<timestamp>`) zurückkopieren, `docker restart caddy`. Bestehende
Zertifikate liegen im Caddy-Volume — alte Domains sind sofort wieder da.

## Schritt 6 — Betreiber-Panel & Registrierung testen

```sh
# Panel erreichbar?
curl -s -o /dev/null -w '%{http_code}\n' https://admin.luxstage.app/
# Registrierung (echte Mail an eine Adresse, die du prüfen kannst)
curl -s -X POST https://api.luxstage.app/api/register \
  -H 'Content-Type: application/json' \
  -d '{"teamId":"testteam","email":"DEINE@mail.de","password":"testpasswort1"}'
```

Dann: Bestätigungsmail abrufen → Link klicken (führt auf
`api.luxstage.app/register/confirm`, zeigt "Team aktiviert") → über den Link
"Zur Anmeldung" auf `testteam.luxstage.app` mit E-Mail + Passwort einloggen.
Danach `testteam` im Panel wieder löschen.

Login läuft immer über die bei der Registrierung angegebene **E-Mail-Adresse**
(nicht "admin") + Passwort.

## Schritt 7 — Aufräumen / Go-Live

- Test-Mandant im Betreiber-Panel löschen.
- `feature/saas` ist bereits vollständig in `main` enthalten (kein Merge
  nötig) — Branch kann gelöscht werden.
- Erste echte Kunden einladen.

## Updates einspielen

1. Lokal: Version in `package.json` erhöhen, committen, Tag pushen (Schema `v2026.6.X`):
   ```sh
   git tag v2026.6.X && git push origin v2026.6.X
   ```
2. GitHub Actions baut das Image und pusht `ghcr.io/plobli/luxstage-saas:<version>`
   und `:latest`.
3. Auf dem Server: im Dockge-Stack **Pull + Redeploy** (zieht `:latest` neu).
   Der Container startet mit dem neuen Image neu; das Datenvolume bleibt erhalten.
   Schema-Migrationen laufen beim Start automatisch (idempotent).

## Betrieb

- **Backups:** täglicher Auto-Snapshot je Mandant unter `/app/data/backups/<id>/`
  (im Volume `luxstage-saas-data`). Restore/Download über das Betreiber-Panel.
- **Ressourcen:** Container ist auf 768 MB / 1.5 CPU gedeckelt — kann die anderen
  Dienste nicht überrennen.
- **Monitoring:** `admin.luxstage.app` zeigt Mandanten + offene Registrierungen;
  optional in uptime-kuma einen Check auf `https://luxstage.app/api/health`.
