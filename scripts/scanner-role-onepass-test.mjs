import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function readEnvFile(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8')
  const result = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    result[key] = value
  }
  return result
}

function getManilaDayBoundsUTC() {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now)

    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value

    if (!year || !month || !day) throw new Error('Unable to resolve Manila day')

    const base = `${year}-${month}-${day}`
    return {
      todayStartUTC: new Date(`${base}T00:00:00+08:00`).toISOString(),
      todayEndUTC: new Date(`${base}T23:59:59.999+08:00`).toISOString()
    }
  } catch {
    const fallbackStart = new Date()
    fallbackStart.setHours(0, 0, 0, 0)
    const fallbackEnd = new Date()
    fallbackEnd.setHours(23, 59, 59, 999)
    return {
      todayStartUTC: fallbackStart.toISOString(),
      todayEndUTC: fallbackEnd.toISOString()
    }
  }
}

async function createStudent(supabase, { fullName, username, teamName, role }) {
  const { data, error } = await supabase
    .from('students')
    .insert([{
      full_name: fullName,
      username,
      password: 'system_test_password',
      team_name: teamName,
      role
    }])
    .select('id, uuid, full_name, role, team_name')
    .single()

  if (error) throw error
  return data
}

async function processScanBatchCurrent(supabase, batch, currentMode) {
  const results = []

  for (const item of batch) {
    const rawUuid = typeof item === 'string' ? item : item?.uuid
    const trimmed = rawUuid ? rawUuid.trim() : ''
    const modeForItem = typeof item === 'string' ? currentMode : (item?.mode || currentMode)
    if (!trimmed) continue

    const { data: student } = await supabase.from('students').select('id, full_name, role').eq('uuid', trimmed).single()
    if (!student) {
      results.push({ item, uuid: trimmed, status: 'missing' })
      continue
    }

    const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(student.role)
    const table = isStaff ? 'staff_logbook' : 'logbook'

    if (modeForItem === 'time-in') {
      const { todayStartUTC, todayEndUTC } = getManilaDayBoundsUTC()
      const { data: existing } = await supabase.from(table).select('id, time_in').eq('student_id', student.id).is('time_out', null)

      if (existing && existing.length > 0) {
        const todayActive = existing.filter((e) => e.time_in >= todayStartUTC && e.time_in <= todayEndUTC)
        const staleActive = existing.filter((e) => e.time_in < todayStartUTC)

        if (staleActive.length > 0) {
          const staleIds = staleActive.map((e) => e.id)
          await supabase.from(table).update({ time_out: staleActive[0].time_in }).in('id', staleIds)
        }

        if (todayActive.length > 0) {
          results.push({ item, uuid: trimmed, status: 'duplicate' })
          continue
        }
      }

      const { data: todayRecords } = await supabase.from(table)
        .select('id')
        .eq('student_id', student.id)
        .gte('time_in', todayStartUTC)
        .lte('time_in', todayEndUTC)
        .limit(1)

      if (todayRecords && todayRecords.length > 0) {
        results.push({ item, uuid: trimmed, status: 'already_scanned_today' })
        continue
      }

      const { error: insertErr } = await supabase.from(table).insert([{ student_id: student.id }])
      if (insertErr) {
        results.push({ item, uuid: trimmed, status: 'error', message: insertErr.message })
      } else {
        results.push({ item, uuid: trimmed, status: 'ok' })
      }
    } else {
      const { data: active } = await supabase.from(table).select('id').eq('student_id', student.id).is('time_out', null).limit(1)
      if (active && active.length > 0) {
        const { error: updateErr } = await supabase.from(table).update({ time_out: new Date().toISOString() }).eq('id', active[0].id)
        if (updateErr) {
          results.push({ item, uuid: trimmed, status: 'error', message: updateErr.message })
        } else {
          results.push({ item, uuid: trimmed, status: 'ok' })
        }
      } else {
        const { data: lastOut } = await supabase.from(table)
          .select('id, time_out')
          .eq('student_id', student.id)
          .not('time_out', 'is', null)
          .order('time_out', { ascending: false })
          .limit(1)

        if (lastOut && lastOut.length > 0) {
          results.push({ item, uuid: trimmed, status: 'already_checked_out' })
        } else {
          results.push({ item, uuid: trimmed, status: 'not_checked_in' })
        }
      }
    }
  }

  return results
}

async function verifyLatest(supabase, studentId, role) {
  const table = ['leader', 'facilitator', 'executive', 'officer'].includes(role) ? 'staff_logbook' : 'logbook'
  const { data, error } = await supabase
    .from(table)
    .select('id, student_id, time_in, time_out')
    .eq('student_id', studentId)
    .order('time_in', { ascending: false })
    .limit(1)

  if (error) throw error
  return { table, row: data?.[0] || null }
}

async function run() {
  const env = readEnvFile(path.join(process.cwd(), '.env'))
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const stamp = Date.now()
  const teamName = 'system team'

  const { error: teamErr } = await supabase
    .from('teams')
    .upsert([{ name: teamName, score: 150 }], { onConflict: 'name' })
  if (teamErr) throw teamErr

  const roles = ['student', 'leader', 'facilitator', 'executive', 'officer']
  const summary = []

  for (const role of roles) {
    const systemStudent = await createStudent(supabase, {
      fullName: `system ${role}`,
      username: `system_${role}_${stamp}`,
      teamName,
      role
    })

    const inResults = await processScanBatchCurrent(supabase, [{ uuid: systemStudent.uuid, mode: 'time-in' }], 'time-in')
    const outResults = await processScanBatchCurrent(supabase, [{ uuid: systemStudent.uuid, mode: 'time-out' }], 'time-out')
    const verify = await verifyLatest(supabase, systemStudent.id, role)

    summary.push({
      role,
      student: {
        id: systemStudent.id,
        uuid: systemStudent.uuid,
        full_name: systemStudent.full_name,
        team_name: systemStudent.team_name
      },
      checkInStatus: inResults[0]?.status || 'none',
      checkOutStatus: outResults[0]?.status || 'none',
      logTable: verify.table,
      latestRow: verify.row
    })
  }

  console.log('PASS: one-pass scanner role test completed')
  console.log(JSON.stringify({
    test: 'scanner-role-onepass-test',
    team: teamName,
    totalRoles: summary.length,
    summary
  }, null, 2))
}

run().catch((err) => {
  console.error('FAIL: scanner role one-pass test failed')
  console.error(err)
  process.exit(1)
})
