-- Admin role addition to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'warga';
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
