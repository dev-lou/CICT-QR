import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const getAdminToken = () => {
    try {
        const raw = localStorage.getItem('admin_session')
        if (!raw) return ''
        const parsed = JSON.parse(raw)
        if (parsed?.expires_at && new Date(parsed.expires_at).getTime() <= Date.now()) {
            localStorage.removeItem('admin_session')
            return ''
        }
        return parsed?.token || ''
    } catch {
        return ''
    }
}

let supabase = null

if (supabaseUrl && supabaseAnonKey) {
    try {
        const adminToken = getAdminToken()
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: adminToken ? { 'x-admin-session': adminToken } : {}
            }
        })
    } catch (err) {
        console.error('Failed to initialize Supabase client:', err)
    }
} else {
    console.warn(
        '⚠️ Missing Supabase env vars. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    )
}

export { supabase }
