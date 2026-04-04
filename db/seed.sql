-- Initial data for AgriHome (run after schema.sql). Idempotent via ON CONFLICT.

INSERT INTO tray_systems (
  id, name, zone, crop, plant_count,
  health_score, status, device_id, last_capture_at
)
VALUES
  (
    'tray-manual',
    'My plants',
    'Manual entry',
    'Custom',
    0,
    92,
    'healthy',
    'user-device',
    CURRENT_TIMESTAMP
  ),
  (
    'tray-demo-1',
    'Demo tray',
    'Bay 1',
    'Basil',
    0,
    90,
    'healthy',
    'cam-demo-1',
    CURRENT_TIMESTAMP
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO plants (
  id, tray_id, mesh_ids, name, cultivar, slot_label, row_index, column_index,
  health_score, status, last_report_at, latest_diagnosis, description, last_image_url, last_image_at
)
VALUES (
  'plant-seed-demo-1',
  'tray-demo-1',
  '[]'::json,
  'Sweet basil',
  'Genovese',
  'A-1',
  1,
  1,
  90,
  'healthy',
  CURRENT_TIMESTAMP,
  'No analysis yet — upload a leaf photo',
  'Demo plant from seed data.',
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

UPDATE tray_systems
SET plant_count = (SELECT COUNT(*)::int FROM plants p WHERE p.tray_id = tray_systems.id)
WHERE id IN ('tray-demo-1', 'tray-manual');

INSERT INTO camera_captures (
  id, tray_id, tray_name, device_id, image_url, captured_at, source, status, notes
)
VALUES (
  'capture-seed-1',
  'tray-demo-1',
  'Demo tray',
  'cam-demo-1',
  '/pwa-icon.svg',
  CURRENT_TIMESTAMP,
  'hardware',
  'available',
  'Seed capture for dashboard'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO monitoring_events (
  id, capture_id, tray_id, plant_id, level, title, message, created_at
)
VALUES (
  'event-seed-1',
  'capture-seed-1',
  'tray-demo-1',
  NULL,
  'info',
  'Database seeded',
  'Run the leaf classifier with CV_SPECIES_INFERENCE_URL for live species ID.',
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
