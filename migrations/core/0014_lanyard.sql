-- Lanyard release one. Adapted from Glove atomic assertion batches and Willow
-- immutable payroll source claims; identity and retained hours are separate.
CREATE TABLE IF NOT EXISTS l_meta (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, timezone TEXT NOT NULL DEFAULT 'Australia/Brisbane');
INSERT OR IGNORE INTO l_meta(id,version) VALUES (1,0);
CREATE TABLE IF NOT EXISTS l_staff (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 payroll_id TEXT UNIQUE, role TEXT NOT NULL CHECK(role IN ('staff','manager')),
 active INTEGER NOT NULL CHECK(active IN (0,1)), version INTEGER NOT NULL,
 erased_at TEXT
);
CREATE TABLE IF NOT EXISTS l_records (
 kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS l_records_staff ON l_records(kind,json_extract(data,'$.staffId'));
CREATE TABLE IF NOT EXISTS l_guard (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE IF NOT EXISTS l_commands (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS l_events (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL,
 action TEXT NOT NULL, entity_id TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS l_payroll_claims (
 time_id TEXT NOT NULL, time_revision INTEGER NOT NULL, batch_id TEXT NOT NULL,
 root_id TEXT NOT NULL, minutes INTEGER NOT NULL, PRIMARY KEY(time_id,time_revision)
);
CREATE INDEX IF NOT EXISTS l_claims_root ON l_payroll_claims(root_id);
CREATE TABLE IF NOT EXISTS l_erasure_journal (
 staff_id TEXT PRIMARY KEY, identity_hash TEXT NOT NULL UNIQUE, erased_at TEXT NOT NULL, actor_id TEXT NOT NULL
);
-- Journals must survive restore/import: merge them into restored DBs BEFORE identity import.
