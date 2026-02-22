import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let supabase = null

if (supabaseUrl && supabaseAnonKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey)
    } catch (err) {
        console.error('Failed to initialize Supabase client:', err)
    }
} else {
    console.warn(
        '⚠️ Missing Supabase env vars. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    )
}

export { supabase }
