-- M2 Interim (auth tokens): single-use hashed tokens for email verification.
-- Source of truth:
--   docs/database/database-design.md §3.15 (Auth Tokens), §7 (indexes).
--   docs/api/api-requirements.md §3.5, §6.20-6.21.
--
-- Deviation note: the database design assigns auth_tokens to its M9 pass.
-- It lands here first because email verification (register, verify-email,
-- resend-verification) ships before the reports/claim milestones, and its
-- token storage cannot wait for M9. M9 therefore shrinks to its remaining
-- hardening scope (search vector, pg_trgm, partial indexes) for this repo.

CREATE TABLE auth_tokens (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    VARCHAR(30)  NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ  NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- §7: the hash is the lookup key when a verification link resolves.
CREATE UNIQUE INDEX auth_tokens_token_hash_key ON auth_tokens (token_hash);

-- §7: reissuance invalidates earlier unused tokens for the same account and
-- purpose; the partial index keeps that update to live rows only.
CREATE INDEX auth_tokens_user_purpose_unused_idx
    ON auth_tokens (user_id, purpose)
    WHERE used_at IS NULL;
