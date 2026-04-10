// LuxStage/server/bootstrap.js
// Einmaliges Setup-Skript: legt admin + tech in der users-Tabelle an.
// Idempotent: bestehende Nutzer werden nicht überschrieben.
//
// Benötigt: JWT_SECRET, ADMIN_PASSWORD, TECH_PASSWORD
// Optional: DATA_PATH (Standard: ../data)
//
// Aufruf:
//   ADMIN_PASSWORD="..." TECH_PASSWORD="..." JWT_SECRET="..." node bootstrap.js

import bcrypt from 'bcrypt'
import { db } from './db-init.js'

const BCRYPT_COST = 12

const adminPassword = process.env.ADMIN_PASSWORD
const techPassword  = process.env.TECH_PASSWORD

if (!adminPassword) {
  console.error('FEHLER: ADMIN_PASSWORD fehlt.')
  process.exit(1)
}
if (!techPassword) {
  console.error('FEHLER: TECH_PASSWORD fehlt.')
  process.exit(1)
}

const insert = db.prepare(
  'INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)'
)

const [adminHash, techHash] = await Promise.all([
  bcrypt.hash(adminPassword, BCRYPT_COST),
  bcrypt.hash(techPassword,  BCRYPT_COST),
])

const adminResult = insert.run('admin', adminHash, 'admin')
const techResult  = insert.run('tech',  techHash,  'techniker')

if (adminResult.changes > 0) {
  console.log('  ✓  Nutzer "admin" angelegt (Rolle: admin)')
} else {
  console.log('  –  Nutzer "admin" existiert bereits, wird nicht überschrieben')
}

if (techResult.changes > 0) {
  console.log('  ✓  Nutzer "tech" angelegt (Rolle: techniker)')
} else {
  console.log('  –  Nutzer "tech" existiert bereits, wird nicht überschrieben')
}

db.close()
