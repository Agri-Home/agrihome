-- AGRI-104: capture pose sequences for hinge / motor multi-angle capture

CREATE TABLE IF NOT EXISTS capture_pose_sequences (
  id VARCHAR(64) PRIMARY KEY,
  owner_email VARCHAR(320) NOT NULL,
  tray_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NULL,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pose_seq_tray
    FOREIGN KEY (tray_id) REFERENCES tray_systems(id)
);

CREATE TABLE IF NOT EXISTS capture_poses (
  id VARCHAR(64) PRIMARY KEY,
  sequence_id VARCHAR(64) NOT NULL,
  pose_order INT NOT NULL,
  slot_label VARCHAR(32) NOT NULL DEFAULT '',
  row_index INT NOT NULL DEFAULT 0,
  column_index INT NOT NULL DEFAULT 0,
  plant_id VARCHAR(64) NULL,
  hinge_deg DECIMAL(8, 2) NOT NULL DEFAULT 0,
  motor_mm DECIMAL(8, 2) NOT NULL DEFAULT 0,
  dwell_ms INT NOT NULL DEFAULT 500,
  CONSTRAINT fk_pose_sequence
    FOREIGN KEY (sequence_id) REFERENCES capture_pose_sequences(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capture_pose_sequences_tray
  ON capture_pose_sequences(tray_id, active);

CREATE INDEX IF NOT EXISTS idx_capture_poses_sequence_order
  ON capture_poses(sequence_id, pose_order);
