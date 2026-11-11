# Production Checklist

Pre-deployment validation for WARTA API.

## Railway Setup

- [ ] Postgres plugin added (provides `DATABASE_URL`)
- [ ] Service variables configured (see Environment section)
- [ ] External S3 provider ready (Cloudflare R2 recommended)
- [ ] Custom domain configured (optional)
- [ ] Health check enabled: `/api/v1/health`

## Environment

Railway auto-sets `PORT` and `DATABASE_URL` (from Postgres plugin). Set these:

- [ ] `JWT_SECRET` (generate: `openssl rand -base64 48`)
- [ ] `JWT_TTL_SECONDS=3600` (optional, default works)
- [ ] `WARTA_SEED` unset (never seed prod)
- [ ] `STORAGE_DRIVER=s3`
- [ ] S3 credentials (see Storage section)
- [ ] SMTP credentials (see Email section)

## Database

- [ ] Migrations complete (check server startup logs)
- [ ] Connection pool sized for load (`pgxpool` defaults acceptable for <1000 RPS)
- [ ] Database backups configured
- [ ] User table empty or seeded accounts removed

## Security

- [ ] Rate limits active:
  - Login: 10/min/IP (`LOGIN_RATE_LIMIT`)
  - Register: 5/hour/IP (`REGISTER_RATE_LIMIT`)
  - Resend verification: 3/hour/account (`RESEND_RATE_LIMIT`)
- [ ] HTTPS termination upstream (API serves HTTP, reverse proxy adds TLS)
- [ ] JWT secret never committed to git
- [ ] CORS configured if frontend on different domain

## Storage

Railway has no built-in S3. Use external provider:

**Cloudflare R2 (recommended):**
- [ ] Bucket created at dash.cloudflare.com/r2
- [ ] R2 API token generated
- [ ] Set Railway vars:
  - `STORAGE_DRIVER=s3`
  - `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`
  - `S3_REGION=auto`
  - `S3_BUCKET=warta-media`
  - `S3_ACCESS_KEY_ID=<R2 token id>`
  - `S3_SECRET_ACCESS_KEY=<R2 token secret>`
  - `S3_PUBLIC_URL=https://media.warta.id` (custom domain on R2)
- [ ] R2 bucket CORS allows frontend origin
- [ ] Test upload via `/reports/:id/media` works

**Alternative: AWS S3, MinIO, DigitalOcean Spaces**

## Email

Use SMTP provider (SendGrid, Mailgun, AWS SES, or Resend):

- [ ] SMTP credentials obtained
- [ ] Railway vars:
  - `SMTP_HOST=smtp.sendgrid.net` (or provider)
  - `SMTP_PORT=587`
  - `SMTP_USERNAME=apikey` (provider-specific)
  - `SMTP_PASSWORD=<api key>`
  - `MAIL_FROM=WARTA <noreply@warta.id>`
  - `MAIL_VERIFY_BASE_URL=https://warta.id/verify-email`
- [ ] Sender domain verified with provider
- [ ] Send test verification email, confirm delivery

**Dev mode:** Leave `SMTP_HOST` unset, verification links print to Railway logs.

## Health & Monitoring

- [ ] `/api/v1/health` returns 200 with `status: "ok"`
- [ ] Database shows `"database": "ok"` 
- [ ] Storage shows `"storage": "ok"`
- [ ] Uptime/alerting configured to poll health endpoint
- [ ] Log aggregation captures server logs (errors, unhandled requests)

## Load & Performance

- [ ] Database indexes exist on:
  - `users.email` (UNIQUE)
  - `reports.project_id`, `reports.status`
  - `verification_items.status`
- [ ] File upload limit is 10MB (`BodyLimit` in server.go)
- [ ] Connection timeout tested (health checks 2s timeout)

## Deployment Verification

After deploy:

1. [ ] Health check: `curl https://api.warta.id/api/v1/health`
2. [ ] Register account: `POST /api/v1/auth/register`
3. [ ] Verify email link works (check inbox or logs if SMTP unset)
4. [ ] Login: `POST /api/v1/auth/login` returns JWT
5. [ ] Bearer-protected endpoint works: `GET /api/v1/auth/me`
6. [ ] Public endpoint works: `GET /api/v1/projects`
7. [ ] Rate limit triggers on repeated requests
8. [ ] Upload test media to report (S3 storage)

## Rollback Plan

- [ ] Previous deployment artifacts retained
- [ ] Database migration rollback tested (`.down.sql` files exist)
- [ ] Rollback procedure documented (stop server, restore DB, redeploy old binary)
