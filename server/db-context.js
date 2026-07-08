// LuxStage/server/db-context.js
// Request-gebundener DB-Kontext für Multi-Tenancy.
//
// Jeder API-Request läuft in einem AsyncLocalStorage-Kontext, der die DB des
// eingeloggten Mandanten trägt. getDb() liest sie dort heraus — so bekommen die
// DB-Module die richtige Verbindung, OHNE dass ihre Signaturen geändert werden.
//
// Außerhalb eines Request-Kontexts (Hintergrund-Jobs, Bootstrap, Single-Tenant)
// fällt getDb() auf die globale dbContainer.db zurück. Dieser Fallback macht die
// Umstellung schrittweise und rückwärtskompatibel.
import { AsyncLocalStorage } from 'node:async_hooks'
import { dbContainer } from './db-init.js'

const storage = new AsyncLocalStorage()

// Führt fn in einem Kontext aus, in dem getDb() die übergebene DB liefert.
export function runWithDb(db, fn) {
  return storage.run({ db }, fn)
}

// Die DB des aktuellen Request-Kontexts — oder die globale DB als Fallback.
export function getDb() {
  const store = storage.getStore()
  return store?.db ?? dbContainer.db
}

// Ob gerade ein Request-Kontext aktiv ist (v. a. für Tests/Diagnose).
export function hasDbContext() {
  return storage.getStore() !== undefined
}
