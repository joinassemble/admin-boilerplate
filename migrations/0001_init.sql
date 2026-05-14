-- 0001_init.sql
-- Initial schema. See docs/superpowers/specs/2026-05-13-admin-boilerplate-design.md §10.

CREATE TABLE users (
  email            TEXT PRIMARY KEY,
  org_id           TEXT,
  role             TEXT,
  first_seen_at    INTEGER NOT NULL,
  last_seen_at     INTEGER NOT NULL,
  banned_at        INTEGER,
  metadata_json    TEXT
);
CREATE INDEX users_org ON users(org_id);
CREATE INDEX users_banned ON users(banned_at);

CREATE TABLE allowed_emails (
  email            TEXT PRIMARY KEY,
  org_id           TEXT,
  role             TEXT,
  added_at         INTEGER NOT NULL,
  added_by         TEXT NOT NULL,
  note             TEXT
);
CREATE INDEX allowed_emails_org ON allowed_emails(org_id);

CREATE TABLE sessions (
  token            TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  org_id           TEXT,
  role             TEXT,
  created_at       INTEGER NOT NULL,
  last_seen_at     INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  user_agent       TEXT,
  ip               TEXT
);
CREATE INDEX sessions_email ON sessions(email);
CREATE INDEX sessions_expires ON sessions(expires_at);

CREATE TABLE connection_secrets (
  connection_id    TEXT PRIMARY KEY,
  ciphertext       BLOB NOT NULL,
  iv               BLOB NOT NULL,
  last_rotated_at  INTEGER NOT NULL,
  last_rotated_by  TEXT NOT NULL
);

CREATE TABLE audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               INTEGER NOT NULL,
  actor_email      TEXT,
  actor_org_id     TEXT,
  actor_role       TEXT,
  action           TEXT NOT NULL,
  resource_id      TEXT,
  record_id        TEXT,
  connection_id    TEXT,
  detail_json      TEXT,
  ip               TEXT
);
CREATE INDEX audit_log_ts ON audit_log(ts DESC);
CREATE INDEX audit_log_actor ON audit_log(actor_email, ts DESC);
