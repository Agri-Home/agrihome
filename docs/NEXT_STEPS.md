# AgriHome Next Steps

This is the shortest practical roadmap after the current authentication-enabled baseline. It is meant to keep the next sprint focused and believable rather than reopening every unfinished area at once.

## Immediate next sprint

1. **Auth hardening**
   Add password reset, basic role scaffolding, and a small test pass around login, logout, and protected-route redirects.

2. **API validation**
   Add request schema validation and normalize API error payloads so the frontend stops handling endpoint-specific edge cases one by one.

3. **Alert delivery**
   Turn tray `watch` and `alert` states into email or push notifications so operators do not need the dashboard open all day.

4. **Dashboard polish**
   Finish loading states, empty states, and a few small UX edges around tray detail, add-plant flow, and mesh creation feedback.

## Near-term platform work

1. **Camera ingest**
   Replace mock-friendly ingestion assumptions with a real device contract, object-storage-compatible image handling, and tray-to-device registration.

2. **ML integration**
   Move from optional/demo inference paths toward productionized species and tray inference, prediction history, and human-review thresholds.

3. **Observability**
   Add structured logs, metrics, and audit trails around auth, ingest, reports, and destructive edits.

## Longer-term product direction

1. **Role-aware operations**
   Separate grower, reviewer, and admin permissions instead of treating every signed-in user the same.

2. **Mesh automation**
   Use mesh relationships for aggregate health, alert routing, and future irrigation or workflow orchestration.

3. **Recognition memory**
   Bring Qdrant-backed embeddings online for similarity search, historical comparisons, and explainable report context.

## Recommended order

If the team needs a low-risk sequence, do the work in this order:

1. Auth hardening
2. API validation
3. Alert delivery
4. Camera ingest contract
5. Production ML and vector workflows
