ALTER TABLE feedback_ingest
  ADD COLUMN IF NOT EXISTS feedback_crop VARCHAR(120) NULL;
