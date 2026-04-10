// LuxStage/server/db-init.js
import Database from 'better-sqlite3'
import path from 'node:path'
import { config } from './config.js'

export const dbContainer = { db: null }

const dbPath = path.join(config.dataPath, 'luxstage.db')
dbContainer.db = new Database(dbPath)

function _initSchema(database) {
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  database.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id             TEXT PRIMARY KEY,
      slug           TEXT UNIQUE NOT NULL,
      name           TEXT,
      datum          TEXT,
      template       TEXT,
      untertitel     TEXT,
      spielzeit      TEXT,
      setup_markdown TEXT,
      eos_active_channels TEXT,
      archived       INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shows_archived ON shows(archived);

    CREATE TABLE IF NOT EXISTS channels (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      channel    TEXT,
      address    TEXT,
      device     TEXT,
      position   TEXT,
      color      TEXT,
      notes      TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS section_defs (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      title      TEXT,
      type       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS section_fields (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      label      TEXT,
      unit       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS section_contents (
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      content    TEXT,
      PRIMARY KEY (section_id, show_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id   TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_channels (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      channel     TEXT,
      address     TEXT,
      device      TEXT,
      position    TEXT,
      color       TEXT,
      notes       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_section_defs (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      title       TEXT,
      type        TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_section_fields (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES template_section_defs(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      label      TEXT,
      unit       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photo_descriptions (
      show_id        TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      filename       TEXT NOT NULL,
      caption        TEXT NOT NULL DEFAULT '',
      channel_number TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (show_id, filename)
    );

    CREATE TABLE IF NOT EXISTS photo_order (
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (show_id, filename)
    );

    CREATE TABLE IF NOT EXISTS locks (
      show_id  TEXT PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      since    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      channels   TEXT NOT NULL,
      sections   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      role     TEXT NOT NULL DEFAULT 'techniker'
    );
  `)
}

_initSchema(dbContainer.db)

// Spalten nachträglich hinzufügen falls noch nicht vorhanden (bestehende DBs)
const showCols = dbContainer.db.pragma('table_info(shows)').map(c => c.name)
if (!showCols.includes('eos_active_channels')) {
  dbContainer.db.exec('ALTER TABLE shows ADD COLUMN eos_active_channels TEXT')
}
const userCols = dbContainer.db.pragma('table_info(users)').map(c => c.name)
if (!userCols.includes('role')) {
  dbContainer.db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'techniker'")
}
const photoCols = dbContainer.db.pragma('table_info(photo_descriptions)').map(c => c.name)
if (!photoCols.includes('channel_number')) {
  dbContainer.db.exec("ALTER TABLE photo_descriptions ADD COLUMN channel_number TEXT NOT NULL DEFAULT ''")
}

export function resetDb() {
  if (dbContainer.db) dbContainer.db.close()
  dbContainer.db = new Database(':memory:')
  _initSchema(dbContainer.db)
}
