-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_email TEXT, -- Can be null if it's a student self-edit
  student_id  BIGINT REFERENCES students(id) ON DELETE SET NULL,
  action      TEXT NOT NULL, -- 'UPDATE_USER', 'DELETE_USER', 'SELF_EDIT'
  target_name TEXT,
  details     JSONB, -- Store old and new values
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EVENTS TABLE (for Point Tally)
CREATE TABLE IF NOT EXISTS events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  category    TEXT DEFAULT 'GENERAL',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Initial events - Simplified list
INSERT INTO events (name)
VALUES 
  ('ON THE SPOT POSTER MAKING'),
  ('PENCIL RENDERING'),
  ('CHARCOAL RENDERING'),
  ('PAINTING'),
  ('SONG WRITING'),
  ('PIANO'),
  ('VIOLIN'),
  ('BANDURRIA'),
  ('FOLK DANCE'),
  ('STREET DANCE'),
  ('ESSAY WRITING'),
  ('MR. RASUC VI'),
  ('MS. RASUC VI')
ON CONFLICT (name) DO NOTHING;
