CREATE TABLE IF NOT EXISTS tray_systems (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  zone VARCHAR(120) NOT NULL,
  crop VARCHAR(120) NOT NULL,
  plant_count INT NOT NULL DEFAULT 0,
  health_score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'healthy',
  device_id VARCHAR(64) NOT NULL,
  last_capture_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS camera_captures (
  id VARCHAR(64) PRIMARY KEY,
  tray_id VARCHAR(64) NOT NULL,
  tray_name VARCHAR(120) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  image_url TEXT NOT NULL,
  captured_at DATETIME NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'hardware',
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prediction_capture
    FOREIGN KEY (capture_id) REFERENCES camera_captures(id),
  CONSTRAINT fk_prediction_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id)
);

CREATE TABLE IF NOT EXISTS monitoring_events (
  id VARCHAR(64) PRIMARY KEY,
  capture_id VARCHAR(64) NULL,
  tray_id VARCHAR(64) NULL,
  level VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
