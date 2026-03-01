-- ============================================================
-- Security Patch 03 (Admin Login RPC Fallback)
-- Run AFTER patch 01 and patch 02.
-- Enables admin login even on plain Vite local dev (no /api route).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_login(p_email TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
    found_admin RECORD;
    session_token TEXT;
    session_expiry TIMESTAMPTZ;
BEGIN
    SELECT id, email
      INTO found_admin
      FROM public.admins
     WHERE email = LOWER(TRIM(p_email))
       AND password = p_password
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    session_token := REPLACE(gen_random_uuid()::TEXT, '-', '');
    session_expiry := NOW() + INTERVAL '12 hours';

    INSERT INTO public.admin_sessions(token, admin_id, expires_at)
    VALUES (session_token, found_admin.id, session_expiry);

    RETURN jsonb_build_object(
        'id', found_admin.id,
        'email', found_admin.email,
        'token', session_token,
        'expires_at', session_expiry
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.admin_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO anon, authenticated, service_role;
