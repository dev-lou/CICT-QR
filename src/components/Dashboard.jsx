import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'

export default function Dashboard({ uuid }) {
    const navigate = useNavigate()
    const [student, setStudent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editTeam, setEditTeam] = useState('')
    const [editRole, setEditRole] = useState('student')
    const [teams, setTeams] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    const fetchStudent = async () => {
        try {
            if (!supabase) throw new Error('Supabase not configured.')
            const { data, error: dbError } = await supabase
                .from('students').select('*').eq('uuid', uuid).single()
            if (dbError) throw dbError
            setStudent(data)
            setEditName(data.full_name)
            setEditTeam(data.team_name)
            setEditRole(data.role || 'student')
        } catch (err) {
            setError('Could not load your profile.')
        } finally { setLoading(false) }
    }

    const fetchTeams = async () => {
        if (!supabase) return
        const { data } = await supabase.from('teams').select('id, name').order('name')
        setTeams(data || [])
    }

    useEffect(() => { fetchStudent(); fetchTeams() }, [uuid])

    const handleSaveEdit = async () => {
        if (!editName.trim() || !editTeam) return
        setSaving(true); setError('')
        try {
            if (!supabase) throw new Error('Supabase not configured.')
            const { error: dbError } = await supabase
                .from('students')
                .update({ full_name: editName.trim(), team_name: editTeam, role: editRole, edit_count: (student.edit_count || 0) + 1 })
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

    const handleLogout = () => {
        localStorage.removeItem('student_uuid')
        navigate('/')
        window.location.reload()
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

                {/* Header with logout */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', paddingTop: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>Your Event Pass</h1>
                        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Show this QR code at the entrance</p>
                    </div>
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                    <span className="badge badge-brand">{student?.team_name}</span>
                                    <span style={{ background: '#fdf0f0', color: '#7B1C1C', fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '99px', textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {student?.role === 'leader' ? (
                                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="#C9A84C" stroke="#C9A84C" strokeWidth={1}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>Leader</>
                                        ) : student?.role === 'facilitator' ? (
                                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7B1C1C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>Facilitator</>
                                        ) : (
                                            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7B1C1C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>Student</>
                                        )}
                                    </span>
                                </div>
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
                                    <input className="input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Team</label>
                                    <select className="input" value={editTeam} onChange={(e) => setEditTeam(e.target.value)}
                                        style={{ appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}>
                                        {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Role</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                        {[{ id: 'student', label: 'Student' }, { id: 'leader', label: 'Leader' }, { id: 'facilitator', label: 'Facilitator' }].map((r) => {
                                            const color = editRole === r.id ? '#7B1C1C' : '#94a3b8'
                                            const icons = {
                                                student: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>,
                                                leader: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
                                                facilitator: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>,
                                            }
                                            return (
                                                <button key={r.id} type="button" onClick={() => setEditRole(r.id)}
                                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 0.25rem', borderRadius: '0.625rem', cursor: 'pointer', fontFamily: 'inherit', border: `2px solid ${editRole === r.id ? '#7B1C1C' : '#e2e8f0'}`, background: editRole === r.id ? '#fdf0f0' : 'white' }}>
                                                    {icons[r.id]}
                                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: editRole === r.id ? '#7B1C1C' : '#374151' }}>{r.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.625rem' }}>
                                    <button className="btn-secondary" type="button" onClick={() => { setEditing(false); setEditName(student.full_name); setEditTeam(student.team_name); setEditRole(student.role || 'student') }} style={{ flex: 1, padding: '0.75rem' }}>Cancel</button>
                                    <button className="btn-primary" type="button" onClick={handleSaveEdit} disabled={saving} style={{ flex: 1.5, padding: '0.75rem' }}>
                                        {saving
                                            ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                            : 'Save'}
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

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {/* View Logbook button */}
                    <motion.button
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/logbook')}
                        style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.25rem 1fr 1.25rem', alignItems: 'center', padding: '1rem', borderRadius: '1rem', background: 'white', border: '2px solid #e2e8f0', color: '#374151', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#f5f3ff' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'white' }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ justifySelf: 'start' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <span style={{ textAlign: 'center' }}>My Logbook</span>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ justifySelf: 'end' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </motion.button>

                    {/* View Scoreboard button */}
                    <motion.button
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/scoreboard')}
                        style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.25rem 1fr 1.25rem', alignItems: 'center', padding: '1rem', borderRadius: '1rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px -2px rgba(123,28,28,0.3)' }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ justifySelf: 'start' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span style={{ textAlign: 'center' }}>Live Scoreboard</span>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ justifySelf: 'end' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </motion.button>
                </div>

            </div>

            {/* Conditional Admin Access for Leaders & Facilitators */}
            {(student?.role === 'leader' || student?.role === 'facilitator') && (
                <div style={{ position: 'fixed', bottom: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    <a
                        href="/admin"
                        style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600, transition: 'color 0.15s ease' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                    >
                        Admin Access
                    </a>
                </div>
            )}
        </div>
    )
}
