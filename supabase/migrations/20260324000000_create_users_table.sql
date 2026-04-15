-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RPC: verify user login
CREATE OR REPLACE FUNCTION verify_user(p_username text, p_password text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE username = p_username
    AND password_hash = crypt(p_password, password_hash)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- RPC: create user
CREATE OR REPLACE FUNCTION create_user(p_username text, p_password text, p_display_name text)
RETURNS void AS $$
  INSERT INTO users (username, password_hash, display_name)
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_display_name);
$$ LANGUAGE sql SECURITY DEFINER;

-- RPC: change password
CREATE OR REPLACE FUNCTION change_password(p_username text, p_new_password text)
RETURNS void AS $$
  UPDATE users
  SET password_hash = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE username = p_username;
$$ LANGUAGE sql SECURITY DEFINER;

-- Seed removed. Historical note: this migration previously inserted a
-- 'leo' account with a hardcoded password. That password is now rotated
-- by migration 20260416000000_rotate_seed_admin.sql so anyone who cloned
-- the old file can no longer log in with it.
