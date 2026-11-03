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
- Run lint/type-check before pushing:
  ```bash
  # In each app directory
  npm run lint
  npm run typecheck
  ```

### 4. Push and Open PR

```bash
git push origin feat/api-project-map-pins
```

Open a Pull Request against `main`.

**PR Title MUST follow Conventional Commits** (see `docs/commit-guidelines.md`):
```
feat(api): add project map pins endpoint
```

### 5. Review & Merge

- CI runs: lint, type-check, tests.
- At least one approval required.
- **Squash and merge** — the PR title becomes the final commit on `main`.
- Branch is deleted after merge.

---

## Commit Message Guidelines

See [`docs/commit-guidelines.md`](docs/commit-guidelines.md) for the full specification.

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
- PostgreSQL 16+ (or Docker)
- pnpm 9+

### Setup

```bash
# Install dependencies
pnpm install

# Start database (if using Docker)
docker compose up -d db

# Run migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start dev servers
pnpm dev
```

### Project Structure

```
├── admin/          # Admin frontend (React + Vite)
├── landing/        # Public frontend (React + Vite)
├── api/            # Backend API (Hono/Express + Drizzle)
├── docs/           # Documentation
└── package.json    # Workspace root
```

Each app has its own `package.json` and commands.

---

## Coding Standards

- **TypeScript strict mode** — no `any` without justification.
- **ESLint + Prettier** — run `npm run format` before committing.
- **No console.log in production code** — use structured logging.
- **Error handling** — never swallow errors; return typed error responses.
- **Database** — use Drizzle ORM; raw SQL only when necessary.

---

## Testing

```bash
# Unit tests
npm run test

# E2E tests (requires running dev servers)
npm run test:e2e
```

- Write tests for new business logic.
- Test edge cases: validation, auth, concurrency.
- Mock external services (email, object storage).

---

## Documentation

Update docs when you change:
- API endpoints → `docs/api/openapi.yaml`, `docs/api/api-requirements.md`
- Database schema → `docs/database/database-design.md`
- Conventions → `docs/api/api-guidelines.md`

---

## Release Process

1. Version bump in `package.json` (root and apps).
2. `CHANGELOG.md` updated (auto-generated from conventional commits).
3. Tag: `git tag v1.2.0 && git push origin v1.2.0`.
4. CI builds and deploys.

---

## Questions?

Open a GitHub Discussion or ask in the team channel.