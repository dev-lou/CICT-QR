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

async function run() {
  const root = process.cwd()
  const envPath = path.join(root, '.env')
  const env = readEnvFile(envPath)

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const stamp = Date.now()
  const teamName = 'offline test'
  const username = `offline_test_${stamp}`

  const { error: teamErr } = await supabase
    .from('teams')
    .upsert([{ name: teamName, score: 150 }], { onConflict: 'name' })
  if (teamErr) throw teamErr

  const { data: student, error: studentErr } = await supabase
    .from('students')
    .insert([{
      full_name: 'offline test',
      username,
      password: 'offline_test_password',
      team_name: teamName,
      role: 'student'
    }])
    .select('id, uuid, full_name, team_name, created_at')
    .single()

  if (studentErr) throw studentErr

  const { data: log, error: logErr } = await supabase
    .from('logbook')
    .insert([{ student_id: student.id }])
    .select('id, student_id, time_in, time_out')
    .single()

  if (logErr) throw logErr

  const { data: verifyStudent, error: verifyStudentErr } = await supabase
    .from('students')
    .select('id, full_name, team_name')
    .eq('id', student.id)
    .single()

  if (verifyStudentErr) throw verifyStudentErr

  const { data: verifyLog, error: verifyLogErr } = await supabase
    .from('logbook')
    .select('id, student_id, time_in')
    .eq('id', log.id)
    .single()

  if (verifyLogErr) throw verifyLogErr

  console.log('PASS: Real DB test insert completed')
  console.log(JSON.stringify({
    student: verifyStudent,
    logbook: verifyLog
  }, null, 2))
}

run().catch((err) => {
  console.error('FAIL: Real DB test insert failed')
  console.error(err)
  process.exit(1)
})
