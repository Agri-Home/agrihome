-- Associate existing account-scoped data to the admin account and require
-- explicit ownership for new records.

ALTER TABLE tray_systems ADD COLUMN IF NOT EXISTS owner_email VARCHAR(320);
ALTER TABLE plants ADD COLUMN IF NOT EXISTS owner_email VARCHAR(320);
ALTER TABLE mesh_networks ADD COLUMN IF NOT EXISTS owner_email VARCHAR(320);
ALTER TABLE capture_schedules ADD COLUMN IF NOT EXISTS owner_email VARCHAR(320);

UPDATE tray_systems
SET owner_email = 'admin@email.com'
WHERE owner_email IS NULL;

UPDATE plants
SET owner_email = 'admin@email.com'
WHERE owner_email IS NULL;

UPDATE mesh_networks
SET owner_email = 'admin@email.com'
WHERE owner_email IS NULL;

UPDATE capture_schedules
SET owner_email = 'admin@email.com'
WHERE owner_email IS NULL;

ALTER TABLE tray_systems ALTER COLUMN owner_email SET NOT NULL;
ALTER TABLE plants ALTER COLUMN owner_email SET NOT NULL;
ALTER TABLE mesh_networks ALTER COLUMN owner_email SET NOT NULL;
ALTER TABLE capture_schedules ALTER COLUMN owner_email SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tray_systems_owner_email
  ON tray_systems(owner_email);
CREATE INDEX IF NOT EXISTS idx_plants_owner_email
  ON plants(owner_email);
CREATE INDEX IF NOT EXISTS idx_mesh_networks_owner_email
  ON mesh_networks(owner_email);
CREATE INDEX IF NOT EXISTS idx_capture_schedules_owner_email
  ON capture_schedules(owner_email);
