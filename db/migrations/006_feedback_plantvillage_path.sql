ALTER TABLE feedback_ingest
  ADD COLUMN IF NOT EXISTS plantvillage_dataset_relpath VARCHAR(512) NULL;
