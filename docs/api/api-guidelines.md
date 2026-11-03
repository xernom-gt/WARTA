# API Guidelines

**Project:** WARTA  
**Document Version:** 1.0  
**Status:** Draft  
**Date:** 3 November 2026  
**Applies to:** `/api/v1`  
**Related documents:** `docs/api/api-requirements.md`, `docs/api/openapi.yaml`

---

## 1. Introduction

### 1.1 Purpose

This document defines the conventions every WARTA API endpoint must follow.

It covers three areas:

1. **Naming conventions** — URLs, parameters, fields, enums, and headers.
2. **Response formats** — envelopes, data types, pagination, and headers.
3. **Error handling** — error shapes, codes, status mapping, and client behavior.

The goal is a single predictable contract so that frontend, backend, and test code do not invent local conventions.

### 1.2 Scope

These rules apply to every endpoint under `/api/v1`, including future endpoints added within the same major version.

They do not apply to:

- Static assets served outside the API prefix.
- Object storage URLs returned by the API.
- Internal import jobs that never receive HTTP traffic.

### 1.3 Normative Language

| Term | Meaning |
|---|---|
| **MUST** | Mandatory. A deviation is a contract violation. |
| **MUST NOT** | Forbidden. |
| **SHOULD** | Recommended. A deviation needs a documented reason. |
| **MAY** | Optional. |

### 1.4 Source of Truth

When documents disagree, precedence is:

1. `openapi.yaml` for the machine-readable contract.
2. This document for conventions and behavior.
3. `api-requirements.md` for scope and business rules.

---

## 2. Naming Conventions

### 2.1 Resource Names

- Resource collections are **plural nouns**: `/projects`, `/reports`, `/users`.
- Resource names are **kebab-case** when they contain multiple words: `/location-claims`, `/verification-items`, `/risk-flags`.
- Resource names are **lowercase**.
- Resource names **MUST NOT** contain verbs, file extensions, or trailing slashes.
- Resource names **MUST** match the domain language used in the database and UI.

| Good | Bad | Why |
|---|---|---|
| `/projects` | `/project` | Collections are plural. |
| `/location-claims` | `/locationClaims` | URLs are kebab-case. |
| `/verification-items` | `/verification_items` | Underscores are reserved for JSON fields. |
| `/reports/{report_id}` | `/reports/{id}` | Parameter names are explicit. |
| `/projects/{project_id}/risk-flags` | `/getProjectRiskFlags` | No verbs in resource paths. |

### 2.2 URL Structure

```
/{version}/{collection}
/{version}/{collection}/{resource_id}
/{version}/{collection}/{resource_id}/{sub_collection}
```

Rules:

- The version prefix is always the first path segment: `/api/v1`.
- Nesting **MUST NOT** exceed two resource levels.
- A sub-collection is used only when the child cannot exist without the parent.
- A resource that has its own identity **SHOULD** also be reachable at the top level.

Examples:

| Pattern | Valid | Reason |
|---|---|---|
| `/projects/{project_id}/reports` | Yes | Reports are scoped to a project. |
| `/reports/{report_id}` | Yes | A report is independently addressable. |
| `/projects/{project_id}/reports/{report_id}/evidences` | No | Exceeds two levels. Use `/reports/{report_id}/evidences`. |
| `/users/me/reports` | Yes | `me` is a reserved alias for the caller. |

### 2.3 Action Endpoints

CRUD operations **MUST** use HTTP methods, not verbs in the URL.

A verb segment is allowed only when the operation is a state transition that is not expressible as a resource update:

| Endpoint | Why it is an action |
|---|---|
| `POST /reports/{report_id}/submit` | Transitions a draft into the verification queue. |
| `POST /verification-items/{item_id}/votes` | Creates an immutable vote; this is a sub-resource creation. |

Rules:

- Action nouns are lowercase kebab-case.
- The verb **MUST** describe the domain event, not the implementation.
- An action endpoint **MUST** be idempotent or return a clear conflict on repeat.

Forbidden patterns: `/reports/{id}/doSubmit`, `/projects/{id}/getDetail`, `/users/{id}/delete`.

### 2.4 Path Parameters

- Path parameters use `snake_case`: `{project_id}`, `{report_id}`, `{item_id}`.
- Parameter names **MUST** match the field they address.
- IDs are UUIDs. A malformed UUID returns `400`; an unknown UUID returns `404`.
- Reserved aliases: `me` refers to the authenticated caller.

| Good | Bad |
|---|---|
| `{project_id}` | `{projectId}`, `{project-id}`, `{id}` |
| `{verification_item_id}` | `{item}` when the resource is a verification item |

### 2.5 Query Parameters

- Query parameters use `snake_case`: `item_type`, `precision_level`, `is_outside_dki`.
- Names are nouns or adjectives, never verbs: `status`, not `filterByStatus`.
- Boolean parameters accept `true` and `false` only.
- Array parameters repeat the key: `?status=menunggu&status=terverifikasi`.
- Pagination uses `page` and `limit`.
- Sorting uses `sort` with a leading `-` for descending order: `sort=-created_at`.
- Search uses `q`.

### 2.6 JSON Fields

- JSON field names use `snake_case`, matching the database columns.
- Booleans use an `is_`, `has_`, or `can_` prefix: `is_active`, `is_retender`, `has_next`, `is_canonical_claimed`.
- Arrays use plural nouns: `years`, `voters`, `sub_locations`.
- Timestamps end with `_at`: `created_at`, `submitted_at`, `resolved_at`, `decided_at`.
- Counts end with `_count`: `reports_count`, `evidences_count`.
- Derived display values **MUST** be grouped under a `derived` object when there are several of them.
- IDs end with `_id`: `project_id`, `user_id`, `report_id`.

| Good | Bad |
|---|---|
| `display_name` | `displayName`, `display-name`, `name` |
| `is_canonical_claimed` | `canonical`, `claimed` |
| `reports_count` | `reportCount`, `total_reports` |
| `created_at` | `createdAt`, `created`, `timestamp` |

### 2.7 Enum Values

- Enum values are the exact canonical values stored in the database.
- Values are lowercase with underscores for multiword concepts: `belum_mulai`, `lambat_mangkrak`.
- Values containing a slash keep the slash: `kabupaten/kota`, `alamat/ruas`.
- Display labels, icons, and colors **MUST NOT** be sent as enum values.
- Unknown enum values **MUST** be rejected with `422`, never coerced to a default.

| Good | Bad |
|---|---|
| `fisik_rusak` | `Fisik Rusak`, `PHYSICAL_DAMAGE` |
| `menunggu` | `pending`, `PENDING` |
| `setuju` | `agree`, `true` |

### 2.8 Headers

| Header | Direction | Naming | Purpose |
|---|---|---|---|
| `Authorization` | Request | Standard | `Bearer <token>` |
| `Content-Type` | Request | Standard | `application/json` or `multipart/form-data` |
| `Accept` | Request | Standard | `application/json` |
| `If-None-Match` | Request | Standard | Conditional GET |
| `ETag` | Response | Standard | Cache validation |
| `Location` | Response | Standard | URL of a created resource |
| `Retry-After` | Response | Standard | Seconds until a retry is allowed |
| `X-Request-Id` | Both | Custom | Correlation ID |

Custom headers use `X-` with `Pascal-Kebab-Case` segments.

### 2.9 Operation IDs

For OpenAPI tooling, every operation has an `operationId` in `camelCase`:

- `listProjects`, `getProject`, `createReport`, `castVote`.
- The pattern is `<verb><Resource>`.
- Operation IDs are stable; renaming one is a breaking change for generated clients.

### 2.10 Naming Do and Do Not

| Concept | Do | Do not |
|---|---|---|
| Collection | `/projects` | `/project`, `/project-list` |
| Sub-resource | `/projects/{id}/tenders` | `/projectTenders` |
| Field | `contract_amount` | `contractAmount`, `kontrak` |
| Status | `terverifikasi` | `verified`, `VERIFIED` |
| Boolean | `is_outside_dki` | `outsideDki` |
| Money field | `pagu_amount` | `pagu`, `pagu_formatted` (use `derived`) |
| Error code | `photo_limit_reached` | `ERR_409_PHOTO`, `PhotoLimit` |

---

## 3. Response Formats

### 3.1 Media Type

- All responses use `application/json; charset=utf-8`, except `204 No Content`.
- Error responses use the same media type and structure.
- Uploads use `multipart/form-data` on the request only.

### 3.2 Response Envelope

Every success response uses a top-level `data` key.

Single resource:

```json
{
  "data": {
    "id": "5c1c2f7e-8a5e-4f4e-9c1e-3f0b2b7a9d11",
    "display_name": "warga_jakarta",
    "is_active": true,
    "created_at": "2026-11-03T14:05:00Z"
  }
}
```

Collection:

```json
{
  "data": [
    { "id": "…" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 137,
    "has_next": true
  }
}
```

Rules:

- A single resource **MUST NOT** be returned as a bare object at the top level.
- A collection **MUST NOT** be returned as a bare array at the top level.
- `meta` is present on paginated collections and **MUST** contain `page`, `limit`, `total`, and `has_next`.
- `204 No Content` has no body and no envelope.
- Errors never use `data`; they use `error` (Section 4).

### 3.3 Pagination

| Field | Type | Meaning |
|---|---|---|
| `meta.page` | integer | Current page, 1-based. |
| `meta.limit` | integer | Requested page size after clamping. |
| `meta.total` | integer | Total matching rows. |
| `meta.has_next` | boolean | Whether a next page exists. |

- Default `limit` is 20; the maximum is 100.
- A `limit` above 100 is clamped, not rejected.
- A page beyond the last page returns `data: []` with correct `meta`.

### 3.4 Data Types

| Type | Format | Example |
|---|---|---|
| Identifier | UUID string | `"5c1c2f7e-8a5e-4f4e-9c1e-3f0b2b7a9d11"` |
| Timestamp | ISO 8601 UTC with `Z` | `"2026-11-03T14:05:00Z"` |
| Date | `YYYY-MM-DD` | `"2026-11-03"` |
| Money | Decimal string with 2 decimals | `"516020000000.00"` |
| Coordinate | JSON number | `-6.2615` |
| Boolean | JSON boolean | `true` |
| Enum | JSON string | `"menunggu"` |

Rules:

- Money **MUST NOT** be a JSON number. Floating-point serialization loses precision.
- Timestamps **MUST** be UTC. Local offsets are converted at the presentation layer.
- Coordinates are numbers, not strings.
- IDs are strings, never integers.

### 3.5 Null and Empty Values

| Situation | Representation |
|---|---|
| Missing optional string | `null` |
| Empty collection | `[]` |
| Unknown nullable amount | `null` |
| Zero count | `0` |

Rules:

- `contract_amount` **MUST** be `null` when unpublished. It **MUST NOT** be `0`, `"0"`, or `"0.00"`.
- Collections **MUST** serialize as `[]`, never `null`.
- Empty strings **SHOULD NOT** be used to mean "absent".
- A client **MUST** treat a missing nullable field and `null` as equivalent.

### 3.6 Enumerations and Display Text

- The API returns canonical enum values.
- Human-readable labels are returned separately as derived fields when the UI needs them:
  - `category_label` on verification items.
  - `precision_badge` inside `derived`.
  - `status` remains canonical; the client maps it to a label, icon, and color.
- Derived labels are not authoritative. Clients **MUST NOT** parse them.

### 3.7 Derived Fields

- Derived values are grouped under `derived` when a resource has several.
- Derived fields are read-only and **MUST NOT** be accepted on write.
- Derived fields **MUST** be recomputed on every read, not stored.

Examples: `pagu_compact`, `pagu_full`, `hps_compact`, `hps_full`, `kontrak_compact`, `kontrak_full`, `contract_available`, `is_retender`, `precision_badge`.

### 3.8 Embedded Resources

- A detail response **MAY** embed child collections when the client always needs them together: project detail embeds `tenders`, `sub_locations`, and `risk_flags`.
- A list response **SHOULD NOT** embed large child collections.
- An embedded resource uses the same schema as its standalone endpoint.
- The client **MUST NOT** assume embedded collections are paginated; if a collection can grow unbounded, it is exposed as its own endpoint.

### 3.9 Response Headers

| Header | When | Value |
|---|---|---|
| `Content-Type` | Every body | `application/json; charset=utf-8` |
| `ETag` | Cacheable public GET | Opaque entity tag |
| `Location` | `201 Created` | URL of the new resource |
| `X-Request-Id` | Every response | Correlation ID from the request or generated |
| `Retry-After` | `429`, `503` | Seconds |

### 3.10 Status Codes for Success

| Code | Use |
|---|---|
| `200 OK` | Read or update succeeded. |
| `201 Created` | A resource was created. Include `Location`. |
| `204 No Content` | Delete, logout, or deactivation succeeded. No body. |
| `304 Not Modified` | `If-None-Match` matched the current `ETag`. |

The API **MUST NOT** use `200` with an error body, and **MUST NOT** use `202` unless asynchronous processing is actually implemented.

### 3.11 Response Examples

Project summary:

```json
{
  "data": [
    {
      "id": "3b1e9c44-5f7a-4d2e-8b1a-0c6f2d9e4a11",
      "title": "Rehabilitasi Saluran Drainase",
      "spse_code": "40123456",
      "satker": "Dinas Sumber Daya Air Provinsi DKI Jakarta",
      "category": "Drainase & Pengendali Banjir",
      "city": "Jakarta Selatan",
      "pagu_amount": "516020000000.00",
      "hps_amount": "516020000000.00",
      "contract_amount": null,
      "contract_available": false,
      "years": [2025, 2026, 2027],
      "precision_level": "kecamatan",
      "location_source": "SPSE",
      "is_canonical_claimed": false,
      "is_outside_dki": false,
      "is_retender": true,
      "reports_count": 4,
      "verifications_count": 12,
      "status": "menunggu",
      "derived": {
        "pagu_compact": "Rp516,02 miliar",
        "pagu_full": "Rp516.020.000.000",
        "hps_compact": "Rp516,02 miliar",
        "hps_full": "Rp516.020.000.000",
        "kontrak_compact": null,
        "kontrak_full": null,
        "precision_badge": "Kecamatan"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "has_next": false
  }
}
```

Created resource:

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/v1/verification-items/9a7c1e22-6b0d-4f3a-9e2c-1d5b8a0f7c33
```

```json
{
  "data": {
    "id": "9a7c1e22-6b0d-4f3a-9e2c-1d5b8a0f7c33",
    "verification_item_id": "9a7c1e22-6b0d-4f3a-9e2c-1d5b8a0f7c33",
    "user_id": "0f0f0f0f-0000-4000-8000-000000000001",
    "choice": "setuju",
    "created_at": "2026-11-03T14:05:00Z"
  }
}
```

---

## 4. Error Handling

### 4.1 Error Envelope

Every error response uses this shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "One or more fields are invalid.",
    "details": [
      {
        "field": "narrative",
        "message": "Must be between 20 and 500 characters."
      }
    ]
  }
}
```

Rules:

- `error.code` is a stable machine-readable string. Clients branch on it.
- `error.message` is human-readable and safe to display.
- `error.details` is present for validation errors and **MUST** list every failing field.
- Error responses **MUST NOT** contain `data`.
- Error responses **MUST NOT** contain stack traces, SQL, storage keys, or internal hostnames.

### 4.2 Error Code Catalogue

| Code | HTTP | Meaning |
|---|---|---|
| `validation_failed` | 422 | One or more fields are invalid. |
| `invalid_credentials` | 401 | Email or password is wrong. |
| `token_expired` | 401 | The access token has expired. |
| `account_inactive` | 403 | The account is deactivated. |
| `email_not_verified` | 403 | A content write was attempted before the email address was verified. |
| `email_already_verified` | 409 | The email address is already verified. |
| `not_found` | 404 | The resource does not exist. |
| `conflict` | 409 | A generic state or uniqueness conflict. |
| `self_vote_forbidden` | 403 | The author tried to vote on their own item. |
| `already_voted` | 409 | The citizen already voted on this item. |
| `item_resolved` | 409 | The verification item is already resolved. |
| `photo_limit_reached` | 409 | The report or claim photo limit was reached. |
| `file_too_large` | 413 | The uploaded file exceeds 5 MB. |
| `unsupported_media_type` | 415 | The upload is not an accepted image type. |
| `rate_limited` | 429 | The request rate was exceeded. |
| `internal_error` | 500 | An unexpected server fault occurred. |
| `service_unavailable` | 503 | A dependency is unavailable. |

### 4.3 Validation Errors

- `details` **MUST** include one entry per failing field.
- `details[].field` uses the JSON field name, with dot notation for nested objects: `location.latitude`.
- For query parameters, the field name is the parameter name: `limit`, `year`.
- Messages describe the fix, not the implementation: "Must be between 20 and 500 characters."
- Validation **MUST** run before any write.
- Multiple errors are returned together; the API **MUST NOT** stop at the first failure.

Example:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "narrative", "message": "Must be between 20 and 500 characters." },
      { "field": "latitude", "message": "Latitude and longitude must both be present or both be null." },
      { "field": "category", "message": "Required when submitting a report." }
    ]
  }
}
```

### 4.4 HTTP Status Mapping

| Status | When to use | When not to use |
|---|---|---|
| `400 Bad Request` | Malformed JSON, malformed UUID in a path. | Field-level validation, which is `422`. |
| `401 Unauthorized` | Missing, expired, or invalid token. | Permission failures, which are `403`. |
| `403 Forbidden` | Authenticated but not allowed, account inactive, or email not verified. | Missing token, which is `401`. |
| `404 Not Found` | The resource does not exist. | A resource that exists but is hidden; use `404` only when disclosure is safe. |
| `409 Conflict` | Duplicate vote, duplicate name/email, already verified email, photo limit, edit or delete after a verdict, resolved item. | Validation errors, which are `422`. |
| `413 Payload Too Large` | Upload exceeds 5 MB. | Body JSON exceeding a generic limit; prefer `400` or `413` consistently. |
| `415 Unsupported Media Type` | Upload is not JPEG, PNG, or WebP. | Missing `Content-Type` on JSON; that is `400`. |
| `422 Unprocessable Entity` | Syntactically valid but semantically invalid. | Malformed JSON, which is `400`. |
| `429 Too Many Requests` | Rate limit exceeded. Include `Retry-After`. | Business-level throttling; still `429` if time-based. |
| `500 Internal Server Error` | Unhandled server fault. | Expected conflicts. |
| `503 Service Unavailable` | Database or object storage unavailable. | Validation or auth failures. |

### 4.5 Security of Error Responses

- `401` **MUST NOT** reveal whether an email exists.
- `403` **MUST NOT** reveal the existence of resources the caller cannot access.
- `404` **MUST NOT** distinguish between "never existed" and "not visible to you".
- Internal identifiers, SQL fragments, and file paths **MUST NOT** appear in any error.
- Validation messages **MUST NOT** echo secrets or full request bodies.

### 4.6 Conflict Handling

Conflicts are expected outcomes and must be modeled, not treated as server errors.

| Scenario | Status | Code | Client action |
|---|---|---|---|
| Duplicate display name or email | `409` | `conflict` | Prompt for another value. |
| Content write before email verification | `403` | `email_not_verified` | Prompt the user to verify, then offer resend. |
| Verifying an already verified address | `409` | `email_already_verified` | Skip verification and continue. |
| Deleting a report after a verdict | `409` | `conflict` | Explain that resolved reports are part of the public record. |
| Duplicate vote | `409` | `already_voted` | Show the existing vote state. |
| Self-vote | `403` | `self_vote_forbidden` | Explain the ownership rule. |
| Vote after resolution | `409` | `item_resolved` | Refresh the item. |
| Fifth report photo | `409` | `photo_limit_reached` | Explain the limit. |
| Editing a submitted report | `409` | `conflict` | Reload the report. |
| Second accepted claim | `409` | `conflict` | Show the accepted location. |

Rules:

- The server **MUST** decide conflicts using database constraints, not only pre-checks.
- The client **SHOULD** refresh the affected resource after a `409`.
- Repeated identical writes **MUST** return the same conflict, not create duplicates.

### 4.7 Retry Semantics

| Condition | Retry? | Guidance |
|---|---|---|
| `429` | Yes | Wait for `Retry-After`. |
| `503` | Yes | Exponential backoff with jitter. |
| `500` | Conditional | Retry only idempotent requests, with backoff. |
| `401` | No | Re-authenticate first. |
| `403` | No | Fix permissions or ownership. |
| `404` | No | Fix the request. |
| `409` | No | Resolve the conflict first. |
| `422` | No | Fix the payload. |

- `GET`, `PUT`, and `DELETE` are idempotent by contract.
- `POST` is not idempotent. Clients **MUST NOT** retry `POST /votes`, `POST /reports`, or `POST /location-claims` blindly.
- A retried `POST` that hit the server returns a `409`; clients **SHOULD** treat that as success only when the intended state matches.

### 4.8 Request IDs and Logging

- Every response includes `X-Request-Id`.
- If the client sends `X-Request-Id`, the server reuses it; otherwise it generates one.
- Logs include the request ID, method, path, status, latency, and actor ID when authenticated.
- Logs **MUST NOT** include passwords, tokens, email addresses, or full auth bodies.
- When reporting a failure, clients **SHOULD** include `X-Request-Id`.

### 4.9 Client Error Handling

Clients **SHOULD**:

1. Branch on `error.code`, not on `error.message`.
2. Render `details` next to the matching form fields.
3. Fall back to `error.message` for unknown codes.
4. Never retry non-idempotent writes automatically.
5. Surface `X-Request-Id` in support flows.

---

## 5. Request Conventions

### 5.1 HTTP Methods

| Method | Semantics | Body | Idempotent |
|---|---|---|---|
| `GET` | Read | No | Yes |
| `POST` | Create or action | Yes | No |
| `PATCH` | Partial update | Yes | No |
| `PUT` | Full replace | Yes | Yes |
| `DELETE` | Remove | No | Yes |

- `PATCH` is used for partial updates such as editing a draft report.
- `PUT` is reserved for full replacement and is not currently used.
- `DELETE` on an already-deleted resource returns `404` or `204` consistently per resource.

### 5.2 Authentication

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
```

- Tokens are never accepted from query strings or request bodies.
- Public endpoints ignore an `Authorization` header if present.
- A write without a token returns `401`.

### 5.3 Content Negotiation

- Requests with an unsupported `Content-Type` return `415`.
- A missing `Content-Type` on a JSON request returns `400`.
- `Accept: application/json` is assumed when omitted.
- The API does not support XML, form-encoded JSON, or JSON:API.

### 5.4 Field Updates

- `PATCH` accepts only mutable fields. Unknown fields are ignored or rejected consistently; WARTA rejects them with `422`.
- `null` explicitly clears a nullable field.
- Omitting a field leaves it unchanged.
- Read-only fields (`id`, `created_at`, `updated_at`, `status`, counters) are rejected on write.

### 5.5 Uploads

- Uploads use `multipart/form-data` with a `file` part.
- One file per request. Multiple files require multiple requests.
- The server validates MIME type and size before storing.
- EXIF metadata is extracted by the server; client-provided EXIF values are ignored.

---

## 6. Examples

### 6.1 Request and Response Pair

```http
POST /api/v1/projects/3b1e9c44-5f7a-4d2e-8b1a-0c6f2d9e4a11/reports
Authorization: Bearer <token>
Content-Type: application/json
X-Request-Id: 6f1c2a90-3e4b-4c7d-8a91-2b5e0d7c4f11
```

```json
{
  "category": "fisik_rusak",
  "narrative": "Papan proyek sudah tidak ada dan bekas cor beton retak di beberapa titik.",
  "proposed_address": "Jl. Contoh No. 10, Kelurahan Contoh",
  "latitude": -6.2615,
  "longitude": 106.8106,
  "exif_status": "valid",
  "submit": false
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/v1/reports/8d2f1a44-9c3b-4e5f-8a1d-7b6c0e2f9a33
X-Request-Id: 6f1c2a90-3e4b-4c7d-8a91-2b5e0d7c4f11
```

```json
{
  "data": {
    "id": "8d2f1a44-9c3b-4e5f-8a1d-7b6c0e2f9a33",
    "project_id": "3b1e9c44-5f7a-4d2e-8b1a-0c6f2d9e4a11",
    "user_id": "0f0f0f0f-0000-4000-8000-000000000001",
    "author_display_name": "warga_jakarta",
    "category": "fisik_rusak",
    "narrative": "Papan proyek sudah tidak ada dan bekas cor beton retak di beberapa titik.",
    "proposed_address": "Jl. Contoh No. 10, Kelurahan Contoh",
    "latitude": -6.2615,
    "longitude": 106.8106,
    "distance_from_project_m": 38.4,
    "exif_status": "valid",
    "exif_notice": null,
    "status": "draft",
    "created_at": "2026-11-03T14:05:00Z",
    "updated_at": "2026-11-03T14:05:00Z",
    "submitted_at": null,
    "media": [],
    "evidences_count": 0
  }
}
```

### 6.2 Failure Pair

```http
POST /api/v1/verification-items/9a7c1e22-6b0d-4f3a-9e2c-1d5b8a0f7c33/votes
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "choice": "setuju" }
```

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8
X-Request-Id: 1a4b7c20-9d3e-4f5a-8b6c-2e7d0f9a1b33
```

```json
{
  "error": {
    "code": "self_vote_forbidden",
    "message": "Authors cannot vote on their own submission."
  }
}
```

### 6.3 Naming Review

| Element | Acceptable | Rejected |
|---|---|---|
| Path | `/location-claims/{claim_id}/media` | `/claimMedia/{claimId}` |
| Field | `proposed_precision` | `proposedPrecision` |
| Enum | `kecamatan` | `Kecamatan` |
| Error code | `file_too_large` | `ERR_FILE_SIZE` |
| Money | `"516020000000.00"` | `516020000000` |
| Boolean | `is_geotag_valid` | `geotag` |

---

## 7. Compliance Checklist

Use this checklist when adding or reviewing an endpoint.

### Naming

- [ ] Collection path is a plural noun in kebab-case.
- [ ] Nesting does not exceed two resource levels.
- [ ] Path parameters use `snake_case` and end with `_id`.
- [ ] Query parameters use `snake_case` and are not verbs.
- [ ] JSON fields use `snake_case`.
- [ ] Booleans use `is_`, `has_`, or `can_`.
- [ ] Timestamps end with `_at`.
- [ ] Enum values are canonical and lowercase.
- [ ] `operationId` is `camelCase` and stable.

### Responses

- [ ] Success responses use the `data` envelope.
- [ ] Collections include `meta` with `page`, `limit`, `total`, `has_next`.
- [ ] Money is a decimal string.
- [ ] Timestamps are ISO 8601 UTC with `Z`.
- [ ] `contract_amount` stays `null` when unpublished.
- [ ] Empty collections are `[]`, never `null`.
- [ ] Derived fields are read-only and grouped under `derived` when numerous.
- [ ] `201` includes `Location`.
- [ ] Cacheable GETs include `ETag`.
- [ ] Every response includes `X-Request-Id`.

### Errors

- [ ] Errors use the `error` envelope with `code` and `message`.
- [ ] Validation errors include `details` for every failing field.
- [ ] Status codes match the mapping in Section 4.4.
- [ ] `401` does not reveal whether an email exists.
- [ ] `404` does not leak private resource existence.
- [ ] No stack traces, SQL, or storage keys appear.
- [ ] `429` and `503` include `Retry-After`.
- [ ] Non-idempotent writes are not auto-retried by clients.

---

## 8. Approval

| Role | Name | Status |
|---|---|---|
| API Designer | TBD | Pending |
| Backend Developer | TBD | Pending |
| Frontend Developer | TBD | Pending |
| QA Engineer | TBD | Pending |
| Team Lead | TBD | Pending |
