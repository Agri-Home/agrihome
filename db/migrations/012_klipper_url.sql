-- Rename Moonraker-oriented device URL to Klipper (Agri-Home/klipper + fswebcam agent).
-- Optional HTTP base remains for server-side Take Picture when a streamer is exposed;
-- primary capture path is the Pi agent (camera-macros/save_image.sh).
-- Idempotent: fresh installs that already have klipper_url (schema.sql) are no-ops.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'edge_devices'
      AND column_name = 'moonraker_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'edge_devices'
      AND column_name = 'klipper_url'
  ) THEN
    ALTER TABLE edge_devices RENAME COLUMN moonraker_url TO klipper_url;
  END IF;
END $$;
