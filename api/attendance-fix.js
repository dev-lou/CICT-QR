import { createClient } from '@supabase/supabase-js'

const resolvedUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const resolvedKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''

let supabase = null
try {
  if (resolvedUrl && resolvedKey) {
    supabase = createClient(resolvedUrl, resolvedKey)
  }
} catch (e) {
  console.error('[api/attendance-fix] createClient failed:', e)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Server misconfigured: database client unavailable.' })
  }

  const { action, table, id, student_id, time_in, time_out } = req.body || {}

  if (!action) {
    return res.status(400).json({ error: 'Missing action' })
  }

  // Validate table name
  if (table && !['logbook', 'staff_logbook'].includes(table)) {
    return res.status(400).json({ error: 'Invalid table' })
  }

  try {
    if (action === 'insert') {
      if (!table || !student_id || !time_in) {
        return res.status(400).json({ error: 'Missing required fields: table, student_id, time_in' })
      }

      const payload = { student_id, time_in }
      if (time_out) payload.time_out = time_out

      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select('id, student_id, time_in, time_out')
        .single()

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ data })
    }

    if (action === 'update') {
      if (!table || !id) {
        return res.status(400).json({ error: 'Missing required fields: table, id' })
      }

      const payload = {}
      if (time_in !== undefined) payload.time_in = time_in
      if (time_out !== undefined) payload.time_out = time_out

      const { error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete') {
      if (!table || !id) {
        return res.status(400).json({ error: 'Missing required fields: table, id' })
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (e) {
    console.error('[api/attendance-fix] handler failed:', e)
    return res.status(500).json({ error: e.message })
  }
}
