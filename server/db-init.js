// LuxStage/server/db-init.js
import Database from 'better-sqlite3'
import path from 'node:path'
import { config } from './config.js'

export const dbContainer = { db: null }

const dbPath = path.join(config.dataPath, 'luxstage.db')
dbContainer.db = new Database(dbPath)

function _initSchema(database) {
  database.pragma('journal_mode = WAL')
  database.pragma('synchronous = NORMAL')
  database.pragma('busy_timeout = 5000')
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

    CREATE INDEX IF NOT EXISTS idx_channels_show ON channels(show_id);

    CREATE TABLE IF NOT EXISTS section_defs (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      title      TEXT,
      type       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_section_defs_show ON section_defs(show_id);

    CREATE TABLE IF NOT EXISTS section_fields (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      label      TEXT,
      unit       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_section_fields_section ON section_fields(section_id);

    CREATE TABLE IF NOT EXISTS section_contents (
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      content    TEXT,
      PRIMARY KEY (section_id, show_id)
    );

    CREATE INDEX IF NOT EXISTS idx_section_contents_show ON section_contents(show_id);

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

    CREATE TABLE IF NOT EXISTS template_floorplans (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      image_path  TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS show_floorplan_layers (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      canvas_data TEXT,
      image_path TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      username                  TEXT PRIMARY KEY,
      password                  TEXT NOT NULL,
      role                      TEXT NOT NULL DEFAULT 'techniker',
      requires_password_change  INTEGER NOT NULL DEFAULT 0
    );
  `)
}

_initSchema(dbContainer.db)

// lighting_checks: Einleucht-Status pro Show (TTL 6h, kein FK-Constraint damit alte Shows sauber bleiben)
const lightingChecksExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='lighting_checks'"
).get()
if (!lightingChecksExists) {
  dbContainer.db.exec(`
    CREATE TABLE lighting_checks (
      show_id    TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      checked_by TEXT NOT NULL,
      checked_at INTEGER NOT NULL,
      PRIMARY KEY (show_id, channel_id)
    );
    CREATE INDEX idx_lighting_checks_show ON lighting_checks(show_id);
  `)
}

// Spalten nachträglich hinzufügen falls noch nicht vorhanden (bestehende DBs)
const showCols = dbContainer.db.pragma('table_info(shows)').map(c => c.name)
if (!showCols.includes('eos_active_channels')) {
  dbContainer.db.exec('ALTER TABLE shows ADD COLUMN eos_active_channels TEXT')
}
if (!showCols.includes('last_edited_by')) {
  dbContainer.db.exec('ALTER TABLE shows ADD COLUMN last_edited_by TEXT')
}
if (!showCols.includes('last_edited_at')) {
  dbContainer.db.exec('ALTER TABLE shows ADD COLUMN last_edited_at INTEGER')
}
const userCols = dbContainer.db.pragma('table_info(users)').map(c => c.name)
if (!userCols.includes('role')) {
  dbContainer.db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'techniker'")
}
if (!userCols.includes('requires_password_change')) {
  dbContainer.db.exec("ALTER TABLE users ADD COLUMN requires_password_change INTEGER NOT NULL DEFAULT 0")
}
// section_kv_rows: Zeilen für kv-table Sections
const kvRowsTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='section_kv_rows'"
).get()
if (!kvRowsTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE section_kv_rows (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      label      TEXT NOT NULL DEFAULT '',
      value      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_section_kv_rows_section ON section_kv_rows(section_id);
  `)
}

// template_section_kv_rows: wie section_kv_rows, aber für Templates
const tplKvRowsTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_section_kv_rows'"
).get()
if (!tplKvRowsTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE template_section_kv_rows (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES template_section_defs(id) ON DELETE CASCADE,
      label      TEXT NOT NULL DEFAULT '',
      value      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_tpl_section_kv_rows_section ON template_section_kv_rows(section_id);
  `)
}

const photoCols = dbContainer.db.pragma('table_info(photo_descriptions)').map(c => c.name)
if (!photoCols.includes('channel_number')) {
  dbContainer.db.exec("ALTER TABLE photo_descriptions ADD COLUMN channel_number TEXT NOT NULL DEFAULT ''")
}

// channel_photos: Mehrere Fotos pro Kanal zuordnen
const channelPhotosExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='channel_photos'"
).get()
if (!channelPhotosExists) {
  dbContainer.db.exec(`
    CREATE TABLE channel_photos (
      id         TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(channel_id, filename)
    );
    CREATE INDEX idx_channel_photos_channel ON channel_photos(channel_id);
  `)
}

// template_floorplans and show_floorplan_layers
const tplFloorplanTables = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_floorplans'"
).get()
if (!tplFloorplanTables) {
  dbContainer.db.exec(`
    CREATE TABLE IF NOT EXISTS template_floorplans (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      image_path  TEXT,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS show_floorplan_layers (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      canvas_data TEXT,
      image_path TEXT,
      updated_at INTEGER NOT NULL
    );
  `)
}

// show_floorplan_layers: ensure show_floorplan_layers exists (may have been created without image_path)
const showFloorplanLayersExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='show_floorplan_layers'"
).get()
if (!showFloorplanLayersExists) {
  dbContainer.db.exec(`
    CREATE TABLE IF NOT EXISTS show_floorplan_layers (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      canvas_data TEXT,
      image_path TEXT,
      updated_at INTEGER NOT NULL
    );
  `)
} else {
  const showFloorplanCols = dbContainer.db.pragma('table_info(show_floorplan_layers)').map(c => c.name)
  if (!showFloorplanCols.includes('image_path')) {
    dbContainer.db.exec('ALTER TABLE show_floorplan_layers ADD COLUMN image_path TEXT')
  }
  if (!showFloorplanCols.includes('canvas_data')) {
    // Rename svg_data → canvas_data via table recreation (SQLite limitation)
    // WARNING: existing svg_data content is discarded (format incompatible with new JSON format)
    dbContainer.db.exec(`
      CREATE TABLE show_floorplan_layers_new (
        id         TEXT PRIMARY KEY,
        show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        canvas_data TEXT,
        image_path TEXT,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO show_floorplan_layers_new (id, show_id, image_path, updated_at)
        SELECT id, show_id, image_path, updated_at FROM show_floorplan_layers;
      DROP TABLE show_floorplan_layers;
      ALTER TABLE show_floorplan_layers_new RENAME TO show_floorplan_layers;
    `)
  }
}

export function resetDb() {
  if (dbContainer.db) dbContainer.db.close()
  dbContainer.db = new Database(':memory:')
  _initSchema(dbContainer.db)
}
