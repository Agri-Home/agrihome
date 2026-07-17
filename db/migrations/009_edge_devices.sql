-- AGRI-102: Raspberry Pi / Moonraker edge device registry
-- Links tray_systems to a first-class device identity (API key auth, heartbeat).

CREATE TABLE IF NOT EXISTS edge_devices (
  id VARCHAR(64) PRIMARY KEY,
  owner_email VARCHAR(320) NOT NULL,
  cpu_serial VARCHAR(128) NOT NULL,
  mac_address VARCHAR(64) NULL,
  hostname VARCHAR(255) NULL,
  model VARCHAR(120) NULL,
  moonraker_url TEXT NULL,
  api_key_hash VARCHAR(128) NOT NULL,
  api_key_prefix VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'offline',
  last_heartbeat_at TIMESTAMP NULL,
  hinge_min_deg DECIMAL(8, 2) NULL,
  hinge_max_deg DECIMAL(8, 2) NULL,
  motor_min_mm DECIMAL(8, 2) NULL,
  motor_max_mm DECIMAL(8, 2) NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_edge_devices_cpu_serial UNIQUE (cpu_serial)
);

CREATE INDEX IF NOT EXISTS idx_edge_devices_owner_email
  ON edge_devices(owner_email);

CREATE INDEX IF NOT EXISTS idx_edge_devices_status
  ON edge_devices(status)
  WHERE revoked_at IS NULL;

ALTER TABLE tray_systems
  ADD COLUMN IF NOT EXISTS edge_device_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_tray_systems_edge_device_id
  ON tray_systems(edge_device_id);

-- Pending / completed commands pushed from Vision Console to the Pi agent
CREATE TABLE IF NOT EXISTS edge_device_commands (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  tray_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  command_type VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL DEFAULT '{}'::json,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  result_json JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  CONSTRAINT fk_edge_cmd_device
    FOREIGN KEY (device_id) REFERENCES edge_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_edge_device_commands_pending
  ON edge_device_commands(device_id, status, created_at)
  WHERE status = 'pending';
