-- TRADEOFF-001: existing keys acquire no new authority. The whole table is archive-excluded.
ALTER TABLE l_agent_keys ADD COLUMN scopes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE l_agent_keys ADD COLUMN cafes_json TEXT NOT NULL DEFAULT '[]';
