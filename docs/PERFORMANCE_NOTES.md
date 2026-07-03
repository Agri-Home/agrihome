# AgriHome Performance Notes

## Operational indexes

Migration `db/migrations/009_operational_indexes.sql` adds the hot-path indexes used by tray, report, prediction, and monitoring reads:

- `plants(tray_id)`
- `camera_captures(tray_id, captured_at DESC)`
- `plant_reports(plant_id, created_at DESC)`
- `plant_reports(tray_id, created_at DESC)`
- `prediction_results(capture_id)`
- `monitoring_events(tray_id, created_at DESC)`

The migration uses `CREATE INDEX IF NOT EXISTS` so `npm run db:migrate` can be rerun safely. For production databases with sustained writes, run the commented `CREATE INDEX CONCURRENTLY` variants one statement at a time outside a transaction.

## Statement timeout

Set `POSTGRES_STATEMENT_TIMEOUT_MS` to apply a per-connection PostgreSQL statement timeout. The default is `0`, which disables the timeout.

Verification:

```bash
POSTGRES_STATEMENT_TIMEOUT_MS=500 npm run db:check-statement-timeout
```

The verifier runs a deliberately slow `pg_sleep` query and expects PostgreSQL to cancel it with SQLSTATE `57014`.

## Dashboard plant aggregate

The shared dashboard service no longer fetches every plant row to support dashboard-level totals. It uses a single aggregate query that returns:

- total plants
- average health score
- alert count
- watch count

For a seeded account with 10,000 plants, this changes the dashboard plant summary path from hydrating and mapping 10,000 rows to returning one aggregate row. The visible dashboard values are unchanged because the current dashboard page already computes its displayed health, tray, alert, and schedule cards from tray/schedule data; this change removes the unbounded plant scan from the shared dashboard data path.
