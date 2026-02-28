import { createClient } from '@supabase/supabase-js'

// simple edge/serverless handler for batched scans
// to deploy on Vercel or Supabase Edge Functions you need to
// supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key
// with appropriate privileges) as env vars.

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { uuids, mode = 'time-in' } = req.body || {}
  if (!Array.isArray(uuids)) {
    return res.status(400).json({ error: 'Invalid payload, expected uuids array' })
  }

  try {
    const results = []
    for (const uuid of uuids) {
      const trimmed = uuid.trim()
      if (!trimmed) continue
      const { data: student, error: studentErr } = await supabase
        .from('students')
        .select('id, full_name, role')
        .eq('uuid', trimmed)
        .single()
      if (studentErr || !student) {
        results.push({ uuid: trimmed, status: 'missing' })
        continue
      }

      const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(student.role)
      const table = isStaff ? 'staff_logbook' : 'logbook'

      if (mode === 'time-in') {
        const { data: existing } = await supabase
          .from(table)
          .select('id')
          .eq('student_id', student.id)
          .is('time_out', null)
          .limit(1)
        if (existing && existing.length > 0) {
          results.push({ uuid: trimmed, status: 'duplicate' })
          continue
        }
        const { data: inserted, error: insertErr } = await supabase.from(table).insert([{ student_id: student.id }])
        if (insertErr) {
          results.push({ uuid: trimmed, status: 'error', message: insertErr.message })
        } else {
          results.push({ uuid: trimmed, status: 'ok' })
          try {
            await supabase.from('audit_logs').insert([{ student_id: student.id, action: 'BATCH_SCAN', details: { mode, uuid: trimmed } }])
          } catch (e) { console.error('audit log failed', e) }
        }
      } else {
        // time-out
        const { data: active } = await supabase
          .from(table)
          .select('id')
          .eq('student_id', student.id)
          .is('time_out', null)
          .limit(1)
        if (active && active.length > 0) {
          const { error: updateErr } = await supabase
            .from(table)
            .update({ time_out: new Date().toISOString() })
            .eq('id', active[0].id)
          if (updateErr) {
            results.push({ uuid: trimmed, status: 'error', message: updateErr.message })
          } else {
            results.push({ uuid: trimmed, status: 'ok' })
            try {
              await supabase.from('audit_logs').insert([{ student_id: student.id, action: 'BATCH_SCAN_OUT', details: { uuid: trimmed } }])
            } catch (e) { console.error('audit log failed', e) }
          }
        } else {
          results.push({ uuid: trimmed, status: 'not_checked_in' })
        }
      }
    }

    res.status(200).json({ results })
  } catch (e) {
    console.error('scan handler failed', e)
    res.status(500).json({ error: e.message })
  }
}
