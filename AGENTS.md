# AGENTS.md

Notes for AI agents working in this repo. Trust code + config over prose (see "Stale docs" at the bottom).

## Layout

- pnpm workspace (pnpm pinned at `pnpm@12.3.4` in root `package.json`): `admin/` and `landing/` — both React 19 + Vite + Tailwind v4 + TypeScript, linted with **oxlint** (no ESLint/Prettier, no `format` script exists).
- `api/` is a separate Go module (`warta.com/api`): Fiber v3 + pgx/v5, **no ORM**. Everything lives in `api/internal/<domain>/`; entrypoint is `api/server.go` (run with `go run .` from `api/`).
- `docs/` holds the specs the code comments cite as `§<n>`: `api/openapi.yaml` (contract), `api/api-guidelines.md` (conventions), `api/api-requirements.md` (business rules), `database/database-design.md` (schema + migration milestones M1–M9). Precedence (api-guidelines §1.4): `openapi.yaml` > guidelines > requirements.
- `TASK.md` is the endpoint tracker — work its remaining tasks there and keep its checked state current.

## Commands

- DB: `docker compose up -d db` → Postgres 16 on **host port 5433** (mapped to dodge a host Postgres on 5432).
- API (env vars documented in `.env.example`; `JWT_SECRET` required — server fails fast without it):
  ```bash
  cd api
  DATABASE_URL=postgres://warta:warta@localhost:5433/warta?sslmode=disable \
  JWT_SECRET=$(openssl rand -base64 48) WARTA_SEED=1 go run .
  ```
  Listening on `:3000` (config: `API_PORT`). Migrations run automatically at startup — there is **no migrate/seed CLI**. `WARTA_SEED=1` seeds 3 dev citizens (password `warta-dev-2026`) only when the users table is empty.
- Frontends (from repo root): `pnpm dev` (admin, Vite default port 5173), `pnpm dev:landing` (landing, pinned 5174 + `strictPort`), `pnpm -r lint` (oxlint), `pnpm build` (runs `tsc -b` per app — the only typecheck; there is no separate `typecheck` script).
- Go tests: `cd api && go test ./...` — all handler tests run the Fiber stack with in-memory stores; **no Postgres/Docker needed**.

## API patterns to follow

- Each domain package defines a `Store` interface plus two implementations: `pg_store.go` (wired in `server.go`'s `wire()`) and `mem_store.go` (used by tests). New endpoints: extend the interface and **update both stores**, then test against the memory variants.
- Envelope helpers live in `api/internal/httpx`: success `{ data }` (paginated adds `meta`), error `{ error: { code, message, details[] } }`. Error-code catalogue is in api-guidelines; never hand-roll a response body.
- Enums are lowercase Indonesian (`menunggu`, `terverifikasi`, `setuju`/`tidak_setuju`); money is a decimal **string** (`"516020000000.00"`); timestamps ISO 8601 UTC at second precision (`httpx.ISO8601`).
- Rate limits are env-driven: login 10/min/IP, register 5/h/IP, resend-verification 3/h **per account** (keyed after the Bearer middleware — order matters in route wiring).
- Migrations: `api/internal/db/migrations/<NNNNNN>_<name>.up.sql` + a matching `.down.sql` (both mandatory — the server refuses to boot with an incomplete pair). Name carries the milestone, e.g. `000003_m2_procurement`.
- `SMTP_HOST` unset ⇒ console mailer: verification links (`MAIL_VERIFY_BASE_URL?token=<raw>`) print to the server log — grab them there during local testing.

## Frontend state

- Both apps currently render local mock data from `src/data/wartaData.ts`, hidden by default. Toggle with `VITE_SAMPLE_DATA=1` in the app's `.env.local` or `?sample=1` URL param.
- The axios client (`src/services/api.ts`, base URL from `VITE_API_URL`, default `http://localhost:3000/api`) exists but no component calls it yet — until endpoints land, UI work is against the mocks, not the live API.

## Git & PR

- Never commit to `main`; branch names use the commit-type prefix (`feat/`, `fix/`, `impr/`, ...).
- PR titles MUST be Conventional Commits — the squash merge keeps only the PR title on `main`. House types include `impr` (improvement) alongside the standard ones; scopes in `docs/COMMIT_GUIDELINES.md`.
- No CI, no pre-commit, no formatter hooks exist — run `pnpm -r lint && pnpm build` and `cd api && go test ./...` yourself before pushing.

## Stale docs — trust code instead

- Project status (what's implemented vs pending) changes fast: check `TASK.md` and `api/server.go` route list, not `README.md` §Status.
