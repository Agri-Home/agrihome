-- Run against an existing database created from an older schema.sql.
-- New installs already include these columns on tray_systems.

ALTER TABLE tray_systems ADD COLUMN IF NOT EXISTS vision_plant_count INT NULL;
ALTER TABLE tray_systems ADD COLUMN IF NOT EXISTS vision_plant_count_at TIMESTAMP NULL;
ALTER TABLE tray_systems ADD COLUMN IF NOT EXISTS vision_plant_count_confidence DECIMAL(5,4) NULL;
ALTER TABLE tray_systems ADD COLUMN IF NOT EXISTS vision_detections_json JSON NULL;
