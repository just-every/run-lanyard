-- Kiosk credentials never travel in archives; receipts and explicitly consented photos do.
CREATE TABLE l_kiosk_devices(id TEXT PRIMARY KEY,site TEXT NOT NULL,label TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,photo INTEGER NOT NULL,failures INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0,revoked_at TEXT,created_at TEXT NOT NULL);
CREATE TABLE l_kiosk_pins(staff_id TEXT PRIMARY KEY,digest TEXT NOT NULL,version INTEGER NOT NULL);
CREATE TABLE l_kiosk_sessions(token_hash TEXT PRIMARY KEY,device_id TEXT NOT NULL,staff_id TEXT NOT NULL,staff_version INTEGER NOT NULL,pin_version INTEGER NOT NULL,operator_id TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at TEXT);
CREATE TABLE l_kiosk_attempts(staff_id TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);
CREATE TABLE l_kiosk_photos(id TEXT PRIMARY KEY,staff_id TEXT NOT NULL,device_id TEXT NOT NULL,command_id TEXT NOT NULL UNIQUE,bytes BLOB NOT NULL,created_at TEXT NOT NULL);
