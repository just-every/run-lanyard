-- JOURNAL-001: a journal note's optional attachment, kept beside the records so the
-- per-request state never carries file bytes. One row per note revision that added it.
CREATE TABLE l_note_files (
 id TEXT PRIMARY KEY, note_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1000000), sha256 TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX l_note_files_note ON l_note_files(note_id);
