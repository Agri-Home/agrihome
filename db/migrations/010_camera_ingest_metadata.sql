-- AGRI-101: extend camera_captures for Pi multipart ingest metadata

ALTER TABLE camera_captures
  ADD COLUMN IF NOT EXISTS plant_id VARCHAR(64);

ALTER TABLE camera_captures
  ADD COLUMN IF NOT EXISTS hinge_deg DECIMAL(8, 2);

ALTER TABLE camera_captures
  ADD COLUMN IF NOT EXISTS motor_mm DECIMAL(8, 2);

ALTER TABLE camera_captures
  ADD COLUMN IF NOT EXISTS pose_order INT;

ALTER TABLE camera_captures
  ADD COLUMN IF NOT EXISTS command_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_camera_captures_tray_captured
  ON camera_captures(tray_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_captures_plant
  ON camera_captures(plant_id)
  WHERE plant_id IS NOT NULL;
