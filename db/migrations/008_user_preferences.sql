-- Per-account toggles (e.g. ML feedback / training participation).

CREATE TABLE IF NOT EXISTS user_preferences (
  owner_email VARCHAR(320) PRIMARY KEY,
  participate_ml_feedback BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
