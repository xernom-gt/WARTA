# API Implementation Tasks

Organized by resource. Each endpoint is a task. Check off when implemented, tested, and documented.

---

## 🔐 Auth & User Profile

### Auth Endpoints
- [ ] `POST /auth/register` — Create account, hash password, send verification email, return private profile
- [ ] `POST /auth/login` — Verify credentials, issue JWT (3600s), return token + private profile
- [ ] `POST /auth/verify-email` — Consume single-use token, set `email_verified_at`, return private profile
- [ ] `POST /auth/resend-verification` — Authenticated, invalidate old token, send new (3/hr limit), return 204
- [ ] `POST /auth/logout` — Revoke current token (blocklist or short expiry), return 204
- [ ] `GET /auth/me` — Return private profile (only endpoint exposing `email`)

### User Profile Endpoints
- [ ] `PATCH /users/me` — Update `display_name` (unique, 3-24 chars, alphanum + underscore)
- [ ] `DELETE /users/me` — Set `is_active = false`, return 204
- [ ] `GET /users/me/reports` — Paginated list of caller's reports (filter: status)
- [ ] `GET /users/me/claims` — Paginated list of caller's location claims (filter: status)
- [ ] `GET /users/me/votes` — Paginated vote history with current resolution per item
- [ ] `GET /users/{user_id}` — Public profile only (`id`, `display_name`, `is_active`, `created_at`)

### Auth Infrastructure
- [ ] JWT signing/verification (HS256 or RS256)
- [ ] Token blocklist or short expiry + refresh strategy
- [ ] Password hashing (bcrypt/argon2, 72-byte limit)
- [ ] Email verification token: generate, hash, store in `auth_tokens`, 24hr expiry, single-use
- [ ] Rate limiting: login (5/min), register (3/min), resend-verification (3/hr)
- [ ] `X-Request-Id` middleware (generate or pass through)

---

## 📦 Projects

### Core Project Endpoints
- [ ] `GET /projects` — List with filters: `q`, `category`, `city`, `status`, `year`, `precision_level`, `is_outside_dki`, `is_retender`, `sort`, `page`, `limit`; returns project summaries with derived fields; `ETag` support
- [ ] `GET /projects/{project_id}` — Full detail with embedded: `tenders`, `sub_locations`, `risk_flags`, `location` (primary), derived fields
- [ ] `GET /projects/map` — Lightweight pins: `bbox` required, optional `status`, `category`; returns `id`, `title`, `lat`, `lng`, `precision_level`, `status`, `category`

### Project Sub-resources (Read-only)
- [ ] `GET /projects/{project_id}/tenders` — History ordered by `created_at` asc
- [ ] `GET /projects/{project_id}/locations` — Primary + sub-locations with `is_primary`, `is_verified`
- [ ] `GET /projects/{project_id}/risk-flags` — Active flags (`code`, `label`, `level`, `description`)
- [ ] `GET /projects/{project_id}/reports` — Submitted reports only (filter: `status`, `category`, `author`, pagination)
- [ ] `GET /projects/{project_id}/location-claims` — Claims (filter: `status`, `author`, pagination)
- [ ] `GET /projects/{project_id}/verification-items` — Queue items for project (filter: `status`, `item_type`, pagination)

### Project Derived Fields (compute on read)
- [ ] `pagu_compact`, `pagu_full`, `hps_compact`, `hps_full`, `kontrak_compact`, `kontrak_full`
- [ ] `contract_available` (boolean)
- [ ] `is_retender` (from failed tender existence)
- [ ] `precision_badge` (display label for precision_level)
- [ ] `years` array from `project_years`
- [ ] `reports_count`, `verifications_count`

### Project Data Integrity
- [ ] `contract_amount` stays `null` when unpublished (never `"0.00"`)
- [ ] `search_vector` GIN index for full-text search
- [ ] `pg_trgm` index on `title` for fuzzy fallback

---

## 📝 Reports & Evidence

### Report CRUD
- [ ] `POST /projects/{project_id}/reports` — Create draft (`submit: false`) or submit (`submit: true`); validate submit requirements; set `user_id` from auth; compute `distance_from_project`
- [ ] `GET /reports/{report_id}` — Full detail with `media`, `evidences_count`, `distance_from_project_m`, `exif_status`, `exif_notice`
- [ ] `PATCH /reports/{report_id}` — Author-only, draft-only; mutable: `category`, `narrative`, `proposed_address`, `latitude`, `longitude`
- [ ] `DELETE /reports/{report_id}` — Author-only; draft = hard delete; `menunggu` = soft delete (`deleted_at`), close verification item, retain media/votes
- [ ] `POST /reports/{report_id}/submit` — Author-only; draft→`menunggu`; set `submitted_at`; create `verification_items` row (`laporan_kondisi`); validate: category, address, narrative 20-500, ≥1 photo

### Report Media
- [ ] `GET /reports/{report_id}/media` — List photos ordered by `sort_order`
- [ ] `POST /reports/{report_id}/media` — `multipart/form-data` (`file`, `sort_order` 0-3); max 4 photos, 5MB each, JPEG/PNG/WebP; server extracts EXIF, stores to object storage, returns media row
- [ ] `DELETE /reports/{report_id}/media/{media_id}` — Author-only, draft-only; remove from object storage

### Evidence
- [ ] `GET /reports/{report_id}/evidences` — List additional evidence
- [ ] `POST /reports/{report_id}/evidences` — Any authenticated citizen; `description` required; no verification item created
- [ ] `GET /evidences/{evidence_id}` — Single evidence entry
- [ ] `GET /evidences/{evidence_id}/media` — List evidence photos
- [ ] `POST /evidences/{evidence_id}/media` — Author upload evidence photo
- [ ] `DELETE /evidences/{evidence_id}/media/{media_id}` — Author delete (while evidence not "reviewed" — clarify rule)

---

## 📍 Location Claims

- [ ] `POST /projects/{project_id}/location-claims` — Create claim (`status: menunggu`); validate `address_line` required unless precision `kecamatan`/`desa/kelurahan`; compute `distance_from_project`; enqueue as `klaim_lokasi`; 409 if project already has accepted claim
- [ ] `GET /location-claims/{claim_id}` — Full claim detail
- [ ] `GET /location-claims/{claim_id}/media` — Return claim photo (max 1)
- [ ] `POST /location-claims/{claim_id}/media` — Author upload (1 photo, 5MB, JPEG/PNG/WebP)
- [ ] `DELETE /location-claims/{claim_id}/media/{media_id}` — Author delete while `menunggu`

---

## ✅ Verification & Votes

### Queue
- [ ] `GET /verification-items` — Unified queue (all projects); filters: `status`, `item_type`, `project_id`; default sort `created_at` asc; excludes deactivated authors & withdrawn reports; `ETag`
- [ ] `GET /verification-items/{item_id}` — Single item with report/claim detail, author, first photo, vote counts, voter display names
- [ ] `GET /verification-items/{item_id}/votes` — Paginated votes for item

### Voting
- [ ] `POST /verification-items/{item_id}/votes` — `{ "choice": "setuju" | "tidak_setuju" }`; authenticated; 1 vote per user per item; author cannot vote; immutable; atomically increment `votes_agree`/`votes_disagree`; resolve at `target_votes` (default 3): agree→`terverifikasi`/`diterima`, disagree→`ditolak`; accepted claim creates primary location (`source: warga`); return vote row with `created_at`

---

## 🏗 Infrastructure & Cross-Cutting

### Database
- [ ] Migrations M1-M9 (see `docs/database/database-design.md` §9.2)
- [ ] Indexes per §7 (partial indexes for `deleted_at IS NULL`, `status = 'menunggu'`)
- [ ] Triggers: `updated_at`, `search_vector` generation, vote counters, project status rollup
- [ ] Seed data for local dev (8 projects, 3 citizens, 3 verification items, vote history)

### API Conventions
- [ ] Response envelope: `{ data: ... }` / `{ data: [], meta: { page, limit, total, has_next } }` / `{ error: { code, message, details[] } }`
- [ ] Status codes per guidelines (200, 201+Location, 204, 304, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503)
- [ ] Error codes: `validation_failed`, `invalid_credentials`, `token_expired`, `account_inactive`, `email_not_verified`, `email_already_verified`, `not_found`, `conflict`, `self_vote_forbidden`, `already_voted`, `item_resolved`, `photo_limit_reached`, `file_too_large`, `unsupported_media_type`, `rate_limited`, `internal_error`, `service_unavailable`
- [ ] Money as decimal string (`"516020000000.00"`), never float
- [ ] Timestamps ISO 8601 UTC (`Z`)
- [ ] Enum values canonical lowercase (`menunggu`, `terverifikasi`, `fisik_rusak`, etc.)
- [ ] `ETag` on cacheable GETs (hash or version)
- [ ] `X-Request-Id` on every response
- [ ] `Retry-After` on 429/503

### Validation
- [ ] Request validation before any write (Zod/Valibot/Arktype)
- [ ] Collect all field errors, return together (`details[]`)
- [ ] UUID validation: 400 malformed, 404 not found
- [ ] Pagination: default limit 20, max 100 (clamp, not reject)
- [ ] Sort: `sort=field` / `sort=-field`

### File Upload
- [ ] Object storage integration (S3/R2/MinIO)
- [ ] Presigned URL or direct upload handler
- [ ] EXIF extraction (lat, lng, taken_at, geotag validity)
- [ ] MIME validation (JPEG, PNG, WebP only)
- [ ] Size limit 5MB

### Email
- [ ] Verification email template (token link, 24hr expiry)
- [ ] Resend verification (rate limited)
- [ ] Token hash storage, single-use, invalidate on reissue

### OpenAPI Sync
- [ ] Keep `docs/api/openapi.yaml` in sync with implementation
- [ ] All `components/schemas` defined and referenced
- [ ] Generate TypeScript types for frontends

---

## ✅ Definition of Done per Endpoint

- [ ] Handler implemented with validation
- [ ] Unit tests: success, auth failures, validation errors, business rule conflicts
- [ ] Integration test: full request/response cycle
- [ ] OpenAPI schema matches implementation
- [ ] Response envelope correct
- [ ] Error codes match catalogue
- [ ] `ETag`/`X-Request-Id` headers present
- [ ] Rate limiting applied where specified
- [ ] Documentation updated (if new patterns)

---

## 📋 Suggested Implementation Order

1. **Auth & User** — Foundation for all authenticated endpoints
2. **Projects (read)** — Public catalog, detail, map pins
3. **Reports (CRUD + media)** — Core citizen feature
4. **Location Claims** — Simpler than reports
5. **Verification & Votes** — Depends on reports/claims
6. **Evidence** — Add-on to reports
7. **Project sub-resources** — Tenders, locations, risk flags, queue views
8. **Polish** — ETags, rate limits, OpenAPI sync, seed data