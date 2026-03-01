-- ============================================================
-- Security Patch 02 (RLS)
-- Run SECOND in Supabase SQL Editor.
-- Locks admins/admin_sessions and fixes is_admin() logic.
-- ============================================================

-- Enable RLS on admin-related tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Real admin check:
-- - service_role is always trusted
-- - otherwise require valid non-expired x-admin-session token
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    headers_json JSONB;
    session_token TEXT;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    headers_json := COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    session_token := NULLIF(headers_json ->> 'x-admin-session', '');

    IF session_token IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.admin_sessions s
        WHERE s.token = session_token
          AND s.expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Admins table: only service_role may read/write
DROP POLICY IF EXISTS "Service role can read admins" ON public.admins;
CREATE POLICY "Service role can read admins"
ON public.admins FOR SELECT
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert admins" ON public.admins;
CREATE POLICY "Service role can insert admins"
ON public.admins FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update admins" ON public.admins;
CREATE POLICY "Service role can update admins"
ON public.admins FOR UPDATE
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete admins" ON public.admins;
CREATE POLICY "Service role can delete admins"
ON public.admins FOR DELETE
USING (auth.role() = 'service_role');

-- Admin sessions table: only service_role may manage sessions
DROP POLICY IF EXISTS "Service role can manage admin_sessions" ON public.admin_sessions;
CREATE POLICY "Service role can manage admin_sessions"
ON public.admin_sessions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Keep existing logbook/staff/audit/students policies as-is.
-- They already call is_admin(), so this function replacement hardens them automatically.
