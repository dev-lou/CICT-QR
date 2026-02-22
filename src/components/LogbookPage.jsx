import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LogbookPage({ uuid }) {
    const navigate = useNavigate()
    const [student, setStudent] = useState(null)
    const [attendance, setAttendance] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        if (!supabase || !uuid) return
        setLoading(true)
        try {
            const { data: s } = await supabase
                .from('students').select('id, full_name, team_name').eq('uuid', uuid).single()
            if (!s) { navigate('/'); return }
            setStudent(s)

            const { data: logs } = await supabase
                .from('logbook')
                .select('id, time_in, time_out')
                .eq('student_id', s.id)
                .order('time_in', { ascending: false })
            setAttendance(logs || [])
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
        return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    }
    const duration = (inT, outT) => {
        if (!outT) return null
        const ms = new Date(outT) - new Date(inT)
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1' }} />
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Header */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate('/')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.2 }}>My Attendance</p>
                        {student && <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{student.full_name} · {student.team_name}</p>}
                    </div>
                    <button onClick={fetchData} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '1.5rem' }}>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
                    {[
                        { label: 'Total Visits', value: attendance.length, color: '#6366f1' },
                        { label: 'Still In', value: attendance.filter(r => !r.time_out).length, color: '#10b981' },
                        { label: 'Completed', value: attendance.filter(r => r.time_out).length, color: '#64748b' },
                    ].map((s) => (
                        <div key={s.label} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.625rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Logbook */}
                <div className="card" style={{ overflow: 'hidden' }}>
                    {attendance.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
                            <p style={{ fontWeight: 700, color: '#374151', marginBottom: '0.25rem' }}>No records yet</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Scan your QR code to log attendance</p>
                        </div>
                    ) : (
                        <>
                            {/* Table header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {['Date', 'Time In', 'Time Out', 'Status'].map((h) => (
                                    <p key={h} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</p>
                                ))}
                            </div>
                            {attendance.map((row, i) => (
                                <motion.div key={row.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: i < attendance.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? 'white' : '#fdfdfe' }}>
                                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>{fmtDate(row.time_in)}</p>
                                    <p style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>{fmtTime(row.time_in)}</p>
                                    <p style={{ fontSize: '0.8125rem', color: row.time_out ? '#374151' : '#94a3b8', fontWeight: row.time_out ? 500 : 400 }}>
                                        {row.time_out ? fmtTime(row.time_out) : '—'}
                                        {duration(row.time_in, row.time_out) && (
                                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#94a3b8' }}>{duration(row.time_in, row.time_out)}</span>
                                        )}
                                    </p>
                                    <span className={`badge ${row.time_out ? '' : 'badge-success'}`}
                                        style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', background: row.time_out ? '#f1f5f9' : '', color: row.time_out ? '#64748b' : '', whiteSpace: 'nowrap' }}>
                                        {row.time_out ? 'Done' : '● Present'}
                                    </span>
                                </motion.div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
