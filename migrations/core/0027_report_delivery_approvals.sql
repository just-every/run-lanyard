-- Delivery approvals are live authority, excluded from installation archives.
CREATE TABLE l_report_approvals (
  schedule_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  owner_id TEXT NOT NULL
);
