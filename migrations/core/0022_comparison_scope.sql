-- TRADEOFF-001: existing keys acquire no new authority. The whole table is archive-excluded.
ALTER TABLE l_agent_keys ADD COLUMN scopes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE l_agent_keys ADD COLUMN cafes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE l_agent_keys ADD COLUMN create_request_id TEXT;
ALTER TABLE l_agent_keys ADD COLUMN create_digest TEXT;
CREATE UNIQUE INDEX l_agent_key_creation ON l_agent_keys(owner_id,create_request_id);
