-- Retained door content is a native custody exception until a coordinated
-- shared-door redaction/fence exists. This stores ids only, never source text.
CREATE TABLE l_agent_custody(staff_id TEXT PRIMARY KEY, retained_at INTEGER NOT NULL);
