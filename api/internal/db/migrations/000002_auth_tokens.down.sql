-- Rollback of 000002_auth_tokens.up.sql.
DROP INDEX IF EXISTS auth_tokens_user_purpose_unused_idx;
DROP INDEX IF EXISTS auth_tokens_token_hash_key;
DROP TABLE IF EXISTS auth_tokens;
