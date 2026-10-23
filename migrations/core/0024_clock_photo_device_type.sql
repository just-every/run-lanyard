-- Owner-classified photo device type is attached to the existing revocable,
-- hashed clock-browser credential. No user-agent fingerprint is retained.
-- This authority table remains excluded from installation archives.
ALTER TABLE l_clock_browsers ADD COLUMN device_type TEXT NOT NULL DEFAULT 'browser'
 CHECK(device_type IN ('phone','browser'));
