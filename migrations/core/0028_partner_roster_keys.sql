-- LINK-001: narrow partner authority never authenticates a legacy preparation route.
CREATE TABLE l_partner_keys (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_version INTEGER NOT NULL,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  site TEXT NOT NULL,
  scope TEXT NOT NULL,
  api_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  create_request_id TEXT NOT NULL,
  create_digest TEXT NOT NULL,
  rotates_id TEXT UNIQUE,
  UNIQUE(owner_id, create_request_id)
);
