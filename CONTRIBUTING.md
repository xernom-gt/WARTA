# Contributing to WARTA

## Branch Workflow

All development happens on feature branches. **Never commit directly to `main`.**

### 1. Start from `main`

```bash
git checkout main
git pull origin main
```

### 2. Create a Feature Branch

Use a descriptive name with a prefix matching the commit type:

| Prefix | Use For |
|--------|---------|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `impr/` | Improvement |
| `refactor/` | Refactoring |
| `docs/` | Documentation |
| `test/` | Tests |
| `chore/` | Maintenance |

**Format:** `<prefix>/<short-description>`

```bash
# Examples
git checkout -b feat/api-project-map-pins
git checkout -b fix/verification-vote-after-resolved
git checkout -b impr/reports-media-upload-streaming
git checkout -b docs/db-migration-M9-notes
```

### 3. Develop

- Make small, focused commits.
- Commit messages on feature branches can be informal.
- Run lint and the type-check (part of build) before pushing:
  ```bash
  # From the repo root
  pnpm -r lint      # oxlint
  pnpm build        # runs tsc -b per app — the only typecheck
  cd api && go test ./...
  ```

### 4. Push and Open PR

```bash
git push origin feat/api-project-map-pins
```

Open a Pull Request against `main`.

**PR Title MUST follow Conventional Commits** (see `docs/COMMIT_GUIDELINES.md`):
```
feat(api): add project map pins endpoint
```

### 5. Review & Merge

- No CI exists — run lint, type-check, and tests yourself before pushing.
- At least one approval required.
- **Squash and merge** — the PR title becomes the final commit on `main`.
- Branch is deleted after merge.

---

## Commit Message Guidelines

See [`docs/COMMIT_GUIDELINES.md`](docs/COMMIT_GUIDELINES.md) for the full specification.

Quick reference:

```
<type>(<scope>): <summary>

<body>

<footer>
```

**PR title = final commit message.** Feature branch commits are discarded on squash.

---

## Local Development

### Prerequisites

- Node.js 20+
- Go 1.26+
- Docker (PostgreSQL 16 via `docker compose up -d db`, host port 5433)
- pnpm 12.3.4 (pinned via `packageManager` in root `package.json`)

### Setup

```bash
# Install dependencies
pnpm install

# Start database
docker compose up -d db

# Start the API (migrations run automatically at startup;
# WARTA_SEED=1 seeds 3 dev citizens when the users table is empty)
cd api
DATABASE_URL=postgres://warta:warta@localhost:5433/warta?sslmode=disable \
JWT_SECRET=$(openssl rand -base64 48) WARTA_SEED=1 go run .

# Start frontends (from the repo root)
pnpm dev           # admin (Vite, port 5173)
pnpm dev:landing   # landing (Vite, port 5174)
```

Env vars are documented in `.env.example`.

### Project Structure

```
├── admin/          # Admin frontend (React 19 + Vite + Tailwind v4)
├── landing/        # Public frontend (React 19 + Vite + Tailwind v4)
├── api/            # Backend API (Go + Fiber v3 + pgx/v5, no ORM)
├── docs/           # OpenAPI contract, guidelines, DB design
└── package.json    # pnpm workspace root
```

Each app has its own `package.json` and commands.

---

## Coding Standards

- **TypeScript** — keep `pnpm build` green (`tsc -b` runs `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`); avoid `any`.
- **Linting** — oxlint via `pnpm -r lint`; no ESLint or Prettier (no formatter hooks exist).
- **No console.log in production code** — use structured logging.
- **Error handling** — never swallow errors; render the `httpx` envelope (`{ error: { code, message, details[] } }`).
- **Database** — raw SQL through pgx/v5; schema changes go in paired `.up.sql`/`.down.sql` migrations under `api/internal/db/migrations/`.

---

## Testing

```bash
# API tests (handler tests run the Fiber stack with in-memory stores;
# no Postgres/Docker needed)
cd api && go test ./...
```

- Write tests for new business logic.
- Test edge cases: validation, auth, rate limits, business rule conflicts.
- Mock external services (email, object storage).
- No frontend test runner or E2E suite exists yet.

---

## Documentation

Update docs when you change:
- API endpoints → `docs/api/openapi.yaml`, `docs/api/api-requirements.md`
- Database schema → `docs/database/database-design.md`
- Conventions → `docs/api/api-guidelines.md`

---

## Release Process

Not formalized yet — there is no CI/CD pipeline, `CHANGELOG.md`, or release
script. Releases are manual: bump versions in `package.json` (root and apps)
if needed and tag from `main`.

---

## Questions?

Open a GitHub Discussion or ask in the team channel.