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
      requires_password_change  INTEGER NOT NULL DEFAULT 0,
      email                     TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
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

// last_edited_by/at: nachträglich hinzugefügt, fehlt in älteren DBs
const showCols = dbContainer.db.pragma('table_info(shows)').map(c => c.name)
if (!showCols.includes('last_edited_by')) {
  dbContainer.db.exec('ALTER TABLE shows ADD COLUMN last_edited_by TEXT')
}
if (!showCols.includes('last_edited_at')) {
  dbContainer.db.exec('ALTER TABLE shows ADD COLUMN last_edited_at INTEGER')
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

const templateCols = dbContainer.db.pragma('table_info(templates)').map(c => c.name)
if (!templateCols.includes('osc_host')) {
  dbContainer.db.exec("ALTER TABLE templates ADD COLUMN osc_host TEXT NOT NULL DEFAULT ''")
}
if (!templateCols.includes('updated_at')) {
  dbContainer.db.exec('ALTER TABLE templates ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0')
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

// template_floorplans: canvas_data nachträglich hinzugefügt
const tplFloorplanCols = dbContainer.db.prepare("PRAGMA table_info(template_floorplans)").all().map(c => c.name)
if (!tplFloorplanCols.includes('canvas_data')) {
  dbContainer.db.exec('ALTER TABLE template_floorplans ADD COLUMN canvas_data TEXT')
}

// show_floorplan_layers: image_path + canvas_data nachträglich hinzugefügt
{
  const showFloorplanCols = dbContainer.db.pragma('table_info(show_floorplan_layers)').map(c => c.name)
  if (!showFloorplanCols.includes('image_path')) {
    dbContainer.db.exec('ALTER TABLE show_floorplan_layers ADD COLUMN image_path TEXT')
  }
  if (!showFloorplanCols.includes('canvas_data')) {
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

// towers: Gassenturm-Instanzen pro Show
const towersTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='towers'"
).get()
if (!towersTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE towers (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      name         TEXT NOT NULL DEFAULT '',
      side         TEXT NOT NULL DEFAULT '',
      stage_area   TEXT NOT NULL DEFAULT '',
      slot_count   INTEGER NOT NULL DEFAULT 4,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX idx_towers_show ON towers(show_id);

    CREATE TABLE tower_slots (
      id         TEXT PRIMARY KEY,
      tower_id   TEXT NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      channel_id TEXT,
      UNIQUE(tower_id, slot_index)
    );
    CREATE INDEX idx_tower_slots_tower ON tower_slots(tower_id);
  `)
}

// mount_ref in channels: JSON-Feld { type, towerId, slotIndex } oder null
const channelCols = dbContainer.db.pragma('table_info(channels)').map(c => c.name)
if (!channelCols.includes('mount_ref')) {
  dbContainer.db.exec("ALTER TABLE channels ADD COLUMN mount_ref TEXT")
}
if (!channelCols.includes('quantity')) {
  dbContainer.db.exec("ALTER TABLE channels ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1")
}

// bars: Zugstangen pro Show
const barsTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='bars'"
).get()
if (!barsTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE bars (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      name         TEXT NOT NULL DEFAULT '',
      zug_nr       TEXT NOT NULL DEFAULT '',
      length_cm    INTEGER NOT NULL DEFAULT 600,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX idx_bars_show ON bars(show_id);

    CREATE TABLE bar_fixtures (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
      channel_id TEXT,
      position   REAL NOT NULL DEFAULT 0,
      UNIQUE(bar_id, channel_id)
    );
    CREATE INDEX idx_bar_fixtures_bar ON bar_fixtures(bar_id);
  `)
}

// Migration: height_cm + notes auf bars
{
  const cols = dbContainer.db.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  if (!cols.includes('height_cm'))
    dbContainer.db.exec("ALTER TABLE bars ADD COLUMN height_cm REAL")
  if (!cols.includes('notes'))
    dbContainer.db.exec("ALTER TABLE bars ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

// Migration: hide_scale auf bars
{
  const cols = dbContainer.db.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  if (!cols.includes('hide_scale'))
    dbContainer.db.exec("ALTER TABLE bars ADD COLUMN hide_scale INTEGER NOT NULL DEFAULT 0")
}

// Migration: notes auf bar_fixtures
{
  const cols = dbContainer.db.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  if (!cols.includes('notes'))
    dbContainer.db.exec("ALTER TABLE bar_fixtures ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

// Migration: UNIQUE(bar_id, channel_id) entfernen → mehrfache Kanäle auf einer Stange erlauben
{
  const done = dbContainer.db.prepare(
    "SELECT value FROM settings WHERE key = 'migration_bar_fixtures_no_unique_2026'"
  ).get()
  if (!done) {
    dbContainer.db.exec(`
      CREATE TABLE bar_fixtures_new (
        id         TEXT PRIMARY KEY,
        bar_id     TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
        channel_id TEXT,
        position   REAL NOT NULL DEFAULT 0,
        notes      TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO bar_fixtures_new (id, bar_id, channel_id, position, notes)
        SELECT id, bar_id, channel_id, position, notes FROM bar_fixtures;
      DROP TABLE bar_fixtures;
      ALTER TABLE bar_fixtures_new RENAME TO bar_fixtures;
      CREATE INDEX IF NOT EXISTS idx_bar_fixtures_bar ON bar_fixtures(bar_id);
      INSERT INTO settings (key, value) VALUES ('migration_bar_fixtures_no_unique_2026', '1');
    `)
  }
}

// Migration: notes auf towers
{
  const cols = dbContainer.db.prepare("PRAGMA table_info(towers)").all().map(c => c.name)
  if (!cols.includes('notes'))
    dbContainer.db.exec("ALTER TABLE towers ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

// template_bars: Zugstangen-Definitionen pro Bühnen-Template
const templateBarsTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_bars'"
).get()
if (!templateBarsTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE template_bars (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      zug_nr      TEXT NOT NULL DEFAULT '',
      length_cm   INTEGER NOT NULL DEFAULT 600,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_template_bars_tpl ON template_bars(template_id);
  `)
}

// Migration: section_defs Umbenennung (Stände→Raum, Besonderheiten→Hinweise)
{
  const done = dbContainer.db.prepare(
    "SELECT value FROM settings WHERE key = 'migration_section_rename_2026'"
  ).get()
  if (!done) {
    dbContainer.db.exec(`
      UPDATE section_defs SET title = 'Raum'     WHERE title = 'Stände';
      UPDATE section_defs SET title = 'Hinweise' WHERE title = 'Besonderheiten';
      UPDATE template_section_defs SET title = 'Raum'     WHERE title = 'Stände';
      UPDATE template_section_defs SET title = 'Hinweise' WHERE title = 'Besonderheiten';
      INSERT INTO settings (key, value) VALUES ('migration_section_rename_2026', '1');
    `)
  }
}

// template_towers: Gassenturm-Definitionen pro Bühnen-Template
const templateTowersTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_towers'"
).get()
if (!templateTowersTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE template_towers (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      side        TEXT NOT NULL DEFAULT '',
      stage_area  TEXT NOT NULL DEFAULT '',
      slot_count  INTEGER NOT NULL DEFAULT 4,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_template_towers_tpl ON template_towers(template_id);

    CREATE TABLE template_tower_slots (
      id         TEXT PRIMARY KEY,
      tower_id   TEXT NOT NULL REFERENCES template_towers(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      channel    TEXT,
      device     TEXT,
      color      TEXT,
      UNIQUE(tower_id, slot_index)
    );
    CREATE INDEX idx_template_tower_slots_tower ON template_tower_slots(tower_id);
  `)
}

// template_bar_fixtures: Scheinwerfer-Positionen auf Template-Bars
const templateBarFixturesTableExists = dbContainer.db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_bar_fixtures'"
).get()
if (!templateBarFixturesTableExists) {
  dbContainer.db.exec(`
    CREATE TABLE template_bar_fixtures (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES template_bars(id) ON DELETE CASCADE,
      position   REAL NOT NULL DEFAULT 0,
      channel    TEXT,
      device     TEXT,
      color      TEXT,
      notes      TEXT NOT NULL DEFAULT '',
      UNIQUE(bar_id, position)
    );
    CREATE INDEX idx_template_bar_fixtures_bar ON template_bar_fixtures(bar_id);
  `)
}

export function resetDb() {
  if (dbContainer.db) dbContainer.db.close()
  dbContainer.db = new Database(':memory:')
  _initSchema(dbContainer.db)
}
