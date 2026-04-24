import { requireAdmin } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { dbContainer } from '../db-init.js'
import { sendTestEmail } from '../email.js'

function getSmtpConfig() {
  const rows = dbContainer.db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp.%'").all()
  const cfg = { host: '', port: '587', secure: false, user: '', pass: '', from: '' }
  for (const { key, value } of rows) {
    const k = key.replace('smtp.', '')
    cfg[k] = k === 'secure' ? value === 'true' : (k === 'port' ? value : value)
  }
  return cfg
}

function saveSmtpConfig(cfg) {
  const set = dbContainer.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
  const fields = ['host', 'port', 'secure', 'user', 'pass', 'from']
  for (const field of fields) {
    set.run(`smtp.${field}`, String(cfg[field] ?? ''))
  }
}

export async function smtpRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/smtp') {
    const admin = requireAdmin(req, res); if (!admin) return
    const cfg = getSmtpConfig()
    return json(res, 200, { ...cfg, pass: cfg.pass ? '••••••••' : '' })
  }

  if (method === 'POST' && pathname === '/api/smtp') {
    const admin = requireAdmin(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { host, port, secure, user, pass, from } = body
    if (host !== undefined) saveSmtpConfig({ host, port: port || '587', secure: !!secure, user: user || '', pass: pass || '', from: from || '' })
    return json(res, 200, { ok: true })
  }

  if (method === 'POST' && pathname === '/api/smtp/test') {
    const admin = requireAdmin(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { to } = body
    if (!to) return json(res, 400, { error: 'Empfänger fehlt' })
    try {
      await sendTestEmail(to, getSmtpConfig())
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 500, { error: err.message })
    }
  }

  return null
}
