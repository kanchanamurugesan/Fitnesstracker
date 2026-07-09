import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'data', 'fitness.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema (multi-user) -------------------------------------------------
// Every user is an `account`; all data rows carry an account_id and are
// scoped to the authenticated account by the API layer.
db.exec(`
  CREATE TABLE IF NOT EXISTS account (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    units_weight   TEXT NOT NULL DEFAULT 'kg',
    units_length   TEXT NOT NULL DEFAULT 'cm',
    program_start  TEXT,
    calorie_goal   REAL,
    protein_goal   REAL,
    carbs_goal     REAL,
    fat_goal       REAL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plan_day (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    week           INTEGER NOT NULL,
    day            TEXT NOT NULL,
    workout_label  TEXT,
    UNIQUE (account_id, week, day)
  );

  CREATE TABLE IF NOT EXISTS daily_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    plan_day_id    INTEGER REFERENCES plan_day(id) ON DELETE SET NULL,
    date           TEXT NOT NULL,
    workout_done   INTEGER NOT NULL DEFAULT 0,
    core_done      INTEGER NOT NULL DEFAULT 0,
    steps          INTEGER,
    water_l        REAL,
    protein_g      REAL,
    sleep_hrs      REAL,
    notes          TEXT,
    UNIQUE (account_id, date)
  );

  CREATE TABLE IF NOT EXISTS body_entry (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    weight         REAL,
    muscle_mass    REAL,
    body_fat_pct   REAL,
    water_pct      REAL,
    measurements   TEXT
  );

  CREATE TABLE IF NOT EXISTS meal (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    name           TEXT NOT NULL,
    meal_type      TEXT,
    calories       REAL,
    protein_g      REAL,
    carbs_g        REAL,
    fat_g          REAL
  );

  CREATE TABLE IF NOT EXISTS photo (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    pose           TEXT,
    filename       TEXT NOT NULL,
    note           TEXT
  );

  CREATE TABLE IF NOT EXISTS exercise (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    plan_day_id    INTEGER NOT NULL REFERENCES plan_day(id) ON DELETE CASCADE,
    position       INTEGER NOT NULL,
    text           TEXT NOT NULL,
    name           TEXT NOT NULL,
    sets           INTEGER,
    reps           TEXT
  );

  CREATE TABLE IF NOT EXISTS exercise_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    date           TEXT NOT NULL,
    exercise_id    INTEGER NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
    done           INTEGER NOT NULL DEFAULT 0,
    weight         REAL,
    reps_done      TEXT,
    notes          TEXT,
    UNIQUE (date, exercise_id)
  );
`);

export default db;
