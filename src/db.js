import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- ПОЛЬЗОВАТЕЛИ --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contact       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'volunteer'
                CHECK (role IN ('volunteer','coordinator','admin')),
  full_name     TEXT,
  birth_date    TEXT,
  gender        TEXT CHECK (gender IN ('male','female') OR gender IS NULL),
  city          TEXT,
  email         TEXT,
  photo_url     TEXT,
  is_blocked    INTEGER NOT NULL DEFAULT 0,
  volunteer_type TEXT CHECK (volunteer_type IN ('organization','party') OR volunteer_type IS NULL),
  -- статус заявки: draft | pending | approved | rejected | revision
  application_status TEXT NOT NULL DEFAULT 'draft'
                CHECK (application_status IN ('draft','pending','approved','rejected','revision')),
  coordinator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- АНКЕТЫ ---------------------------------------------------------------------
-- Анкета хранится как набор ответов + денормализованные поля для фильтров.
CREATE TABLE IF NOT EXISTS applications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  volunteer_type TEXT NOT NULL CHECK (volunteer_type IN ('organization','party')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','revision')),
  answers_json   TEXT NOT NULL DEFAULT '{}',
  education      TEXT,
  occupation     TEXT,
  languages_json TEXT NOT NULL DEFAULT '[]',
  skills_json    TEXT NOT NULL DEFAULT '[]',
  directions_json TEXT NOT NULL DEFAULT '[]',
  interests_json TEXT NOT NULL DEFAULT '[]',
  qualities_json TEXT NOT NULL DEFAULT '[]',
  goals          TEXT,
  motivation     TEXT,
  experience     TEXT,
  has_car        INTEGER NOT NULL DEFAULT 0,
  has_laptop     INTEGER NOT NULL DEFAULT 0,
  free_time      TEXT,
  review_comment TEXT,
  reviewed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TEXT,
  submitted_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- МЕРОПРИЯТИЯ ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  description    TEXT,
  starts_at      TEXT NOT NULL,
  ends_at        TEXT,
  location       TEXT,
  city           TEXT,
  needed_count   INTEGER NOT NULL DEFAULT 1,
  coordinator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requirements   TEXT,
  directions_json TEXT NOT NULL DEFAULT '[]',
  -- draft | published | ongoing | finished | cancelled
  status         TEXT NOT NULL DEFAULT 'published'
                 CHECK (status IN ('draft','published','ongoing','finished','cancelled')),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events(starts_at);

-- ЗАПИСИ НА МЕРОПРИЯТИЯ ------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- signed_up | accepted | rejected | cancelled
  status       TEXT NOT NULL DEFAULT 'signed_up'
               CHECK (status IN ('signed_up','accepted','rejected','cancelled')),
  team_role    TEXT,
  attendance   TEXT CHECK (attendance IN ('present','absent') OR attendance IS NULL),
  hours        REAL NOT NULL DEFAULT 0,
  comment      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);

-- ВОЛОНТЕРСКИЕ ЧАСЫ ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS hour_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
  hours       REAL NOT NULL,
  reason      TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hours_user ON hour_logs(user_id);

-- УВЕДОМЛЕНИЯ ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ЖУРНАЛ ДЕЙСТВИЙ ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  details     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_log_target ON activity_log(target_id);

-- ПРЕДСТАВЛЕНИЕ: сводка по волонтеру ----------------------------------------
CREATE VIEW IF NOT EXISTS volunteer_stats AS
SELECT
  u.id AS user_id,
  COALESCE((SELECT SUM(hours) FROM hour_logs h WHERE h.user_id = u.id), 0) AS total_hours,
  COALESCE((SELECT COUNT(*) FROM registrations r
            WHERE r.user_id = u.id AND r.attendance = 'present'), 0) AS events_count,
  (SELECT MAX(e.starts_at) FROM registrations r
     JOIN events e ON e.id = r.event_id
    WHERE r.user_id = u.id AND r.attendance = 'present') AS last_event_at
FROM users u;
`);

export function logActivity(actorId, targetId, action, details) {
  db.prepare(
    `INSERT INTO activity_log (actor_id, target_id, action, details) VALUES (?, ?, ?, ?)`
  ).run(actorId ?? null, targetId ?? null, action, details ? String(details) : null);
}
