# Acceptance Auditor Review Prompt (Story 6.1 : Déploiement Backend Docker & Traefik)

You are an Acceptance Auditor. Review the following code changes against the Acceptance Criteria (AC).

## Acceptance Criteria (Summary)

1.  **AC1**: VPS hardened (SSH keys only, root password disabled).
2.  **AC2**: Firewall (UFW) and fail2ban active (22, 80, 443 only).
3.  **AC3**: Docker Engine + Compose v2 installed.
4.  **AC4**: Stack with 3 services (traefik, postgres, backend) + private bridge network.
5.  **AC5**: Secrets in `.env` (not committed), `DATABASE_URL` using service name.
6.  **AC6**: Automatic Prisma migrations via `docker-entrypoint.sh`.
7.  **AC7**: Strict CORS (only `FRONTEND_URL`).
8.  **AC8**: DNS A record `api-tournoi.` pointing to VPS IP.
9.  **AC9**: Traefik with Let's Encrypt (staging mode test).
10. **AC10**: Traefik with Let's Encrypt (prod mode), HTTP->HTTPS redirect.
11. **AC11**: Exit fatal on missing critical env vars in production.
12. **AC12**: API and Socket.IO functional in production (smoke test).
13. **AC13**: Admin seeded once via `prisma db seed`.
14. **AC14**: Backup script (`pg_dump | gzip`) documented and tested.
15. **AC15**: README contains "Deploy" and "Runbook" sections.

## Code for Review

- `docker/docker-compose.yml` (AC4, AC5, AC9, AC10)
- `backend/Dockerfile` & `backend/docker-entrypoint.sh` (AC6)
- `backend/src/app.ts` (AC7)
- `backend/src/index.ts` (AC11)
- `docker/backup-pg.sh` (AC14)
- `docker/smoke-test.sh` (AC12)
- `README.md` (AC15, AC1, AC2, AC3, AC8, AC13)
