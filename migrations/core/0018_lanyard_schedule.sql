-- Lanyard schedule: each person's position (the schedule's group band), hourly
-- rate in cents (labor cost) and home cafe (the site picker and cross-site rows).
ALTER TABLE l_staff ADD COLUMN position TEXT;
ALTER TABLE l_staff ADD COLUMN rate_cents INTEGER CHECK(rate_cents IS NULL OR rate_cents BETWEEN 0 AND 100000);
ALTER TABLE l_staff ADD COLUMN site TEXT;
-- A new installation starts on US Pacific time until its owner chooses otherwise.
UPDATE l_meta SET timezone='America/Los_Angeles' WHERE id=1 AND version=0 AND timezone='Australia/Brisbane';
