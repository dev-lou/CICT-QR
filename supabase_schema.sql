-- ============================================
-- ISUFST QR Attendance System — Full Schema v3
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
  role       TEXT NOT NULL DEFAULT 'student',
  edit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for older schemas
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'username'
  ) THEN
    ALTER TABLE students ADD COLUMN username TEXT NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS students_username_unique ON students (username) WHERE username != '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'password'
  ) THEN
    ALTER TABLE students ADD COLUMN password TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add role column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'role'
  ) THEN
    ALTER TABLE students ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
  END IF;
END $$;

-- 4. STUDENT LOGBOOK TABLE (students only)
CREATE TABLE IF NOT EXISTS logbook (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
  time_in    TIMESTAMPTZ DEFAULT NOW(),
  time_out   TIMESTAMPTZ DEFAULT NULL
);

-- 5. STAFF LOGBOOK TABLE (leaders and facilitators)
CREATE TABLE IF NOT EXISTS staff_logbook (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
  time_in    TIMESTAMPTZ DEFAULT NOW(),
  time_out   TIMESTAMPTZ DEFAULT NULL
);

-- 6. SCORE LOGS TABLE
CREATE TABLE IF NOT EXISTS score_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id     BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  team_name   TEXT NOT NULL,
  delta       INT NOT NULL,
  reason      TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SCOREBOARD SETTINGS TABLE (persistent toggle state for public view)
CREATE TABLE IF NOT EXISTS scoreboard_settings (
  id          INT PRIMARY KEY DEFAULT 1,
  hide_names  BOOLEAN NOT NULL DEFAULT false,
  hide_scores BOOLEAN NOT NULL DEFAULT false,
  hide_bars   BOOLEAN NOT NULL DEFAULT false,
  hide_top2   BOOLEAN NOT NULL DEFAULT false,
  hide_all    BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO scoreboard_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE! Default admin: admin@isufst.edu / admin123
-- ============================================
