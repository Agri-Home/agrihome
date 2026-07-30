-- Pi Zero wireless camera_server.py (Flask :5000) — servo / LED / photo.
-- Idempotent: skip if column already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'edge_devices'
      AND column_name = 'camera_server_url'
  ) THEN
    ALTER TABLE edge_devices ADD COLUMN camera_server_url TEXT NULL;
  END IF;
END $$;
