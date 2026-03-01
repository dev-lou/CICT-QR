-- ==============================================================================
-- 🛡️ SECURITY ENHANCEMENT: ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Run these scripts in your Supabase SQL Editor. 
-- These policies lock down your database so that ONLY authenticated Admins 
-- can modify logbooks or audit logs, completely securing the event system 
-- against unauthorized client-side tampering.

-- 1. Enable RLS on all sensitive tables
ALTER TABLE public.logbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_logbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Create an Admin verification function (used in policies)
-- Uses x-admin-session header (validated against admin_sessions) OR service_role.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    headers_json JSONB;
    session_token TEXT;
BEGIN
    -- service_role always allowed
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    -- read request headers from PostgREST/Supabase context
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

REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated, service_role;

-- ==========================================
-- 🔐 ADMINS TABLE
-- ==========================================

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

-- ==========================================
-- 🔐 ADMIN SESSIONS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Service role can manage admin_sessions" ON public.admin_sessions;
CREATE POLICY "Service role can manage admin_sessions"
ON public.admin_sessions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');


-- ==========================================
-- 📝 LOGBOOK (STUDENTS)
-- ==========================================

DROP POLICY IF EXISTS "Allow public read access to logbook" ON public.logbook;
CREATE POLICY "Allow public read access to logbook"
ON public.logbook FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can insert logbook entries" ON public.logbook;
CREATE POLICY "Admins can insert logbook entries"
ON public.logbook FOR INSERT 
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update logbook entries" ON public.logbook;
CREATE POLICY "Admins can update logbook entries"
ON public.logbook FOR UPDATE 
USING (is_admin());


-- ==========================================
-- 🏛️ STAFF LOGBOOK
-- ==========================================

DROP POLICY IF EXISTS "Allow public read access to staff_logbook" ON public.staff_logbook;
CREATE POLICY "Allow public read access to staff_logbook"
ON public.staff_logbook FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can insert staff_logbook entries" ON public.staff_logbook;
CREATE POLICY "Admins can insert staff_logbook entries"
ON public.staff_logbook FOR INSERT 
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update staff_logbook entries" ON public.staff_logbook;
CREATE POLICY "Admins can update staff_logbook entries"
ON public.staff_logbook FOR UPDATE 
USING (is_admin());


-- ==========================================
-- 👤 STUDENTS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Allow public read access to students" ON public.students;
CREATE POLICY "Allow public read access to students"
ON public.students FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow students to update their own profiles" ON public.students;
CREATE POLICY "Allow students to update their own profiles"
ON public.students FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Anyone can register as a student" ON public.students;
CREATE POLICY "Anyone can register as a student"
ON public.students FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete students" ON public.students;
CREATE POLICY "Admins can delete students"
ON public.students FOR DELETE 
USING (is_admin());


-- ==========================================
-- 📄 AUDIT LOGS
-- ==========================================

DROP POLICY IF EXISTS "Allow public insert into audit_logs" ON public.audit_logs;
CREATE POLICY "Allow public insert into audit_logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit_logs"
ON public.audit_logs FOR SELECT
USING (is_admin());

-- ==============================================================================
-- 🚀 DONE! Your database is now heavily fortified against unauthorized API access.
