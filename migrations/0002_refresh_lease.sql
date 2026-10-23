ALTER TABLE dashboard_state ADD COLUMN lease_nonce TEXT;
ALTER TABLE dashboard_state ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0;
INSERT OR IGNORE INTO dashboard_state(id,revision,settings_revision,data) VALUES(1,0,0,'null');
