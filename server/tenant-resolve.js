// LuxStage/server/tenant-resolve.js
// Leitet den Mandanten aus dem Host-Header ab: team-a.luxstage.app -> "team-a".
//
// Produktion (baseDomain gesetzt): ausschließlich der Host zählt. Reservierte
// Subdomains (www, app, api) sind KEIN Mandant — dort läuft die öffentliche Seite
// inkl. Registrierung.
//
// Dev/Single-Tenant (baseDomain leer): keine Subdomain-Auflösung. Zum lokalen
// Testen darf der Mandant per X-Tenant-Id-Header gesetzt werden.
import { config } from './config.js'
import { isValidTenantId, tenantExists } from './tenants.js'

const RESERVED = new Set(['www', 'app', 'api', 'admin', 'static', 'assets'])

// Host-Header ohne Port. Gibt '' zurück, wenn keiner da ist.
function hostname(req) {
  const raw = (req.headers['host'] || '').toLowerCase()
  return raw.split(':')[0]
}

// Läuft der Request auf der Betreiber-Subdomain admin.<baseDomain>?
// Dev (baseDomain leer): X-Operator-Host-Header als Override zum Testen.
export function isOperatorHost(req) {
  const base = config.baseDomain.toLowerCase()
  if (!base) return req.headers['x-operator-host'] === '1'
  return hostname(req) === 'admin.' + base
}

// Für Caddy On-Demand-TLS: Darf für diese Domain ein Zertifikat geholt werden?
// Erlaubt: Root-Domain, admin.<base>, und existierende Mandanten-Subdomains.
// Verhindert, dass Fremd-Hostnamen Caddy zu Let's-Encrypt-Anfragen zwingen.
export function isKnownDomain(domain) {
  const base = config.baseDomain.toLowerCase()
  if (!base || !domain) return false
  const host = String(domain).toLowerCase().trim().split(':')[0]
  if (host === base) return true            // Root
  if (host === 'admin.' + base) return true // Betreiber-Panel
  const suffix = '.' + base
  if (!host.endsWith(suffix)) return false
  const sub = host.slice(0, -suffix.length)
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return false
  return isValidTenantId(sub) && tenantExists(sub)
}

// Ermittelt die tenantId für diesen Request oder null (öffentlicher/Single-Tenant-Kontext).
export function resolveTenantId(req) {
  const base = config.baseDomain.toLowerCase()

  if (!base) {
    // Single-Tenant/Dev: optionaler Header-Override, nur für lokale Tests.
    const hdr = (req.headers['x-tenant-id'] || '').toLowerCase()
    return isValidTenantId(hdr) ? hdr : null
  }

  const host = hostname(req)
  // Muss exakt <sub>.<base> sein.
  const suffix = '.' + base
  if (!host.endsWith(suffix)) return null
  const sub = host.slice(0, -suffix.length)
  // Nur eine Ebene (kein team.a.luxstage.app), kein reservierter Name.
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return null
  return isValidTenantId(sub) ? sub : null
}
