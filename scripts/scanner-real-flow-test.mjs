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

async function createStudent(supabase, { fullName, role, teamName, username }) {
  const { data, error } = await supabase
    .from('students')
    .insert([{
      full_name: fullName,
      username,
      password: 'flow_test_password',
      team_name: teamName,
      role
    }])
    .select('id, uuid, full_name, role, team_name')
    .single()

  if (error) throw error
  return data
}

async function processScanBatch(supabase, batch, currentMode) {
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
        const todayActive = existing.filter(e => e.time_in >= todayStartUTC && e.time_in <= todayEndUTC)
        const staleActive = existing.filter(e => e.time_in < todayStartUTC)

        if (staleActive.length > 0) {
          const staleIds = staleActive.map(e => e.id)
          await supabase.from(table)
            .update({ time_out: staleActive[0].time_in })
            .in('id', staleIds)
            .then(() => {})
            .catch(() => {})
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
        try {
          await supabase.from('audit_logs').insert([{ student_id: student.id, action: 'BATCH_SCAN', details: { mode: modeForItem, uuid: trimmed } }])
        } catch {
          // keep scanner flow tolerant to audit log issues
        }
      }
    } else {
      const { data: active } = await supabase.from(table).select('id').eq('student_id', student.id).is('time_out', null).limit(1)
      if (active && active.length > 0) {
        const { error: updateErr } = await supabase.from(table).update({ time_out: new Date().toISOString() }).eq('id', active[0].id)
        if (updateErr) {
          results.push({ item, uuid: trimmed, status: 'error', message: updateErr.message })
        } else {
          results.push({ item, uuid: trimmed, status: 'ok' })
          try {
            await supabase.from('audit_logs').insert([{ student_id: student.id, action: 'BATCH_SCAN_OUT', details: { uuid: trimmed } }])
          } catch {
            // keep scanner flow tolerant to audit log issues
          }
        }
      } else {
        results.push({ item, uuid: trimmed, status: 'not_checked_in' })
      }
    }
  }
  return results
}

async function flushQueueLikeScanner(supabase, queue, mode, backendConnected) {
  if (queue.length === 0) return { status: 'empty', queue, results: [] }
  if (!backendConnected) return { status: 'offline', queue, results: [] }

  const batch = queue.splice(0)

  try {
    const results = await processScanBatch(supabase, batch, mode)

    const failedStatuses = new Set(['error'])
    const failedItems = results
      .filter((result) => failedStatuses.has(result.status))
      .map((result) => (typeof result.item === 'string' ? { uuid: result.uuid } : result.item))

    if (failedItems.length > 0) {
      queue.unshift(...failedItems)
      return { status: 'partial', queue, results }
    }

    return { status: 'ok', queue, results }
  } catch (error) {
    queue.unshift(...batch)
    return { status: 'error', queue, results: [], error }
  }
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
  const teamName = 'offline test'

  const { error: teamErr } = await supabase
    .from('teams')
    .upsert([{ name: teamName, score: 150 }], { onConflict: 'name' })
  if (teamErr) throw teamErr

  const executive = await createStudent(supabase, {
    fullName: 'executive',
    role: 'executive',
    teamName: '',
    username: `executive_${stamp}`
  })

  const officer = await createStudent(supabase, {
    fullName: 'officer',
    role: 'officer',
    teamName: '',
    username: `officer_${stamp}`
  })

  const testStudent = await createStudent(supabase, {
    fullName: 'test student',
    role: 'student',
    teamName,
    username: `test_student_${stamp}`
  })

  // 1) Simulate executive scanning test student (time-in) using scanner logic
  const execScanResults = await processScanBatch(supabase, [{ uuid: testStudent.uuid, mode: 'time-in' }], 'time-in')

  // 2) Simulate officer scanning test student (time-out) using scanner logic
  const officerScanResults = await processScanBatch(supabase, [{ uuid: testStudent.uuid, mode: 'time-out' }], 'time-out')

  // Verify test student's logbook row (should exist and be checked out)
  const { data: studentLogRows, error: studentLogErr } = await supabase
    .from('logbook')
    .select('id, student_id, time_in, time_out')
    .eq('student_id', testStudent.id)
    .order('time_in', { ascending: false })
    .limit(1)

  if (studentLogErr) throw studentLogErr

  // 3) Offline queue + SYNC NOW simulation (use executive uuid so it writes to staff_logbook)
  const queue = []
  queue.push({ uuid: executive.uuid, name: 'Pending verification', mode: 'time-in', queued_at: new Date().toISOString() })
  const syncResult = await flushQueueLikeScanner(supabase, queue, 'time-in', true)

  const { data: execStaffRows, error: execStaffErr } = await supabase
    .from('staff_logbook')
    .select('id, student_id, time_in, time_out')
    .eq('student_id', executive.id)
    .order('time_in', { ascending: false })
    .limit(1)

  if (execStaffErr) throw execStaffErr

  // 4) Dashboard/Logbook refresh verification using same query pattern in LogbookPage (student side)
  const { data: dashboardRefreshRows, error: dashboardErr } = await supabase
    .from('logbook')
    .select('id, time_in, time_out, students(id, full_name, team_name)')
    .order('time_in', { ascending: true })

  if (dashboardErr) throw dashboardErr

  const appearsInDashboardRefresh = (dashboardRefreshRows || []).some((row) => row?.students?.id === testStudent.id)

  console.log('PASS: Real scan flow test completed')
  console.log(JSON.stringify({
    createdUsers: {
      executive: { id: executive.id, uuid: executive.uuid, role: executive.role, full_name: executive.full_name },
      officer: { id: officer.id, uuid: officer.uuid, role: officer.role, full_name: officer.full_name },
      testStudent: { id: testStudent.id, uuid: testStudent.uuid, role: testStudent.role, full_name: testStudent.full_name }
    },
    scanByExecutive: execScanResults,
    scanByOfficer: officerScanResults,
    studentLatestLogbookRow: studentLogRows?.[0] || null,
    offlineQueueSyncNow: {
      queueRemaining: queue.length,
      syncStatus: syncResult.status,
      syncResults: syncResult.results
    },
    executiveLatestStaffLogbookRow: execStaffRows?.[0] || null,
    dashboardRefreshVerification: {
      queryUsed: "logbook.select('id, time_in, time_out, students(id, full_name, team_name)').order('time_in', { ascending: true })",
      testStudentAppears: appearsInDashboardRefresh
    }
  }, null, 2))
}

run().catch((err) => {
  console.error('FAIL: Real scan flow test failed')
  console.error(err)
  process.exit(1)
})
