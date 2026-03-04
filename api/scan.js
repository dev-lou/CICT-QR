import { createClient } from '@supabase/supabase-js'

// Server-side scan handler — uses service_role key to bypass RLS.
// Env vars: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (fallback to VITE_ prefixed)

const resolvedUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const resolvedKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''

let supabase = null
try {
  if (resolvedUrl && resolvedKey) {
    supabase = createClient(resolvedUrl, resolvedKey)
  }
} catch (e) {
  console.error('[api/scan] createClient failed:', e)
}

const getManilaDayKeyFromIso = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  } catch {
    return ''
  }
}

const getTodayManilaDayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

const noRowsError = (error) => {
  const code = String(error?.code || '').toUpperCase()
  const message = String(error?.message || '').toLowerCase()
  return code === 'PGRST116' || message.includes('0 rows') || message.includes('no rows')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabase) {
    console.error('[api/scan] Supabase client not initialised – check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars')
    return res.status(500).json({ error: 'Server misconfigured: database client unavailable.' })
  }

  const { uuids, mode = 'time-in', entries } = req.body || {}

  const normalizedEntries = Array.isArray(entries)
    ? entries.map((entry, index) => ({
      idx: Number.isFinite(Number(entry?.idx)) ? Number(entry.idx) : index,
      uuid: String(entry?.uuid || '').trim(),
      mode: entry?.mode === 'time-out' ? 'time-out' : 'time-in',
      queued_at: entry?.queued_at || null
    }))
    : Array.isArray(uuids)
      ? uuids.map((uuidValue, index) => ({
        idx: index,
        uuid: String(uuidValue || '').trim(),
        mode: mode === 'time-out' ? 'time-out' : 'time-in',
        queued_at: null
      }))
      : null

  if (!Array.isArray(normalizedEntries)) {
    return res.status(400).json({ error: 'Invalid payload, expected uuids array' })
  }

  try {
    const results = []
    for (const entry of normalizedEntries) {
      const trimmed = entry.uuid
      if (!trimmed) continue

      const referenceDayKey = getManilaDayKeyFromIso(entry.queued_at) || getTodayManilaDayKey()

      const { data: student, error: studentErr } = await supabase
        .from('students')
        .select('id, full_name, role')
        .eq('uuid', trimmed)
        .single()

      if (studentErr) {
        if (noRowsError(studentErr)) {
          results.push({ idx: entry.idx, uuid: trimmed, status: 'missing' })
        } else {
          results.push({ idx: entry.idx, uuid: trimmed, status: 'error', message: studentErr.message })
        }
        continue
      }

      if (!student) {
        results.push({ idx: entry.idx, uuid: trimmed, status: 'missing' })
        continue
      }

      const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(student.role)
      const table = isStaff ? 'staff_logbook' : 'logbook'

      if (entry.mode === 'time-in') {
        const { data: existing } = await supabase
          .from(table)
          .select('id, time_in')
          .eq('student_id', student.id)
          .is('time_out', null)

        const dayMatchedActive = (existing || []).filter((row) => getManilaDayKeyFromIso(row.time_in) === referenceDayKey)
        const staleActive = (existing || []).filter((row) => getManilaDayKeyFromIso(row.time_in) !== referenceDayKey)

        if (staleActive.length > 0) {
          await supabase
            .from(table)
            .update({ time_out: staleActive[0].time_in })
            .in('id', staleActive.map((row) => row.id))
            .then(() => { })
            .catch(() => { })
        }

        if (dayMatchedActive.length > 0) {
          results.push({ idx: entry.idx, uuid: trimmed, status: 'duplicate' })
          continue
        }

        const { data: dayRecords } = await supabase
          .from(table)
          .select('id')
          .eq('student_id', student.id)
          .gte('time_in', `${referenceDayKey}T00:00:00+08:00`)
          .lte('time_in', `${referenceDayKey}T23:59:59.999+08:00`)
          .limit(1)

        if (dayRecords && dayRecords.length > 0) {
          results.push({ idx: entry.idx, uuid: trimmed, status: 'already_scanned_today' })
          continue
        }

        const { data: inserted, error: insertErr } = await supabase.from(table).insert([{ student_id: student.id }])
        if (insertErr) {
          results.push({ idx: entry.idx, uuid: trimmed, status: 'error', message: insertErr.message })
        } else {
          results.push({ idx: entry.idx, uuid: trimmed, status: 'ok' })
          try {
            await supabase.from('audit_logs').insert([{ student_id: student.id, action: 'BATCH_SCAN', details: { mode: entry.mode, uuid: trimmed } }])
          } catch (e) { console.error('audit log failed', e) }
        }
      } else {
        // time-out
        const { data: active } = await supabase
          .from(table)
          .select('id, time_in')
          .eq('student_id', student.id)
          .is('time_out', null)

        const dayMatchedActive = (active || []).filter((row) => getManilaDayKeyFromIso(row.time_in) === referenceDayKey)
        const staleActive = (active || []).filter((row) => getManilaDayKeyFromIso(row.time_in) !== referenceDayKey)

        if (dayMatchedActive.length === 0 && staleActive.length > 0) {
          await supabase
            .from(table)
            .update({ time_out: staleActive[0].time_in })
            .in('id', staleActive.map((row) => row.id))
            .then(() => { })
            .catch(() => { })
        }

        if (dayMatchedActive.length > 0) {
          const { error: updateErr } = await supabase
            .from(table)
            .update({ time_out: new Date().toISOString() })
            .eq('id', dayMatchedActive[0].id)
          if (updateErr) {
            results.push({ idx: entry.idx, uuid: trimmed, status: 'error', message: updateErr.message })
          } else {
            results.push({ idx: entry.idx, uuid: trimmed, status: 'ok' })
            try {
              await supabase.from('audit_logs').insert([{ student_id: student.id, action: 'BATCH_SCAN_OUT', details: { uuid: trimmed } }])
            } catch (e) { console.error('audit log failed', e) }
          }
        } else {
          const { data: lastOut } = await supabase
            .from(table)
            .select('id, time_in, time_out')
            .eq('student_id', student.id)
            .not('time_out', 'is', null)
            .order('time_out', { ascending: false })
            .limit(20)

          const dayMatchedLastOut = (lastOut || []).filter((row) => getManilaDayKeyFromIso(row.time_in) === referenceDayKey)
          if (dayMatchedLastOut.length > 0) {
            results.push({ idx: entry.idx, uuid: trimmed, status: 'already_checked_out' })
          } else {
            results.push({ idx: entry.idx, uuid: trimmed, status: 'not_checked_in' })
          }
        }
      }
    }

    res.status(200).json({ results })
  } catch (e) {
    console.error('scan handler failed', e)
    res.status(500).json({ error: e.message })
  }
}
