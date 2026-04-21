# User stories (delivered scope)

Short narratives in classic **“As a … I want … So that …”** form. They summarize work from first bootstrap through Postgres-backed APIs, Vision Console UI, CV training/serving, and inference integration—not a formal backlog.

---

1. **As a** grower or operator, **I want** a single web app that loads on my phone or desktop with clear navigation (dashboard, trays, add plant, mesh, schedule) **so that** I can monitor trays and plants without juggling multiple tools.

2. **As a** developer, **I want** a Next.js App Router codebase with TypeScript, Tailwind, a consistent shell (sidebar on large screens, bottom nav + FAB on mobile), and safe-area-aware layout **so that** the product feels like a PWA and is maintainable.

3. **As a** developer, **I want** trays, plants, captures, predictions, reports, events, meshes, and schedules stored in **PostgreSQL** with a documented schema and seed scripts **so that** data survives restarts and can be backed up like any other service.

4. **As an** integrator, **I want** REST endpoints and a **GraphQL** endpoint for listing trays, plants, reports, schedules, and health, plus mutations for mesh creation, schedule upserts, and plant update/delete **so that** I can script operations or build secondary clients without reverse-engineering the UI.

5. **As a** grower, **I want** to open the **dashboard** and see a tray health snapshot, latest camera frame when available, and a short tray list **so that** I get situational awareness in one glance.

6. **As a** grower, **I want** to open a **tray**, see camera imagery, monitoring trends, plants with thumbnails, events, and optionally run **tray vision** (count + detection boxes) from a top-down photo **so that** catalog counts and computer vision estimates are visible in one place.

7. **As a** grower, **I want** a rich **plant detail** page (health stats, latest finding, photo upload, edit name/species/notes, delete, health chart, report history, monitoring log) **so that** I can track one plant over time and correct metadata when needed.

8. **As a** grower, **I want** to **add a plant from a leaf photo** after choosing a tray, with the app calling a trained classifier for crop and condition **so that** new plants are identified consistently with the same model the team trained and deployed.

9. **As a** ML engineer, **I want** to train a **PlantVillage-style** multi-class model in `cv-backend` (with optional extra datasets), export `best.pt` and `classes.json`, and serve **`POST /v1/classify`** with a documented JSON contract **so that** AgriHome can point `CV_SPECIES_INFERENCE_URL` at a known, reproducible service.

10. **As a** ML engineer, **I want** optional **Docker GPU** workflows (trainer idle container + classifier serving) documented and composable **so that** training and inference can run on a workstation or NAS without ad-hoc environment drift.

11. **As a** developer, **I want** tray-level inference behind **`CV_TRAY_INFERENCE_URL`** with a simulator when unset, and species inference that **requires** `CV_SPECIES_INFERENCE_URL` when those code paths run **so that** we can demo without a detector but cannot silently fake species in production paths.

12. **As a** developer, **I want** uploads stored on disk under configurable **`STORAGE_*`** paths and served via **`GET /api/files/...`** with `next/image` local patterns **so that** images are not forced into the repo or a single monolithic blob store during development.

13. **As an** operator, **I want** **`GET /api/health`** (and GraphQL `health`) to report database connectivity, vector store mode, and whether tray/species inference is remote or not configured **so that** deployment checks and dashboards can tell if the stack is wired correctly.

14. **As a** facility operator, **I want** to register or sign in with email/password or Google and then move into an authenticated session **so that** tray data, plant reports, and schedules are not exposed on the public landing page.

15. **As a** developer, **I want** a **standalone** Next.js build with a `postbuild` asset copy and a **GitHub Actions** workflow that typechecks, builds, and publishes a container image **so that** the app can be deployed repeatably to containers.

---

## Optional follow-on stories (not implied as done)

These are natural next steps; include them in a roadmap if useful.

- **As a** facility admin, **I want** role-based access control layered on top of the current authentication flow **so that** operators, reviewers, and admins do not all have the same write permissions.
- **As a** facility operator, **I want** password reset and account self-service **so that** the sign-in flow is maintainable without manual Firebase console intervention.
- **As a** grower, **I want** push or email alerts when tray status is **alert** **so that** I do not have to keep the app open.

---

*Last aligned with repo capabilities described in [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) and [CV_PIPELINE.md](./CV_PIPELINE.md).*
