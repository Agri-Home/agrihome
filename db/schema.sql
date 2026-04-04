CREATE TABLE IF NOT EXISTS tray_systems (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  zone VARCHAR(120) NOT NULL,
  crop VARCHAR(120) NOT NULL,
  plant_count INT NOT NULL DEFAULT 0,
  vision_plant_count INT NULL,
  vision_plant_count_at TIMESTAMP NULL,
  vision_plant_count_confidence DECIMAL(5,4) NULL,
  vision_detections_json JSON NULL,
  health_score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'healthy',
  device_id VARCHAR(64) NOT NULL,
  last_capture_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plants (
  id VARCHAR(64) PRIMARY KEY,
  tray_id VARCHAR(64) NOT NULL,
  mesh_ids JSON NOT NULL,
  name VARCHAR(120) NOT NULL,
  cultivar VARCHAR(120) NOT NULL,
  slot_label VARCHAR(32) NOT NULL,
  row_index INT NOT NULL,
  column_index INT NOT NULL,
  health_score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'healthy',
  last_report_at TIMESTAMP NOT NULL,
  latest_diagnosis VARCHAR(160) NOT NULL,
  description TEXT NULL,
  last_image_url TEXT NULL,
  last_image_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_plant_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id)
);

CREATE TABLE IF NOT EXISTS camera_captures (
  id VARCHAR(64) PRIMARY KEY,
  tray_id VARCHAR(64) NOT NULL,
  tray_name VARCHAR(120) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  image_url TEXT NOT NULL,
  captured_at TIMESTAMP NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'hardware',
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_capture_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id)
);

CREATE TABLE IF NOT EXISTS prediction_results (
  id VARCHAR(64) PRIMARY KEY,
  capture_id VARCHAR(64) NOT NULL,
  tray_id VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  recommendation TEXT NOT NULL,
  vector_source VARCHAR(64) NOT NULL DEFAULT 'qdrant',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prediction_capture
    FOREIGN KEY (capture_id) REFERENCES camera_captures(id),
  CONSTRAINT fk_prediction_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id)
);

CREATE TABLE IF NOT EXISTS plant_reports (
  id VARCHAR(64) PRIMARY KEY,
  tray_id VARCHAR(64) NOT NULL,
  plant_id VARCHAR(64) NOT NULL,
  capture_id VARCHAR(64) NULL,
  diagnosis VARCHAR(160) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  diseases JSON NOT NULL,
  deficiencies JSON NOT NULL,
  anomalies JSON NOT NULL,
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ready',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id),
  CONSTRAINT fk_report_plant
    FOREIGN KEY (plant_id) REFERENCES plants(id),
  CONSTRAINT fk_report_capture
    FOREIGN KEY (capture_id) REFERENCES camera_captures(id)
);

CREATE TABLE IF NOT EXISTS monitoring_events (
  id VARCHAR(64) PRIMARY KEY,
  capture_id VARCHAR(64) NULL,
  tray_id VARCHAR(64) NULL,
  plant_id VARCHAR(64) NULL,
  level VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id)
);

CREATE TABLE IF NOT EXISTS mesh_networks (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  tray_ids JSON NOT NULL,
  node_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS capture_schedules (
  id VARCHAR(64) PRIMARY KEY,
  scope_type VARCHAR(16) NOT NULL,
  scope_id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  interval_minutes INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMP NOT NULL,
  last_run_at TIMESTAMP NULL,
  destination VARCHAR(64) NOT NULL DEFAULT 'computer-vision-backend',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Upgrades: `CREATE TABLE IF NOT EXISTS` does not add columns to existing tables.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS description TEXT NULL;
