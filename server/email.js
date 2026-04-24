import nodemailer from 'nodemailer'
import { config } from './config.js'
import { dbContainer } from './db-init.js'

function getSmtpCfg() {
  try {
    const rows = dbContainer.db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp.%'").all()
    if (!rows.length) return config.smtp
    const cfg = { host: '', port: 587, secure: false, user: '', pass: '', from: config.smtp.from }
    for (const { key, value } of rows) {
      const k = key.replace('smtp.', '')
      if (k === 'secure') cfg.secure = value === 'true'
      else if (k === 'port') cfg.port = parseInt(value) || 587
      else cfg[k] = value
    }
    return cfg
  } catch {
    return config.smtp
  }
}

function createTransport(cfg) {
  if (!cfg?.host) return null
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  })
}

async function sendMail(to, subject, text) {
  const cfg = getSmtpCfg()
  const transport = createTransport(cfg)
  if (!transport) {
    console.warn('[email] SMTP nicht konfiguriert – Email nicht gesendet:', subject)
    return
  }
  await transport.sendMail({ from: cfg.from, to, subject, text })
}

export async function sendWelcomeEmail(email, username, initialPassword) {
  await sendMail(
    email,
    'Willkommen bei LuxStage',
    `Hallo,\n\ndein LuxStage-Account wurde erstellt.\n\nE-Mail: ${username}\nPasswort: ${initialPassword}\n\nZum Anmelden: ${config.appUrl}\n\nBitte melde dich an und ändere dein Passwort beim ersten Login.\n\nLuxStage`
  )
}

export async function sendPasswordResetEmail(email, username, newPassword) {
  await sendMail(
    email,
    'LuxStage – Passwort zurückgesetzt',
    `Hallo ${username},\n\ndein Passwort wurde zurückgesetzt.\n\nNeues Passwort: ${newPassword}\n\nBitte melde dich an und ändere dein Passwort.\n\nLuxStage`
  )
}

export async function sendTestEmail(to, cfg) {
  const transport = createTransport(cfg)
  if (!transport) throw new Error('SMTP nicht konfiguriert')
  await transport.sendMail({
    from: cfg.from,
    to,
    subject: 'LuxStage – Test-Mail',
    text: `Die SMTP-Konfiguration funktioniert. Zum Anmelden: ${config.appUrl}`,
  })
}
