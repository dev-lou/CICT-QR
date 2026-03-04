import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const toLocalTimeValue = (iso) => {
    if (!iso) return ''
    try {
        const date = new Date(iso)
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(date)

        const get = (type) => parts.find((p) => p.type === type)?.value || ''
        return `${get('hour')}:${get('minute')}`
    } catch {
        return ''
    }
}

const manilaDateWithTimeToIso = (baseIso, timeValue) => {
    if (!baseIso || !timeValue) return null
    const [hour, minute] = String(timeValue).split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

    const date = new Date(baseIso)
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date)

    const get = (type) => Number(parts.find((p) => p.type === type)?.value)
    const year = get('year')
    const month = get('month')
    const day = get('day')

    if (![year, month, day].every(Number.isFinite)) return null

    const utcMillis = Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0)
    return new Date(utcMillis).toISOString()
}

const formatDateTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
    })
}

const toDateKey = (iso) => {
    if (!iso) return ''
    const date = new Date(iso)
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date)
}

const toMinuteOfDay = (iso) => {
    if (!iso) return null
    const date = new Date(iso)
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value)
    const minute = Number(parts.find((p) => p.type === 'minute')?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return hour * 60 + minute
}

const parseTimeToMinute = (value) => {
    if (!value) return null
    const [hour, minute] = value.split(':').map((v) => Number(v))
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return hour * 60 + minute
}

const hasRealCheckout = (row) => {
    if (!row?.time_out || !row?.time_in) return false
    const inMillis = new Date(row.time_in).getTime()
    const outMillis = new Date(row.time_out).getTime()
    if (!Number.isFinite(inMillis) || !Number.isFinite(outMillis)) return false
    return outMillis > inMillis
}

const getTodayManilaDateKey = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export default function AdminAttendanceFix() {
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState([])
    const [students, setStudents] = useState([])
    const [editValues, setEditValues] = useState({})
    const [statusFilter, setStatusFilter] = useState('all') // all | no_checkout | no_checkin
    const [registeredDate, setRegisteredDate] = useState('')
    const [timeStart, setTimeStart] = useState('')
    const [timeEnd, setTimeEnd] = useState('')

    const resetFilters = useCallback(() => {
        setSearch('')
        setStatusFilter('all')
        setRegisteredDate('')
        setTimeStart('')
        setTimeEnd('')
    }, [])

    const fetchAllRows = useCallback(async (table, selectFields) => {
        if (!supabase) return []
        const pageSize = 1000
        let from = 0
        let done = false
        const collected = []

        while (!done) {
            const to = from + pageSize - 1
            const { data, error } = await supabase
                .from(table)
                .select(selectFields)
                .order('id', { ascending: true })
                .range(from, to)

            if (error) throw error
            const batch = data || []
            collected.push(...batch)

            if (batch.length < pageSize) {
                done = true
            } else {
                from += pageSize
            }
        }

        return collected
    }, [])

    const loadData = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        try {
            const [studentLogRows, staffLogRows, studentRows] = await Promise.all([
                fetchAllRows('logbook', 'id, student_id, time_in, time_out, students(full_name, role, team_name, uuid, created_at)'),
                fetchAllRows('staff_logbook', 'id, student_id, time_in, time_out, students(full_name, role, team_name, uuid, created_at)'),
                fetchAllRows('students', 'id, full_name, role, team_name, uuid, created_at')
            ])

            const mapped = [
                ...(studentLogRows || []).map((row) => ({
                    ...row,
                    source: 'logbook'
                })),
                ...(staffLogRows || []).map((row) => ({
                    ...row,
                    source: 'staff_logbook'
                }))
            ].sort((a, b) => new Date(b.time_in).getTime() - new Date(a.time_in).getTime())

            setRows(mapped)
            setStudents(studentRows || [])

            const initialEdits = {}
            mapped.forEach((row) => {
                initialEdits[`${row.source}:${row.id}`] = {
                    time_in: toLocalTimeValue(row.time_in),
                    time_out: toLocalTimeValue(row.time_out)
                }
            })
            setEditValues(initialEdits)
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Failed to load attendance records',
                text: error?.message || 'Please try again.',
                confirmButtonColor: '#ef4444'
            })
        } finally {
            setLoading(false)
        }
    }, [fetchAllRows])

    useEffect(() => {
        loadData()
    }, [loadData])

    const studentIdsWithCheckIn = useMemo(() => new Set(rows.map((row) => row.student_id)), [rows])
    const noCheckInRows = useMemo(() => {
        return (students || []).filter((student) => !studentIdsWithCheckIn.has(student.id))
    }, [students, studentIdsWithCheckIn])
    const noCheckoutRows = useMemo(() => {
        return rows.filter((row) => !hasRealCheckout(row))
    }, [rows])

    const studentsById = useMemo(() => {
        const map = new Map()
        ;(students || []).forEach((student) => {
            map.set(student.id, student)
        })
        return map
    }, [students])

    const filteredRows = useMemo(() => {
        const term = search.trim().toLowerCase()

        const startMinute = parseTimeToMinute(timeStart)
        const endMinute = parseTimeToMinute(timeEnd)
        const inDateTimeWindow = (isoValue) => {
            if (!registeredDate && startMinute === null && endMinute === null) return true
            if (!isoValue) return false

            if (registeredDate && toDateKey(isoValue) !== registeredDate) {
                return false
            }

            const minuteOfDay = toMinuteOfDay(isoValue)
            if (minuteOfDay === null) return false
            if (startMinute !== null && minuteOfDay < startMinute) return false
            if (endMinute !== null && minuteOfDay > endMinute) return false
            return true
        }

        const buildNoCheckInRows = () => {
            const rowsToEvaluate = registeredDate
                ? rows.filter((row) => toDateKey(row.time_in) === registeredDate)
                : rows

            const idsWithCheckIn = new Set(rowsToEvaluate.map((row) => row.student_id))
            return (students || []).filter((student) => {
                if (idsWithCheckIn.has(student.id)) return false

                if (!term) return true
                const name = String(student.full_name || '').toLowerCase()
                const role = String(student.role || '').toLowerCase()
                const team = String(student.team_name || '').toLowerCase()
                return name.includes(term) || role.includes(term) || team.includes(term)
            }).map((student) => ({
                id: student.id,
                student_id: student.id,
                source: 'students',
                time_in: null,
                time_out: null,
                students: {
                    full_name: student.full_name,
                    role: student.role,
                    team_name: student.team_name,
                    uuid: student.uuid,
                    created_at: student.created_at
                }
            }))
        }

        if (statusFilter === 'no_checkin') {
            return buildNoCheckInRows()
        }

        const attendanceRows = rows.filter((row) => {
            if (statusFilter === 'no_checkout' && hasRealCheckout(row)) return false
            if (!inDateTimeWindow(row.time_in)) return false

            if (!term) return true
            const student = row.students || studentsById.get(row.student_id) || {}
            const name = String(student.full_name || '').toLowerCase()
            const role = String(student.role || '').toLowerCase()
            const team = String(student.team_name || '').toLowerCase()
            return name.includes(term) || role.includes(term) || team.includes(term)
        })

        if (statusFilter === 'all') {
            return [...attendanceRows, ...buildNoCheckInRows()]
        }

        return attendanceRows
    }, [rows, students, studentsById, search, statusFilter, registeredDate, timeStart, timeEnd])

    const saveRow = async (row) => {
        if (!supabase) return
        const key = `${row.source}:${row.id}`
        const editValue = editValues[key] || { time_in: '', time_out: '' }

        setSavingId(key)
        try {
            const dateKeyForSave = registeredDate || getTodayManilaDateKey()
            const baseIsoForDate = new Date(`${dateKeyForSave}T00:00:00+08:00`).toISOString()

            const baseIsoForTimeIn = row.time_in || baseIsoForDate
            const timeInPayload = manilaDateWithTimeToIso(baseIsoForTimeIn, editValue.time_in)
            const baseForTimeOut = row.time_out || timeInPayload || baseIsoForDate
            const timeOutPayload = editValue.time_out ? manilaDateWithTimeToIso(baseForTimeOut, editValue.time_out) : null

            if (!timeInPayload) {
                throw new Error('Check-in value is required.')
            }

            if (timeOutPayload) {
                const inMillis = new Date(timeInPayload).getTime()
                const outMillis = new Date(timeOutPayload).getTime()
                if (!Number.isFinite(inMillis) || !Number.isFinite(outMillis) || outMillis <= inMillis) {
                    throw new Error('Check-out must be later than check-in.')
                }
            }

            if (row.source === 'students') {
                const role = String(row.students?.role || '').toLowerCase()
                const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(role)
                const table = isStaff ? 'staff_logbook' : 'logbook'

                const resp = await fetch('/api/attendance-fix', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'insert', table, student_id: row.student_id, time_in: timeInPayload, time_out: timeOutPayload })
                })
                const result = await resp.json()
                if (!resp.ok) throw new Error(result.error || 'Insert failed')
                const inserted = result.data

                const insertedRow = {
                    ...(inserted || {}),
                    source: table,
                    students: {
                        full_name: row.students?.full_name,
                        role: row.students?.role,
                        team_name: row.students?.team_name,
                        uuid: row.students?.uuid,
                        created_at: row.students?.created_at
                    }
                }

                setRows((prev) => [insertedRow, ...prev].sort((a, b) => new Date(b.time_in).getTime() - new Date(a.time_in).getTime()))
                setEditValues((prev) => ({
                    ...prev,
                    [`${table}:${inserted.id}`]: {
                        time_in: toLocalTimeValue(inserted.time_in),
                        time_out: toLocalTimeValue(inserted.time_out)
                    }
                }))

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Attendance row created',
                    showConfirmButton: false,
                    timer: 1800,
                    background: '#1e293b',
                    color: '#fff'
                })
                return
            }

            const resp = await fetch('/api/attendance-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', table: row.source, id: row.id, time_in: timeInPayload, time_out: timeOutPayload })
            })
            const result = await resp.json()
            if (!resp.ok) throw new Error(result.error || 'Update failed')

            setRows((prev) => prev.map((item) => {
                if (item.id === row.id && item.source === row.source) {
                    return { ...item, time_in: timeInPayload, time_out: timeOutPayload }
                }
                return item
            }))

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Attendance updated',
                showConfirmButton: false,
                timer: 1800,
                background: '#1e293b',
                color: '#fff'
            })
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Save failed',
                text: error?.message || 'Could not update record.',
                confirmButtonColor: '#ef4444'
            })
        } finally {
            setSavingId(null)
        }
    }

    const deleteRow = async (row) => {
        if (!supabase) return
        if (row.source === 'students') {
            Swal.fire({
                icon: 'info',
                title: 'No attendance row to delete',
                text: 'This user has no check-in record yet.',
                confirmButtonColor: '#C9A84C'
            })
            return
        }

        const key = `${row.source}:${row.id}`
        const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'Delete attendance record?',
            text: 'This will permanently remove this attendance row.',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b'
        })

        if (!confirmed.isConfirmed) return

        setDeletingId(key)
        try {
            const resp = await fetch('/api/attendance-fix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', table: row.source, id: row.id })
            })
            const result = await resp.json()
            if (!resp.ok) throw new Error(result.error || 'Delete failed')

            setRows((prev) => prev.filter((item) => !(item.source === row.source && item.id === row.id)))
            setEditValues((prev) => {
                const next = { ...prev }
                delete next[key]
                return next
            })

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Attendance deleted',
                showConfirmButton: false,
                timer: 1800,
                background: '#1e293b',
                color: '#fff'
            })
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Delete failed',
                text: error?.message || 'Could not delete record.',
                confirmButtonColor: '#ef4444'
            })
        } finally {
            setDeletingId(null)
        }
    }

    const exportMissingAttendance = useCallback(() => {
        const noCheckInExportRows = noCheckInRows.map((student) => ({
            name: student.full_name || 'Unknown',
            role: student.role || '—',
            team: student.team_name || '—',
            status: 'NO_CHECK_IN',
            checkIn: '',
            checkOut: ''
        }))

        const noCheckoutExportRows = noCheckoutRows.map((row) => ({
            name: row.students?.full_name || 'Unknown',
            role: row.students?.role || '—',
            team: row.students?.team_name || '—',
            status: 'NO_CHECK_OUT',
            checkIn: formatDateTime(row.time_in),
            checkOut: ''
        }))

        const allRows = [...noCheckInExportRows, ...noCheckoutExportRows]
        if (allRows.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Nothing to export',
                text: 'No people found with missing check-in or check-out.',
                confirmButtonColor: '#C9A84C'
            })
            return
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('Missing Attendance Report', 40, 38)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.text(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`, 40, 56)
        doc.text(`No Check-in: ${noCheckInExportRows.length}   No Check-out: ${noCheckoutExportRows.length}`, 40, 71)

        autoTable(doc, {
            startY: 86,
            head: [['Name', 'Role', 'Team', 'Missing Status', 'Check-in (Manila)', 'Check-out (Manila)']],
            body: allRows.map((entry) => ([
                entry.name,
                entry.role,
                entry.team,
                entry.status,
                entry.checkIn || '—',
                entry.checkOut || '—'
            ])),
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 32, right: 32 }
        })

        doc.save(`missing-attendance-${new Date().toISOString().slice(0, 10)}.pdf`)
    }, [noCheckInRows, noCheckoutRows])

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 40%, #111827 100%)', color: 'white', padding: '2rem' }}>
            <div style={{ maxWidth: '88rem', margin: '0 auto' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', padding: '1rem 1.1rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', background: 'rgba(15,23,42,0.7)' }}>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>Attendance Fix Console</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.68)' }}>Desktop tool: search, edit, delete, and export missing attendance.</div>
                        <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.52)', marginTop: '0.2rem' }}>Loaded: {rows.length} attendance rows • {students.length} registered users</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={exportMissingAttendance}
                            style={{ padding: '0.58rem 0.95rem', borderRadius: '0.75rem', border: '1px solid rgba(16,185,129,0.45)', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', cursor: 'pointer', fontWeight: 800 }}
                        >
                            Export Missing PDF
                        </button>
                        <button
                            onClick={resetFilters}
                            style={{ padding: '0.55rem 0.9rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                        >
                            Clear Filters
                        </button>
                        <button
                            onClick={loadData}
                            style={{ padding: '0.55rem 0.9rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
                    <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '0.9rem', padding: '0.8rem 0.9rem', background: 'rgba(30,41,59,0.5)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>TOTAL ATTENDANCE ROWS</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#C9A84C' }}>{rows.length}</div>
                    </div>
                    <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '0.9rem', padding: '0.8rem 0.9rem', background: 'rgba(30,41,59,0.5)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>NO CHECK-IN</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f59e0b' }}>{noCheckInRows.length}</div>
                    </div>
                    <div style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '0.9rem', padding: '0.8rem 0.9rem', background: 'rgba(30,41,59,0.5)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>NO CHECK-OUT</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ef4444' }}>{noCheckoutRows.length}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', padding: '0.85rem', borderRadius: '0.9rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.55)' }}>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search name / role / team'
                        style={{ flex: 1, minWidth: '260px', padding: '0.7rem 0.9rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white', outline: 'none' }}
                    />
                    <button onClick={() => setStatusFilter('all')} style={{ padding: '0.55rem 0.8rem', borderRadius: '0.7rem', border: '1px solid rgba(255,255,255,0.15)', background: statusFilter === 'all' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>All</button>
                    <button onClick={() => setStatusFilter('no_checkout')} style={{ padding: '0.55rem 0.8rem', borderRadius: '0.7rem', border: '1px solid rgba(255,255,255,0.15)', background: statusFilter === 'no_checkout' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>No Checkout</button>
                    <button onClick={() => setStatusFilter('no_checkin')} style={{ padding: '0.55rem 0.8rem', borderRadius: '0.7rem', border: '1px solid rgba(255,255,255,0.15)', background: statusFilter === 'no_checkin' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>No Check-in</button>
                    <input
                        type='date'
                        value={registeredDate}
                        onChange={(e) => setRegisteredDate(e.target.value)}
                        style={{ padding: '0.55rem 0.7rem', borderRadius: '0.7rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white' }}
                    />
                    <input
                        type='time'
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        style={{ padding: '0.55rem 0.7rem', borderRadius: '0.7rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white' }}
                    />
                    <input
                        type='time'
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        style={{ padding: '0.55rem 0.7rem', borderRadius: '0.7rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white' }}
                    />
                </div>

                <div style={{ marginBottom: '0.8rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>
                    {`Showing ${filteredRows.length} record(s)`}
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', overflow: 'hidden', background: 'rgba(30,41,59,0.35)', boxShadow: '0 18px 45px rgba(0,0,0,0.25)' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#C9A84C', fontWeight: 800 }}>Loading attendance records...</div>
                    ) : filteredRows.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>No matching records.</div>
                    ) : (
                        <div style={{ maxHeight: '72vh', overflowY: 'auto', overflowX: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', tableLayout: 'fixed' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.35)' }}>
                                        {['Name', 'Role', 'Team', 'Check-in', 'Check-out', 'State', 'Edit Time (HH:mm)', 'Action'].map((h) => (
                                            <th key={h} style={{ position: 'sticky', top: 0, zIndex: 2, padding: '0.72rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.6)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row, index) => {
                                        const key = `${row.source}:${row.id}`
                                        const rowStudent = row.students || studentsById.get(row.student_id) || {}
                                        const isSyntheticNoCheckIn = row.source === 'students'
                                        const state = row.source === 'students' ? 'No Check-in' : (!hasRealCheckout(row) ? 'No Check-out' : 'Complete')
                                        const stateColor = state === 'No Check-in' ? '#f59e0b' : state === 'No Check-out' ? '#ef4444' : '#10b981'
                                        return (
                                            <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: index % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'rgba(15,23,42,0.2)' }}>
                                                <td style={{ padding: '0.65rem', fontWeight: 700, wordBreak: 'break-word' }}>{rowStudent.full_name || 'Unknown'}</td>
                                                <td style={{ padding: '0.65rem', textTransform: 'capitalize' }}>{rowStudent.role || '—'}</td>
                                                <td style={{ padding: '0.65rem', wordBreak: 'break-word' }}>{rowStudent.team_name || '—'}</td>
                                                <td style={{ padding: '0.65rem' }}>{formatDateTime(row.time_in)}</td>
                                                <td style={{ padding: '0.65rem', color: hasRealCheckout(row) ? 'white' : '#f59e0b', fontWeight: 700 }}>{formatDateTime(row.time_out)}</td>
                                                <td style={{ padding: '0.65rem' }}>
                                                    <span style={{ padding: '0.2rem 0.52rem', borderRadius: '999px', border: `1px solid ${stateColor}55`, color: stateColor, fontWeight: 800, fontSize: '0.72rem' }}>{state}</span>
                                                </td>
                                                <td style={{ padding: '0.65rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                        <input
                                                            type='time'
                                                            value={editValues[key]?.time_in || ''}
                                                            onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), time_in: e.target.value } }))}
                                                            style={{ width: '100%', padding: '0.38rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white' }}
                                                        />
                                                        <input
                                                            type='time'
                                                            value={editValues[key]?.time_out || ''}
                                                            onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), time_out: e.target.value } }))}
                                                            style={{ width: '100%', padding: '0.38rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: 'white' }}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.65rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'stretch' }}>
                                                        <button
                                                            onClick={() => saveRow(row)}
                                                            disabled={savingId === key || deletingId === key}
                                                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.55rem', border: 'none', background: '#C9A84C', color: '#0f172a', fontWeight: 800, cursor: savingId === key || deletingId === key ? 'not-allowed' : 'pointer', opacity: savingId === key || deletingId === key ? 0.6 : 1 }}
                                                        >
                                                            {isSyntheticNoCheckIn ? (savingId === key ? 'Adding...' : 'Add Row') : (savingId === key ? 'Saving...' : 'Save')}
                                                        </button>
                                                        <button
                                                            onClick={() => deleteRow(row)}
                                                            disabled={deletingId === key || savingId === key || isSyntheticNoCheckIn}
                                                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.55rem', border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.15)', color: '#fecaca', fontWeight: 800, cursor: deletingId === key || savingId === key || isSyntheticNoCheckIn ? 'not-allowed' : 'pointer', opacity: deletingId === key || savingId === key || isSyntheticNoCheckIn ? 0.6 : 1 }}
                                                        >
                                                            {deletingId === key ? 'Deleting...' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
