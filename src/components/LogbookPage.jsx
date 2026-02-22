import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LogbookPage({ uuid }) {
    const navigate = useNavigate()
    const [myStudent, setMyStudent] = useState(null)
    const [logbook, setLogbook] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // 'all' | 'in' | 'out'

    const fetchData = useCallback(async () => {
        if (!supabase || !uuid) return
        setLoading(true)
        try {
            const { data: me } = await supabase
                .from('students')
                .select('id, full_name, team_name')
                .eq('uuid', uuid)
                .single()
            if (!me) { navigate('/'); return }
            setMyStudent(me)

            const { data: logs } = await supabase
                .from('logbook')
                .select('id, time_in, time_out, students(id, full_name, team_name)')
                .order('time_in', { ascending: false })
            setLogbook(logs || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [uuid, navigate])

    useEffect(() => { fetchData() }, [fetchData])

    const fmtTime = (iso) => {
        if (!iso) return '—'
        return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    const fmtDate = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    const duration = (inT, outT) => {
        if (!outT) return null
        const ms = new Date(outT) - new Date(inT)
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    const filtered = logbook.filter((r) => {
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

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

            {/* Header */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', minWidth: '2.5rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', cursor: 'pointer', color: '#64748b' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.2 }}>Attendance Logbook</p>
                        {myStudent && (
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Signed in as <span style={{ color: '#6366f1', fontWeight: 600 }}>{myStudent.full_name}</span> · your rows highlighted
                            </p>
                        )}
                    </div>
                    <button onClick={fetchData}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', minWidth: '2.5rem', borderRadius: '0.625rem', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer' }}>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1rem' }}>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem', marginBottom: '1rem' }}>
                    {[
                        { label: 'Total', value: logbook.length, color: '#6366f1' },
                        { label: 'Present', value: presentCount, color: '#10b981' },
                        { label: 'Done', value: logbook.filter(r => !!r.time_out).length, color: '#64748b' },
                    ].map((s) => (
                        <div key={s.label} className="card" style={{ padding: '0.875rem 0.5rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
                            <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Legend + Filter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <span style={{ display: 'inline-block', width: '0.75rem', height: '0.75rem', borderRadius: '0.2rem', background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.4)', flexShrink: 0 }} />
                        <span>= your row</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {[{ id: 'all', label: 'All' }, { id: 'in', label: '🟢 Present' }, { id: 'out', label: '⚪ Done' }].map((f) => (
                            <button key={f.id} onClick={() => setFilter(f.id)}
                                style={{ padding: '0.35rem 0.625rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', minHeight: '32px', background: filter === f.id ? '#6366f1' : '#f1f5f9', color: filter === f.id ? 'white' : '#64748b' }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Card list — mobile-friendly stacked rows */}
                <div className="card" style={{ overflow: 'hidden' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
                            <p style={{ fontWeight: 700, color: '#374151', marginBottom: '0.25rem' }}>No records yet</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Scan your QR code at the entrance to log attendance</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filtered.map((row, i) => {
                                const mine = isMe(row)
                                const dur = duration(row.time_in, row.time_out)
                                return (
                                    <motion.div key={row.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.02 }}
                                        style={{
                                            padding: '0.875rem 1rem',
                                            borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            background: mine
                                                ? 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(6,182,212,0.04) 100%)'
                                                : i % 2 === 0 ? 'white' : '#fdfdfe',
                                            borderLeft: mine ? '3px solid #6366f1' : '3px solid transparent',
                                        }}
                                    >
                                        {/* Top row: name + status */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.375rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                                {mine && (
                                                    <span style={{ fontSize: '0.625rem', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', color: 'white', borderRadius: '99px', padding: '0.1rem 0.4rem', fontWeight: 700, flexShrink: 0 }}>
                                                        You
                                                    </span>
                                                )}
                                                <p style={{ fontSize: '0.9375rem', fontWeight: mine ? 700 : 600, color: mine ? '#4f46e5' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {row.students?.full_name}
                                                </p>
                                            </div>
                                            <span style={{
                                                fontSize: '0.625rem', padding: '0.15rem 0.5rem', borderRadius: '99px', fontWeight: 600, flexShrink: 0,
                                                background: row.time_out ? '#f1f5f9' : '#dcfce7',
                                                color: row.time_out ? '#64748b' : '#16a34a',
                                            }}>
                                                {row.time_out ? 'Done' : '● Present'}
                                            </span>
                                        </div>
                                        {/* Bottom row: team + date + times + duration */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span className="badge badge-brand" style={{ fontSize: '0.625rem', padding: '0.1rem 0.4rem' }}>{row.students?.team_name}</span>
                                            <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{fmtDate(row.time_in)}</span>
                                            <span style={{ fontSize: '0.6875rem', color: '#475569', fontWeight: 500 }}>In: {fmtTime(row.time_in)}</span>
                                            {row.time_out && <span style={{ fontSize: '0.6875rem', color: '#475569', fontWeight: 500 }}>Out: {fmtTime(row.time_out)}</span>}
                                            {dur && <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>({dur})</span>}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: '#cbd5e1', marginTop: '1rem' }}>
                    {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} shown
                </p>
            </div>
        </div>
    )
}
