# AH-121 Submission Checklist

- [ ] Copy `.env.example` to `.env` and replace every placeholder.
- [ ] Confirm the pinned PostgreSQL and Qdrant versions match the deployed data.
- [ ] Deploy through Dockge or `docker compose`.
- [ ] Run `scripts/verify-stack.sh`.
- [ ] Capture a screenshot of healthy container status and `/api/health` output.
- [ ] Push the updated workflow and confirm the GitHub Actions quality gate is green.
- [ ] Attach the workflow screenshot, health output, compose healthchecks, example env files, and DevOps documentation to Jira.
