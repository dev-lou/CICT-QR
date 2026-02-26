import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LogbookPage({ uuid }) {
    const navigate = useNavigate()
    const [myStudent, setMyStudent] = useState(null)
    const [logbook, setLogbook] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [dayFilter, setDayFilter] = useState('all')
    const [myRole, setMyRole] = useState('student')

    const fetchData = useCallback(async () => {
        if (!supabase || !uuid) return
        setLoading(true)
        try {
            const { data: me } = await supabase
                .from('students')
                .select('id, full_name, team_name, role')
                .eq('uuid', uuid)
                .single()
            if (!me) { navigate('/'); return }
            setMyStudent(me)
            const role = me.role || 'student'
            setMyRole(role)

            if (role === 'leader' || role === 'facilitator') {
                // Staff see the staff_logbook
                const { data: logs } = await supabase
                    .from('staff_logbook')
                    .select('id, time_in, time_out, event, students(id, full_name, team_name, role)')
                    .order('time_in', { ascending: false })
                setLogbook(logs || [])
            } else {
                // Students see the regular logbook
                const { data: logs } = await supabase
                    .from('logbook')
                    .select('id, time_in, time_out, students(id, full_name, team_name)')
                    .order('time_in', { ascending: false })
                setLogbook(logs || [])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [uuid, navigate])

    useEffect(() => { fetchData() }, [fetchData])

    const TZ = 'Asia/Manila'
    const fmtTime = (iso) => {
        if (!iso) return '—'
        return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ })
    }
    const fmtDate = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })
    }
    const fmtDateFull = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })
    }
    const dayKey = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
    }
    const duration = (inT, outT) => {
        if (!outT) return null
        const ms = new Date(outT) - new Date(inT)
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    const eventDays = [...new Set(logbook.map((r) => dayKey(r.time_in)).filter(Boolean))].sort().reverse()

    const filtered = logbook.filter((r) => {
        if (dayFilter !== 'all' && dayKey(r.time_in) !== dayFilter) return false
        if (filter === 'in') return !r.time_out
        if (filter === 'out') return !!r.time_out
        return true
    })

    const isMe = (row) => myStudent && row.students?.id === myStudent.id

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1' }} />
            </div>
        )
    }

    const presentCount = logbook.filter(r => !r.time_out).length

    const thStyle = {
        padding: '0.625rem 0.875rem',
        fontSize: '0.6875rem',
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        background: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
        whiteSpace: 'nowrap',
        textAlign: 'left',
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

            {/* ── Header ── */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', minWidth: '2.25rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', cursor: 'pointer', color: '#64748b' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.2 }}>
                            {myRole === 'leader' || myRole === 'facilitator' ? '📋 Staff Logbook' : '📋 Attendance Logbook'}
                        </p>
                        {myStudent && (
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                                Signed in as <span style={{ color: '#7B1C1C', fontWeight: 600 }}>{myStudent.full_name}</span>
                                {' · '}
                                <span style={{ textTransform: 'capitalize' }}>{myRole}</span>
                                {' · your rows are highlighted'}
                            </p>
                        )}
                    </div>
                    <button onClick={fetchData}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.625rem', background: '#f1f5f9', border: '1.5px solid #e2e8f0', color: '#6366f1', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8125rem' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1rem' }}>

                {/* ── Stats ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[
                        { label: 'Total Entries', value: logbook.length, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
                        { label: 'Present', value: presentCount, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                        { label: 'Done', value: logbook.filter(r => !!r.time_out).length, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
                    ].map((s) => (
                        <div key={s.label} style={{ background: 'white', borderRadius: '0.875rem', padding: '1rem 0.75rem', textAlign: 'center', border: `1.5px solid ${s.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</p>
                            <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Filters ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'white', borderRadius: '0.625rem', padding: '0.25rem', border: '1.5px solid #e2e8f0' }}>
                        {[{ id: 'all', label: 'All' }, { id: 'in', label: '● Present' }, { id: 'out', label: 'Done' }].map((f) => (
                            <button key={f.id} onClick={() => setFilter(f.id)}
                                style={{ padding: '0.3rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: filter === f.id ? '#6366f1' : 'transparent', color: filter === f.id ? 'white' : '#64748b', transition: 'all 0.15s' }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {eventDays.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setDayFilter('all')}
                                style={{ padding: '0.3rem 0.625rem', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: dayFilter === 'all' ? '#6366f1' : '#e2e8f0', background: dayFilter === 'all' ? '#eef2ff' : 'white', color: dayFilter === 'all' ? '#4f46e5' : '#64748b' }}>
                                All Days
                            </button>
                            {eventDays.map((d) => (
                                <button key={d} onClick={() => setDayFilter(d)}
                                    style={{ padding: '0.3rem 0.625rem', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: dayFilter === d ? '#6366f1' : '#e2e8f0', background: dayFilter === d ? '#eef2ff' : 'white', color: dayFilter === d ? '#4f46e5' : '#64748b' }}>
                                    {fmtDateFull(d + 'T00:00:00')}
                                </button>
                            ))}
                        </div>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                    </span>
                </div>

                {/* ── TABLE ── */}
                <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '2.5rem', textAlign: 'center' }}>#</th>
                                    <th style={thStyle}>Name</th>
                                    <th style={thStyle}>Team</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Time In</th>
                                    <th style={thStyle}>Time Out</th>
                                    <th style={thStyle}>Duration</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                            No records found
                                        </td>
                                    </tr>
                                ) : filtered.map((row, i) => {
                                    const mine = isMe(row)
                                    const dur = duration(row.time_in, row.time_out)
                                    const cellBg = mine
                                        ? 'rgba(99,102,241,0.05)'
                                        : i % 2 === 0 ? 'white' : '#fafafa'
                                    const tdBase = {
                                        padding: '0.75rem 0.875rem',
                                        borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        background: cellBg,
                                        verticalAlign: 'middle',
                                    }
                                    return (
                                        <motion.tr key={row.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                            style={{ borderLeft: mine ? '3px solid #6366f1' : '3px solid transparent' }}
                                        >
                                            <td style={{ ...tdBase, textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>{i + 1}</td>
                                            <td style={tdBase}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                    {mine && (
                                                        <span style={{ fontSize: '0.5625rem', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', color: 'white', borderRadius: '99px', padding: '0.1rem 0.4rem', fontWeight: 700, flexShrink: 0 }}>You</span>
                                                    )}
                                                    <span style={{ fontWeight: mine ? 700 : 500, color: mine ? '#4f46e5' : '#0f172a', whiteSpace: 'nowrap' }}>
                                                        {row.students?.full_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={tdBase}>
                                                <span style={{ background: '#eef2ff', color: '#4f46e5', fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '99px', whiteSpace: 'nowrap' }}>
                                                    {row.students?.team_name}
                                                </span>
                                            </td>
                                            <td style={{ ...tdBase, color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{fmtDate(row.time_in)}</td>
                                            <td style={{ ...tdBase, color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_in)}</td>
                                            <td style={{ ...tdBase, color: row.time_out ? '#0f172a' : '#cbd5e1', fontWeight: row.time_out ? 600 : 400, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                                {fmtTime(row.time_out)}
                                            </td>
                                            <td style={{ ...tdBase, color: dur ? '#475569' : '#cbd5e1', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{dur ?? '—'}</td>
                                            <td style={{ ...tdBase, textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.625rem', borderRadius: '99px', fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap',
                                                    background: row.time_out ? '#f1f5f9' : '#dcfce7',
                                                    color: row.time_out ? '#64748b' : '#16a34a',
                                                    border: `1px solid ${row.time_out ? '#e2e8f0' : '#86efac'}`,
                                                }}>
                                                    {row.time_out ? 'Done' : '● Present'}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', marginTop: '1.25rem', paddingBottom: '1rem' }}>
                    Built by Lou Vincent Baroro
                </p>
            </div>
        </div>
    )
}
