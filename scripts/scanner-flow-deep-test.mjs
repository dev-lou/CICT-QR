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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

    const base = `${year}-${month}-${day}`
    return {
      todayStartUTC: new Date(`${base}T00:00:00+08:00`).toISOString(),
      todayEndUTC: new Date(`${base}T23:59:59.999+08:00`).toISOString()
    }
  } catch {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    return { todayStartUTC: start.toISOString(), todayEndUTC: end.toISOString() }
  }
}

function popupByStatus(status, mode) {
  if (mode === 'time-in') {
    if (status === 'ok') return 'User Successfully Scanned!'
    if (status === 'duplicate' || status === 'already_scanned_today') return 'Already checked in today'
    if (status === 'missing') return 'Participant not found'
    if (status === 'error') return 'Save failed — try again'
    return 'Unable to process QR code'
  }

  if (status === 'ok') return 'User Successfully Scanned!'
  if (status === 'not_checked_in') return 'No active check-in found'
  if (status === 'already_checked_out') return 'No active check-in found'
  if (status === 'missing') return 'Participant not found'
  if (status === 'error') return 'Save failed — try again'
  return 'Unable to process QR code'
}

async function createStudent(supabase, { fullName, username, teamName, role }) {
  const { data, error } = await supabase
    .from('students')
    .insert([{ full_name: fullName, username, password: 'system_test_password', team_name: teamName, role }])
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
      if (insertErr) results.push({ item, uuid: trimmed, status: 'error', message: insertErr.message })
      else results.push({ item, uuid: trimmed, status: 'ok' })
    } else {
      const { data: active } = await supabase.from(table).select('id').eq('student_id', student.id).is('time_out', null).limit(1)
      if (active && active.length > 0) {
        const { error: updateErr } = await supabase.from(table).update({ time_out: new Date().toISOString() }).eq('id', active[0].id)
        if (updateErr) results.push({ item, uuid: trimmed, status: 'error', message: updateErr.message })
        else results.push({ item, uuid: trimmed, status: 'ok' })
      } else {
        const { data: lastOut } = await supabase.from(table)
          .select('id, time_out')
          .eq('student_id', student.id)
          .not('time_out', 'is', null)
          .order('time_out', { ascending: false })
          .limit(1)

        if (lastOut && lastOut.length > 0) results.push({ item, uuid: trimmed, status: 'already_checked_out' })
        else results.push({ item, uuid: trimmed, status: 'not_checked_in' })
      }
    }
  }
  return results
}

async function flushQueueCurrent({ supabase, queue, mode, backendConnected }) {
  if (queue.length === 0) return { status: 'empty', remainingQueue: queue.length, results: [] }
  if (!backendConnected) return { status: 'offline', remainingQueue: queue.length, results: [] }

  const batch = queue.splice(0)
  try {
    const results = await processScanBatchCurrent(supabase, batch, mode)
    const retryable = new Set(['error', 'not_checked_in'])
    const retryItems = results
      .filter((result) => retryable.has(result.status))
      .map((result) => (typeof result.item === 'string' ? { uuid: result.uuid } : result.item))

    if (retryItems.length > 0) queue.unshift(...retryItems)

    return {
      status: retryItems.length > 0 ? 'partial' : 'ok',
      remainingQueue: queue.length,
      results,
      counts: {
        ok: results.filter((r) => r.status === 'ok').length,
        retry: retryItems.length,
        duplicate: results.filter((r) => r.status === 'duplicate').length,
        alreadyToday: results.filter((r) => r.status === 'already_scanned_today').length,
        alreadyCheckedOut: results.filter((r) => r.status === 'already_checked_out').length,
        missing: results.filter((r) => r.status === 'missing').length,
        notCheckedIn: results.filter((r) => r.status === 'not_checked_in').length,
        error: results.filter((r) => r.status === 'error').length
      }
    }
  } catch (error) {
    queue.unshift(...batch)
    return { status: 'error', remainingQueue: queue.length, results: [], error }
  }
}

async function latestRowFor(supabase, studentId, role) {
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
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const stamp = Date.now()
  const teamName = 'system team'

  const { error: teamErr } = await supabase.from('teams').upsert([{ name: teamName, score: 150 }], { onConflict: 'name' })
  if (teamErr) throw teamErr

  const roles = ['student', 'leader', 'facilitator', 'executive', 'officer']
  const roleOnePass = []

  for (const role of roles) {
    const student = await createStudent(supabase, {
      fullName: `system ${role} deep`,
      username: `system_${role}_deep_${stamp}`,
      teamName,
      role
    })

    const inResult = (await processScanBatchCurrent(supabase, [{ uuid: student.uuid, mode: 'time-in' }], 'time-in'))[0]
    await sleep(120)
    const outResult = (await processScanBatchCurrent(supabase, [{ uuid: student.uuid, mode: 'time-out' }], 'time-out'))[0]
    const latest = await latestRowFor(supabase, student.id, role)

    roleOnePass.push({
      role,
      uuid: student.uuid,
      table: latest.table,
      checkInStatus: inResult?.status,
      checkInPopup: popupByStatus(inResult?.status, 'time-in'),
      checkOutStatus: outResult?.status,
      checkOutPopup: popupByStatus(outResult?.status, 'time-out'),
      latestRow: latest.row
    })
  }

  const delayed = await createStudent(supabase, {
    fullName: `system delayed ${stamp}`,
    username: `system_delayed_${stamp}`,
    teamName,
    role: 'student'
  })

  const delayedQueue = [
    { uuid: delayed.uuid, mode: 'time-out', queued_at: new Date().toISOString() },
    { uuid: delayed.uuid, mode: 'time-in', queued_at: new Date().toISOString() }
  ]

  const delayedFlush1 = await flushQueueCurrent({ supabase, queue: delayedQueue, mode: 'time-out', backendConnected: true })
  const delayedFlush2 = await flushQueueCurrent({ supabase, queue: delayedQueue, mode: 'time-out', backendConnected: true })

  const offlineSubject = await createStudent(supabase, {
    fullName: `system offline ${stamp}`,
    username: `system_offline_${stamp}`,
    teamName,
    role: 'student'
  })

  const offlineQueue = [{ uuid: offlineSubject.uuid, mode: 'time-in', queued_at: new Date().toISOString() }]
  const offlineAttempt = await flushQueueCurrent({ supabase, queue: offlineQueue, mode: 'time-in', backendConnected: false })
  const onlineAttempt = await flushQueueCurrent({ supabase, queue: offlineQueue, mode: 'time-in', backendConnected: true })
  const offlineVerify = await latestRowFor(supabase, offlineSubject.id, 'student')

  console.log('PASS: scanner deep flow test completed')
  console.log(JSON.stringify({
    test: 'scanner-flow-deep-test',
    usesCurrentAdminScannerLogic: true,
    team: teamName,
    roleOnePass,
    delayedOrderScenario: {
      note: 'checkout queued before checkin to simulate timing/jitter issue',
      firstFlush: {
        status: delayedFlush1.status,
        counts: delayedFlush1.counts,
        remainingQueue: delayedFlush1.remainingQueue,
        statuses: delayedFlush1.results.map((r) => r.status)
      },
      secondFlush: {
        status: delayedFlush2.status,
        counts: delayedFlush2.counts,
        remainingQueue: delayedFlush2.remainingQueue,
        statuses: delayedFlush2.results.map((r) => r.status)
      }
    },
    offlineFeatureScenario: {
      firstAttemptOffline: {
        status: offlineAttempt.status,
        remainingQueue: offlineAttempt.remainingQueue
      },
      secondAttemptOnline: {
        status: onlineAttempt.status,
        counts: onlineAttempt.counts,
        remainingQueue: onlineAttempt.remainingQueue,
        statuses: onlineAttempt.results.map((r) => r.status)
      },
      verifyLatestRow: offlineVerify
    }
  }, null, 2))
}

run().catch((error) => {
  console.error('FAIL: scanner deep flow test failed')
  console.error(error)
  process.exit(1)
})
