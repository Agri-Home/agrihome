-- Hot-path indexes for tray, report, prediction, and monitoring reads.
-- These CREATE INDEX statements intentionally avoid CONCURRENTLY so the
-- bundled migration runner can apply them with `npm run db:migrate`.

CREATE INDEX IF NOT EXISTS idx_plants_tray_id
  ON plants(tray_id);

CREATE INDEX IF NOT EXISTS idx_camera_captures_tray_captured_at
  ON camera_captures(tray_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_plant_reports_plant_created_at
  ON plant_reports(plant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plant_reports_tray_created_at
  ON plant_reports(tray_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_results_capture_id
  ON prediction_results(capture_id);

CREATE INDEX IF NOT EXISTS idx_monitoring_events_tray_created_at
  ON monitoring_events(tray_id, created_at DESC);

-- Production CONCURRENTLY variant:
-- Run one statement at a time outside an explicit transaction, for example:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plants_tray_id ON plants(tray_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_camera_captures_tray_captured_at ON camera_captures(tray_id, captured_at DESC);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plant_reports_plant_created_at ON plant_reports(plant_id, created_at DESC);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plant_reports_tray_created_at ON plant_reports(tray_id, created_at DESC);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prediction_results_capture_id ON prediction_results(capture_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monitoring_events_tray_created_at ON monitoring_events(tray_id, created_at DESC);
