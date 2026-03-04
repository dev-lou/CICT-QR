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

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    }
  }
}

async function invokeScanHandler(handler, body, adminHeaders = {}) {
  const req = { method: 'POST', body, headers: adminHeaders }
  const res = createMockRes()
  await handler(req, res)
  return { statusCode: res.statusCode, payload: res.payload }
}

function assertStatusOk(result, label) {
  if (result.statusCode !== 200) {
    throw new Error(`${label} failed with HTTP ${result.statusCode}: ${JSON.stringify(result.payload)}`)
  }
  const first = Array.isArray(result.payload?.results) ? result.payload.results[0] : null
  if (!first) throw new Error(`${label} returned no result item`)
  if (first.status !== 'ok') {
    throw new Error(`${label} returned status '${first.status}' (${first.message || 'no message'})`)
  }
}

async function run() {
  const env = readEnvFile(path.join(process.cwd(), '.env'))
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  }

  process.env.SUPABASE_URL = supabaseUrl
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Fetch a real admin to authenticate with
  const { data: admins, error: adminFetchErr } = await supabase
    .from('admins')
    .select('id, email')
    .limit(1)

  if (adminFetchErr) throw new Error('Admin fetch error: ' + adminFetchErr.message)
  const admin = Array.isArray(admins) ? admins[0] : admins
  if (!admin) throw new Error('No admin found in admins table for test auth')
  const adminHeaders = { 'x-admin-email': admin.email, 'x-admin-id': String(admin.id) }

  const stamp = Date.now()
  const username = `api_scan_test_${stamp}`
  const fullName = `API Scan Test ${stamp}`

  const { data: student, error: createErr } = await supabase
    .from('students')
    .insert([{ full_name: fullName, username, password: 'api_scan_test_password', role: 'student', team_name: 'offline test' }])
    .select('id, uuid, full_name, role')
    .single()

  if (createErr) throw createErr

  const cleanup = async () => {
    await supabase.from('audit_logs').delete().eq('student_id', student.id).then(() => {}).catch(() => {})
    await supabase.from('logbook').delete().eq('student_id', student.id).then(() => {}).catch(() => {})
    await supabase.from('staff_logbook').delete().eq('student_id', student.id).then(() => {}).catch(() => {})
    await supabase.from('students').delete().eq('id', student.id).then(() => {}).catch(() => {})
  }

  try {
    const { default: handler } = await import('../api/scan.js')

    const checkIn = await invokeScanHandler(handler, {
      entries: [{ idx: 0, uuid: student.uuid, mode: 'time-in', queued_at: new Date().toISOString() }]
    }, adminHeaders)
    assertStatusOk(checkIn, 'Check-in')

    const checkOut = await invokeScanHandler(handler, {
      entries: [{ idx: 0, uuid: student.uuid, mode: 'time-out', queued_at: new Date().toISOString() }]
    }, adminHeaders)
    assertStatusOk(checkOut, 'Check-out')

    const { data: latestRows, error: verifyErr } = await supabase
      .from('logbook')
      .select('id, student_id, time_in, time_out')
      .eq('student_id', student.id)
      .order('time_in', { ascending: false })
      .limit(1)

    if (verifyErr) throw verifyErr

    const latest = latestRows?.[0]
    if (!latest) throw new Error('No logbook row found after scan flow')
    if (!latest.time_in) throw new Error('time_in missing after check-in')
    if (!latest.time_out) throw new Error('time_out missing after check-out')

    const inMs = new Date(latest.time_in).getTime()
    const outMs = new Date(latest.time_out).getTime()
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) {
      throw new Error(`Invalid time order: time_in=${latest.time_in}, time_out=${latest.time_out}`)
    }

    console.log('PASS: Current API scan path check-in/check-out saved to database')
    console.log(JSON.stringify({
      student: { id: student.id, uuid: student.uuid, full_name: student.full_name },
      checkInResult: checkIn.payload.results[0],
      checkOutResult: checkOut.payload.results[0],
      verifiedLogbookRow: latest
    }, null, 2))
  } finally {
    await cleanup()
  }
}

run().catch((error) => {
  console.error('FAIL: Current API scan DB check failed')
  console.error(error)
  process.exit(1)
})
