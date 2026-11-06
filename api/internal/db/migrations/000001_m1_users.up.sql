-- M1 Foundation: users and password storage.
-- Source of truth:
--   docs/database/database-design.md §3.1 (Users), §7 (indexes), §9.2 (M1).
--   docs/api/api-requirements.md §6.1, §17.

CREATE TABLE users (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name      VARCHAR(24)  NOT NULL,
    email             VARCHAR(255) NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ  NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- display_name and email uniqueness is case-insensitive
-- (api-requirements.md §8.1), so both unique indexes sit on lower(...).
CREATE UNIQUE INDEX users_display_name_ci_key ON users (LOWER (display_name));
CREATE UNIQUE INDEX users_email_ci_key        ON users (LOWER (email));

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
