-- Rollback of M1 Foundation.

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
DROP FUNCTION IF EXISTS set_updated_at();
DROP INDEX IF EXISTS users_email_ci_key;
DROP INDEX IF EXISTS users_display_name_ci_key;
DROP TABLE IF EXISTS users;
