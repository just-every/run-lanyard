-- Preserve the approved enrollment-consent fence when a site later requires
-- photos. Existing photo-enabled devices already required explicit consent.
ALTER TABLE l_kiosk_devices ADD COLUMN photo_consent INTEGER NOT NULL DEFAULT 0
 CHECK(photo_consent IN (0,1));
UPDATE l_kiosk_devices SET photo_consent=1 WHERE photo=1;
