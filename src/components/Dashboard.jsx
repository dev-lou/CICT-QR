import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'

export default function Dashboard({ uuid }) {
    const [student, setStudent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editTeam, setEditTeam] = useState('')
    const [teams, setTeams] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Attendance history
    const [attendance, setAttendance] = useState([])
    const [attLoading, setAttLoading] = useState(false)

    const fetchStudent = async () => {
        try {
            if (!supabase) throw new Error('Supabase not configured.')
            const { data, error: dbError } = await supabase
                .from('students').select('*').eq('uuid', uuid).single()
            if (dbError) throw dbError
            setStudent(data)
            setEditName(data.full_name)
            setEditTeam(data.team_name)
        } catch (err) {
            setError('Could not load your profile.')
        } finally {
            setLoading(false)
        }
    }

    const fetchTeams = async () => {
        if (!supabase) return
        const { data } = await supabase.from('teams').select('id, name').order('name')
        setTeams(data || [])
    }

    const fetchAttendance = async () => {
        if (!supabase || !student?.id) return
        setAttLoading(true)
        try {
            const { data } = await supabase
                .from('logbook')
                .select('id, time_in, time_out')
                .eq('student_id', student.id)
                .order('time_in', { ascending: false })
                .limit(20)
            setAttendance(data || [])
        } catch (err) {
            console.error('Failed to load attendance:', err)
        } finally {
            setAttLoading(false)
        }
    }

    useEffect(() => { fetchStudent(); fetchTeams() }, [uuid])
    useEffect(() => { if (student?.id) fetchAttendance() }, [student?.id])

    const handleSaveEdit = async () => {
        if (!editName.trim() || !editTeam) return
        setSaving(true); setError('')
        try {
            if (!supabase) throw new Error('Supabase not configured.')
            const { error: dbError } = await supabase
                .from('students')
                .update({ full_name: editName.trim(), team_name: editTeam, edit_count: (student.edit_count || 0) + 1 })
                .eq('uuid', uuid)
            if (dbError) throw dbError
            setSuccessMsg('Profile updated!')
            setTimeout(() => setSuccessMsg(''), 3000)
            setEditing(false)
            await fetchStudent()
        } catch (err) {
            setError(err.message || 'Failed to save.')
        } finally { setSaving(false) }
    }

    const fmtTime = (iso) => {
        if (!iso) return '—'
        return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    const fmtDate = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
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

    const editsLeft = 2 - (student?.edit_count || 0)

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-8rem', right: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-8rem', left: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ maxWidth: '26rem', margin: '0 auto', position: 'relative', zIndex: 10 }}>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: '1.5rem', paddingTop: '1rem' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>Your Event Pass</h1>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Show this QR code at the entrance</p>
                </motion.div>

                {/* QR Card */}
                <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}
                    style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem' }}>

                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }}
                        className="qr-container">
                        <QRCode value={uuid} size={170} level="H" bgColor="#ffffff" fgColor="#0f172a" />
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {!editing ? (
                            <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>{student?.full_name}</p>
                                <span className="badge badge-brand" style={{ marginBottom: '1.25rem', display: 'inline-block' }}>{student?.team_name}</span>
                                {editsLeft > 0 && (
                                    <div>
                                        <button className="btn-secondary" onClick={() => setEditing(true)} style={{ fontSize: '0.875rem', padding: '0.625rem 1rem' }}>
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            Edit Info <span style={{ color: '#94a3b8', fontWeight: 400 }}>({editsLeft} left)</span>
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Full Name</label>
                                    <input className="input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ fontSize: '0.9rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Team</label>
                                    <select className="input" value={editTeam} onChange={(e) => setEditTeam(e.target.value)} style={{ appearance: 'none', fontSize: '0.9rem', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}>
                                        {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.625rem' }}>
                                    <button className="btn-secondary" type="button" onClick={() => { setEditing(false); setEditName(student.full_name); setEditTeam(student.team_name) }} style={{ flex: 1, padding: '0.75rem' }}>Cancel</button>
                                    <button className="btn-primary" type="button" onClick={handleSaveEdit} disabled={saving} style={{ flex: 1.5, padding: '0.75rem' }}>
                                        {saving ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : 'Save'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {successMsg && <motion.div className="alert alert-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%' }}>{successMsg}</motion.div>}
                        {error && <motion.div className="alert alert-danger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%' }}>{error}</motion.div>}
                    </AnimatePresence>
                </motion.div>

                {/* ── ATTENDANCE HISTORY ─────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>My Attendance</h2>
                        <button onClick={fetchAttendance} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Refresh
                        </button>
                    </div>

                    <div className="card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
                        {attLoading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Loading…</div>
                        ) : attendance.length === 0 ? (
                            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                <p style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem', fontSize: '0.9375rem' }}>No records yet</p>
                                <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Your attendance will appear here after scanning</p>
                            </div>
                        ) : (
                            <div>
                                {/* Summary strip */}
                                <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                                    {[
                                        { label: 'Total Visits', value: attendance.length },
                                        { label: 'Present', value: attendance.filter(r => !r.time_out).length },
                                        { label: 'Completed', value: attendance.filter(r => r.time_out).length },
                                    ].map((s, i) => (
                                        <div key={s.label} style={{ flex: 1, padding: '0.875rem', textAlign: 'center', borderRight: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                                            <p style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0f172a' }}>{s.value}</p>
                                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Rows */}
                                <div>
                                    {attendance.map((row, i) => (
                                        <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.125rem', borderBottom: i < attendance.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                            <div>
                                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>{fmtDate(row.time_in)}</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#64748b' }}>
                                                    <span>In: {fmtTime(row.time_in)}</span>
                                                    {row.time_out && (
                                                        <>
                                                            <span style={{ color: '#e2e8f0' }}>•</span>
                                                            <span>Out: {fmtTime(row.time_out)}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                                <span className={`badge ${row.time_out ? '' : 'badge-success'}`}
                                                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: row.time_out ? '#f1f5f9' : '', color: row.time_out ? '#64748b' : '' }}>
                                                    {row.time_out ? 'Done' : '● Present'}
                                                </span>
                                                {duration(row.time_in, row.time_out) && (
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{duration(row.time_in, row.time_out)}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                <p style={{ textAlign: 'center', color: '#e2e8f0', fontSize: '0.625rem', fontFamily: 'monospace', wordBreak: 'break-all', userSelect: 'all', paddingBottom: '1rem' }}>
                    {uuid}
                </p>
            </div>
        </div>
    )
}
