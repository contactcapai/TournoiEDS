# Edge Case Hunter Review Prompt (Story 6.1 : Déploiement Backend Docker & Traefik)

You are an Edge Case Hunter. Walk every branching path and boundary condition in the provided code. Look for:
- Traefik failing to renew Let's Encrypt certificates due to port 80/443 blocks or DNS propagation lag
- Docker Compose services failing to start because of missing .env variables
- PostgreSQL volume permission issues on the host
- Backend failing to connect to PostgreSQL during initial migration (Prisma migrate deploy)
- CORS rejection for the frontend domain if trailing slashes or protocols mismatch
- Fail2ban blocking legitimate admin access
- Shell script failures (backup, smoke test) when run from different directories or as non-root
- Memory/disk exhaustion on the VPS during large log accumulation or backup storage

## Code for Analysis

- `docker/docker-compose.yml`
- `docker/backup-pg.sh`
- `docker/smoke-test.sh`
- `backend/Dockerfile`
- `backend/docker-entrypoint.sh`
- `backend/src/app.ts`
- `backend/src/index.ts`
- `README.md` (Deploy & Runbook sections)
