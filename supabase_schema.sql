-- ============================================
-- ISUFST QR Attendance System — Full Schema v2
-- Run this in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS.
-- ============================================

-- 1. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email    TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO admins (email, password)
VALUES ('admin@isufst.edu', 'admin123')
ON CONFLICT (email) DO NOTHING;

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid       UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  full_name  TEXT NOT NULL,
  username   TEXT UNIQUE NOT NULL DEFAULT '',
  password   TEXT NOT NULL DEFAULT '',
  team_name  TEXT NOT NULL DEFAULT '',
  edit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: rename group_name → team_name if old schema was used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'team_name'
  ) THEN
    ALTER TABLE students ADD COLUMN team_name TEXT NOT NULL DEFAULT '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'group_name'
  ) THEN
    UPDATE students SET team_name = group_name WHERE team_name = '';
    ALTER TABLE students DROP COLUMN group_name;
  END IF;

  -- Add username column if missing (migration from older version)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'username'
  ) THEN
    ALTER TABLE students ADD COLUMN username TEXT NOT NULL DEFAULT '';
    -- Make it unique after adding (existing rows will have empty string - fix manually)
    CREATE UNIQUE INDEX IF NOT EXISTS students_username_unique ON students (username) WHERE username != '';
  END IF;

  -- Add password column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'password'
  ) THEN
    ALTER TABLE students ADD COLUMN password TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- 4. LOGBOOK TABLE
CREATE TABLE IF NOT EXISTS logbook (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
  time_in    TIMESTAMPTZ DEFAULT NOW(),
  time_out   TIMESTAMPTZ DEFAULT NULL
);

-- ============================================
-- DONE! Default admin: admin@isufst.edu / admin123
-- ============================================
