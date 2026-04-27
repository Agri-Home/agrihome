-- User-submitted images + labels for ML feedback loops.

CREATE TABLE IF NOT EXISTS feedback_ingest (
  id VARCHAR(64) PRIMARY KEY,
  user_uid VARCHAR(128) NOT NULL,
  owner_email VARCHAR(320) NOT NULL,
  image_url TEXT NOT NULL,
  image_storage_provider VARCHAR(16) NOT NULL DEFAULT 'local',
  image_storage_key TEXT NULL,
  image_mime_type VARCHAR(64) NOT NULL,
  image_bytes INT NOT NULL,
  feedback_category VARCHAR(120) NULL,
  feedback_tags JSON NOT NULL DEFAULT '[]'::json,
  comment_text TEXT NULL,
  model_prediction_label VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  export_batch_id VARCHAR(64) NULL,
  exported_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_ingest_owner_created
  ON feedback_ingest(owner_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_ingest_pending_export
  ON feedback_ingest(created_at)
  WHERE exported_at IS NULL;
