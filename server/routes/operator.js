// LuxStage/server/routes/operator.js
// Betreiber-Panel-API (nur auf admin.<baseDomain>, hinter requireOperator).
//   POST   /api/operator/login              -> Betreiber-Token
//   GET    /api/operator/tenants            -> Mandantenliste + Kennzahlen
//   GET    /api/operator/tenants/:id        -> Detail
//   POST   /api/operator/tenants/:id/suspend   { suspended: bool }
//   DELETE /api/operator/tenants/:id        -> Mandant komplett löschen (DSGVO)
//   GET    /api/operator/pending            -> offene Registrierungen
import { json, readJsonBody } from '../helpers.js'
import { operatorLogin, requireOperator, operatorEnabled } from '../operator.js'
import { openTenantDb, deleteTenant, tenantExists } from '../tenants.js'
import { runWithDb } from '../db-context.js'
import {
  listTenants, getTenant, setSuspended, removeTenant, listPending,
} from '../registry.js'

// Kennzahlen eines Mandanten aus seiner DB lesen (Shows, Nutzer).
function tenantStats(tenantId) {
  if (!tenantExists(tenantId)) return { shows: null, users: null }
  const db = openTenantDb(tenantId)
  return runWithDb(db, () => ({
    shows: db.prepare('SELECT count(*) c FROM shows').get().c,
    users: db.prepare('SELECT count(*) c FROM users').get().c,
  }), tenantId)
}

export async function operatorRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'POST' && pathname === '/api/operator/login') {
    if (!operatorEnabled()) return json(res, 404, { error: 'Betreiber-Panel nicht aktiviert' })
    const body = await readJsonBody(req, res); if (body === null) return
    const result = operatorLogin(String(body.username || ''), String(body.password || ''))
    if (!result) return json(res, 401, { error: 'Ungültige Betreiber-Anmeldedaten' })
    return json(res, 200, result)
  }

  // Ab hier: alles geschützt.
  if (!requireOperator(req, res)) return

  if (method === 'GET' && pathname === '/api/operator/tenants') {
    const tenants = listTenants().map(t => ({
      tenantId: t.tenant_id,
      email: t.email,
      createdAt: t.created_at,
      suspended: t.suspended === 1,
      ...tenantStats(t.tenant_id),
    }))
    return json(res, 200, { tenants })
  }

  const detail = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)$/)
  if (detail) {
    const id = detail[1]
    const t = getTenant(id)
    if (!t) return json(res, 404, { error: 'Mandant nicht gefunden' })

    if (method === 'GET') {
      return json(res, 200, {
        tenantId: t.tenant_id, email: t.email, createdAt: t.created_at,
        suspended: t.suspended === 1, ...tenantStats(id),
      })
    }
    if (method === 'DELETE') {
      removeTenant(id)      // aus Verzeichnis
      deleteTenant(id)      // DB-Dateien löschen
      console.log(`[operator] Mandant gelöscht: ${id}`)
      return json(res, 200, { ok: true })
    }
  }

  const suspend = pathname.match(/^\/api\/operator\/tenants\/([a-z0-9-]+)\/suspend$/)
  if (suspend && method === 'POST') {
    const id = suspend[1]
    if (!getTenant(id)) return json(res, 404, { error: 'Mandant nicht gefunden' })
    const body = await readJsonBody(req, res); if (body === null) return
    const changed = setSuspended(id, !!body.suspended)
    console.log(`[operator] Mandant ${id} ${body.suspended ? 'gesperrt' : 'entsperrt'}`)
    return json(res, 200, { ok: true, changed })
  }

  if (method === 'GET' && pathname === '/api/operator/pending') {
    const pending = listPending().map(p => ({
      tenantId: p.tenant_id, email: p.email, createdAt: p.created_at, expiresAt: p.expires_at,
    }))
    return json(res, 200, { pending })
  }

  return null
}
