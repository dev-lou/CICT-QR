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
    const [currentPage, setCurrentPage] = useState(1)
    const [initialJump, setInitialJump] = useState(true)
    const pageSize = 30

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

            if (role === 'leader' || role === 'facilitator' || role === 'executive' || role === 'officer') {
                // Staff see the staff_logbook
                try {
                    const { data, error } = await supabase
                        .from('staff_logbook')
                        .select('id, time_in, time_out, students(id, full_name, team_name, uuid, role)')
                        .order('time_in', { ascending: true })
                    if (error) throw error
                    setLogbook(data || [])
                    if (initialJump && data && data.length > pageSize) {
                        const lp = Math.ceil(data.length / pageSize)
                        setCurrentPage(lp)
                        setInitialJump(false)
                    }
                } catch (err) {
                    console.error('Staff log fetch failed:', err)
                    setLogbook([])
                }
            } else {
                // Students see the regular logbook
                const { data: logs } = await supabase
                    .from('logbook')
                    .select('id, time_in, time_out, students(id, full_name, team_name)')
                    .order('time_in', { ascending: true })
                setLogbook(logs || [])
                if (initialJump && logs && logs.length > pageSize) {
                    const lp = Math.ceil(logs.length / pageSize)
                    setCurrentPage(lp)
                    setInitialJump(false)
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [uuid, navigate])

    useEffect(() => { fetchData() }, [fetchData])
    useEffect(() => { setCurrentPage(1) }, [filter, dayFilter])

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

    const totalPages = Math.ceil(filtered.length / pageSize)
    const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
            {/* Holographic Header Gradient */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #7B1C1C, #C9A84C, #7B1C1C)', zIndex: 100 }} />

            {/* Ambient Background Glows */}
            <div style={{ position: 'fixed', top: '-10rem', right: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '-10rem', left: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            {/* ── Header ── */}
            {/* Premium Header */}
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/')}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: '#C9A84C' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </motion.button>

                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <h1 style={{ fontWeight: 900, fontSize: '0.9375rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, overflow: 'hidden' }}>
                            <span style={{ color: '#C9A84C', flexShrink: 0, fontSize: '0.75rem' }}>PROTOCOL:</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {myRole === 'leader' || myRole === 'facilitator' || myRole === 'executive' || myRole === 'officer' ? 'STAFF LOGBOOK' : 'ATTENDANCE LOG'}
                            </span>
                        </h1>
                        {myStudent && (
                            <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ color: 'rgba(255,255,255,0.7)' }}>{myStudent.full_name}</span>
                                <span style={{ margin: '0 0.3rem', opacity: 0.3 }}>·</span>
                                <span style={{ color: '#C9A84C' }}>{myRole.toUpperCase()}</span>
                            </p>
                        )}
                    </div>

                    <motion.button whileHover={{ scale: 1.1, background: 'rgba(201,168,76,0.15)' }} whileTap={{ scale: 0.9 }}
                        onClick={fetchData} className="luxury-hover"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', cursor: 'pointer' }}
                        title="Refresh Archives"
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </motion.button>
                </div>
            </div>

            <main style={{ maxWidth: '72rem', margin: '0 auto', padding: '1.5rem', position: 'relative', zIndex: 1 }}>

                {/* ── Dashboard Stats ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                    {[
                        { label: 'TOTAL SESSIONS', value: logbook.length, color: '#C9A84C', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'ACTIVE NOW', value: presentCount, color: '#10b981', icon: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 12a1 1 0 100-2 1 1 0 000 2z' },
                        { label: 'COMPLETED', value: logbook.filter(r => !!r.time_out).length, color: 'rgba(255,255,255,0.4)', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                    ].map((s) => (
                        <div key={s.label} className="luxury-card" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                            <p style={{ fontSize: '2rem', fontWeight: 900, color: s.color, letterSpacing: '-0.04em', margin: 0 }}>{s.value}</p>
                            <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Refined Filters ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="luxury-card" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '0.375rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                {[{ id: 'all', label: 'All' }, { id: 'in', label: 'Present' }, { id: 'out', label: 'Done' }].map((f) => (
                                    <button key={f.id} onClick={() => setFilter(f.id)}
                                        style={{ padding: '0.5rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: filter === f.id ? 'rgba(255,255,255,0.08)' : 'transparent', color: filter === f.id ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s', textTransform: 'uppercase' }}>
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <div style={{ flex: 1, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button onClick={() => setDayFilter('all')}
                                    style={{ padding: '0.5rem 1rem', borderRadius: '0.875rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: dayFilter === 'all' ? '#C9A84C' : 'rgba(255,255,255,0.05)', background: dayFilter === 'all' ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)', color: dayFilter === 'all' ? '#C9A84C' : 'rgba(255,255,255,0.3)' }}>
                                    ALL DAYS
                                </button>
                                {eventDays.map((d) => (
                                    <button key={d} onClick={() => setDayFilter(d)}
                                        style={{ padding: '0.5rem 1rem', borderRadius: '0.875rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: dayFilter === d ? '#C9A84C' : 'rgba(255,255,255,0.05)', background: dayFilter === d ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)', color: dayFilter === d ? '#C9A84C' : 'rgba(255,255,255,0.3)' }}>
                                        {fmtDateFull(d + 'T00:00:00').toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {filtered.length} ARCHIVES LOADED
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── ARCHIVE GRID / TABLE ── */}
                <div className="luxury-card">
                    {filtered.length === 0 ? (
                        <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>EMPTY REPOSITORY</p>
                            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>No attendance signatures localized for this temporal sector.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>#</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>ENTITY NAME</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>DESIGNATION</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>AFFILIATION</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>TEMPORAL STAMP</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>ENTRY</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>EXIT</th>
                                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'center', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, i) => {
                                        const mine = isMe(row)
                                        const globalIndex = (currentPage - 1) * pageSize + i + 1
                                        const roleColor = row.students?.role === 'leader' ? '#ef4444' : row.students?.role === 'facilitator' ? '#f59e0b' : row.students?.role === 'executive' ? '#10b981' : row.students?.role === 'officer' ? '#6366f1' : 'rgba(255,255,255,0.4)'

                                        return (
                                            <motion.tr key={row.id || `empty-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                                className="luxury-table-row" style={{ background: mine ? 'rgba(201,168,76,0.03)' : 'transparent' }}>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontWeight: 800 }}>{globalIndex}</td>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {mine && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C' }} />}
                                                        <span style={{ fontWeight: 800, color: mine ? '#C9A84C' : 'white', fontSize: '0.9375rem' }}>{row.students?.full_name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <span style={{ background: `${roleColor}10`, color: roleColor, fontSize: '0.625rem', fontWeight: 900, padding: '0.25rem 0.625rem', borderRadius: '4px', border: `1px solid ${roleColor}25`, textTransform: 'uppercase' }}>
                                                        {row.students?.role || 'student'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.75rem' }}>{row.students?.team_name?.toUpperCase() || '—'}</span>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 600 }}>{fmtDate(row.time_in)}</td>
                                                <td style={{ padding: '1rem 1.5rem', color: 'white', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_in)}</td>
                                                <td style={{ padding: '1rem 1.5rem', color: row.time_out ? 'white' : 'rgba(255,255,255,0.1)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{row.time_out ? fmtTime(row.time_out) : '--:--'}</td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem', borderRadius: '99px', fontSize: '0.625rem', fontWeight: 900,
                                                        background: row.time_out ? 'rgba(255,255,255,0.03)' : 'rgba(16,185,129,0.1)',
                                                        color: row.time_out ? 'rgba(255,255,255,0.3)' : '#10b981',
                                                        border: `1px solid ${row.time_out ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.2)'}`
                                                    }}>
                                                        {!row.time_out && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />}
                                                        {row.time_out ? 'ARCHIVED' : 'ACTIVE'}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )
                                    })}
                                    {/* Placeholders */}
                                    {Array.from({ length: pageSize - paginatedData.length }).map((_, pi) => (
                                        <tr key={`filler-${pi}`} style={{ height: '3.75rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                            <td colSpan={8} style={{ padding: '0 1.5rem', opacity: 0.03 }}>
                                                <div style={{ height: '0.5rem', background: 'white', borderRadius: '4px', width: '100%' }} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Mobile Cards */}
                            <div className="mobile-cards" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {paginatedData.map((row, i) => {
                                        const mine = isMe(row)
                                        const roleColor = row.students?.role === 'leader' ? '#ef4444' : row.students?.role === 'facilitator' ? '#f59e0b' : row.students?.role === 'executive' ? '#10b981' : row.students?.role === 'officer' ? '#6366f1' : 'rgba(255,255,255,0.4)'

                                        return (
                                            <motion.div key={row.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                                style={{ background: mine ? 'rgba(201,168,76,0.04)' : 'rgba(255,255,255,0.02)', border: mine ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {mine && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }} />}
                                                            <p style={{ fontWeight: 900, color: mine ? '#C9A84C' : 'white', fontSize: '1rem', letterSpacing: '-0.01em', margin: 0 }}>{row.students?.full_name}</p>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                            <span style={{ color: roleColor, fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase' }}>{row.students?.role || 'student'}</span>
                                                            <span style={{ color: '#C9A84C', fontSize: '0.625rem', fontWeight: 800 }}>•</span>
                                                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.625rem', fontWeight: 800 }}>{row.students?.team_name?.toUpperCase() || 'UNAFFILIATED'}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase',
                                                        background: row.time_out ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.1)',
                                                        color: row.time_out ? 'rgba(255,255,255,0.4)' : '#10b981',
                                                        border: `1px solid ${row.time_out ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.2)'}`
                                                    }}>
                                                        {row.time_out ? 'ARCHIVED' : 'ACTIVE'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.875rem' }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>TIME IN</p>
                                                        <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'white' }}>{fmtTime(row.time_in)}</p>
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>TIME OUT</p>
                                                        <p style={{ fontSize: '0.875rem', fontWeight: 800, color: row.time_out ? 'white' : 'rgba(255,255,255,0.1)' }}>{row.time_out ? fmtTime(row.time_out) : '--:--'}</p>
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', fontWeight: 700, marginTop: '0.875rem', textAlign: 'right' }}>{fmtDateFull(row.time_in).toUpperCase()}</p>
                                            </motion.div>
                                        )
                                    })}
                                    {/* Placeholders */}
                                    {Array.from({ length: pageSize - paginatedData.length }).map((_, pi) => (
                                        <div key={`filler-mob-${pi}`}
                                            style={{ height: '8rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ width: '40%', height: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 0 && (
                                <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === 1 ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                                        PREV
                                    </button>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>
                                        PAGE <span style={{ color: '#C9A84C' }}>{currentPage}</span> / {totalPages}
                                    </span>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === totalPages ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        NEXT
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', marginTop: '2.5rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    DESIGNED & DEVELOPED BY LOU VINCENT BARORO
                </p>
            </main>
        </div>
    )
}
