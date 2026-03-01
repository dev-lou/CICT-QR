-- ============================================================
-- Security Patch 01 (SCHEMA)
-- Run FIRST in Supabase SQL Editor.
-- Adds admin_sessions table used by x-admin-session token checks.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token      TEXT PRIMARY KEY,
  admin_id   BIGINT NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_admin_id_idx
  ON public.admin_sessions(admin_id);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx
  ON public.admin_sessions(expires_at);

-- Optional maintenance helper (run manually anytime):
-- DELETE FROM public.admin_sessions WHERE expires_at <= NOW();
