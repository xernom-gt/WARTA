# Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for our pull request titles (and commit messages on the master branch). Please follow the guidelines below when naming pull requests.

---

## Type Prefixes

| Type | Purpose |
|------|---------|
| `feat` | A new feature |
| `impr` | An improvement to an existing feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Changes that do not affect the meaning of the code (white space, formatting, missing semi-colons, etc) |
| `refactor` | A code change that neither fixes a bug nor adds a feature, but makes the code easier to read, understand, or improve |
| `perf` | A code change that improves performance |
| `test` | Adding missing tests or correcting existing tests |
| `build` | Changes that affect the build system or external dependencies (example scopes: vite, tsup-node, npm) |
| `ci` | Changes to our CI configuration files and scripts (example scopes: GitHub Workflows) |
| `revert` | Reverts a previous commit |
| `chore` | Other changes that don't apply to any of the above |

---

## Scope Conventions

Use a scope when the change is confined to one domain:

| Scope | Area |
|-------|------|
| `api` | API routes, handlers, OpenAPI |
| `db` | Migrations, schema, seeds |
| `auth` | Registration, login, tokens, verification |
| `projects` | Project CRUD, tenders, locations, risk flags |
| `reports` | Reports, media, evidence |
| `verification` | Queue, votes, consensus |
| `landing` | Public frontend |
| `admin` | Admin frontend |
| `ui` | Shared UI components |
| `ci` | GitHub Actions, workflows |
| `deps` | Dependency updates |

Omit scope for cross-cutting changes.

---

## Format

```
<type>(<scope>): <short summary>

<body>

<footer>
```

**Header** (required): imperative mood, lowercase, no period, ≤50 chars.

**Body** (optional): wrap at 72 chars. Explain *why* and *context*, not *what* (the diff shows what).

**Footer** (optional): `Closes #123`, `Refs #456`, `Co-authored-by: Name <email>`, `BREAKING CHANGE: ...`

---

## Breaking Changes

Two equivalent forms:

1. `feat(api)!: migrate to v2 endpoints`
2. Footer: `BREAKING CHANGE: contract_amount now returns string, not number`

Both trigger a major version bump.

---

## Revert Format

```
revert: feat(api): add project map pins endpoint

This reverts commit abc1234.
```

---

## PR Title Policy

- PR title **MUST** follow Conventional Commits.
- Squash merge uses the PR title as the final commit message on `main`.
- Feature branch commits can be informal; they are discarded on squash.

---

## Examples

| Type | Example |
|------|---------|
| `feat` | `feat(api): add project map pins endpoint` |
| `feat` | `feat(auth): add email verification resend endpoint` |
| `impr` | `impr(reports): reduce media upload latency by streaming to S3` |
| `fix` | `fix(api): handle null contract_amount in project detail` |
| `fix` | `fix(verification): prevent vote after item resolved` |
| `docs` | `docs(db): add migration M9 verification hardening notes` |
| `refactor` | `refactor(projects): extract location view into shared query` |
| `perf` | `perf(api): add partial index on verification_items(status)` |
| `test` | `test(reports): add submit validation edge cases` |
| `build` | `build(deps): upgrade Drizzle ORM to 0.30` |
| `ci` | `ci: add commitlint check on PR title` |
| `chore` | `chore: remove unused eslint config` |
| `revert` | `revert: feat(api): add project map pins endpoint` |

---

## What to Avoid

- No emojis in headers.
- No "WIP", "fix bug", "update", "changes".
- No vague scopes: `fix(misc): ...` — pick a real scope or omit.
- No period at end of header.
- Header >50 chars (soft limit).
