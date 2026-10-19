-- CLOCK-007: browsers the owner enrolled as a cafe's web time clock. Only the SHA-256 of the
-- cookie token is kept, and the table never travels in an archive (a restore re-enrols).
CREATE TABLE l_clock_browsers (
 id TEXT PRIMARY KEY, site TEXT NOT NULL, label TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 enrolled_by TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT
);
