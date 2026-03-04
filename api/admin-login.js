import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email = '', password = '' } = req.body || {}
  const normalizedEmail = String(email).trim().toLowerCase()

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    const { data: admin, error: adminErr } = await supabase
      .from('admins')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('password', password)
      .single()

    if (adminErr || !admin) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    return res.status(200).json({
      session: {
        id: admin.id,
        email: admin.email,
        role: String(admin.role || 'admin').toLowerCase()
      }
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login failed.' })
  }
}
