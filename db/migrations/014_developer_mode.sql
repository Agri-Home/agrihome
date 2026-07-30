-- Developer tools toggle for Vision Console (manual Pi / Klipper controls).
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_preferences'
      AND column_name = 'developer_mode'
  ) THEN
    ALTER TABLE user_preferences
      ADD COLUMN developer_mode BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
