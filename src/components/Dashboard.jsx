import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'
import CustomDropdown from './CustomDropdown'

export default function Dashboard({ uuid }) {
    const navigate = useNavigate()
    const [student, setStudent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editTeam, setEditTeam] = useState('')
    const [editRole, setEditRole] = useState('student')
    const [showMoreRoles, setShowMoreRoles] = useState(false)
    const [teams, setTeams] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [scanNotification, setScanNotification] = useState(null) // { type: 'in' | 'out' }

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

    useEffect(() => {
        fetchStudent()
        fetchTeams()
    }, [uuid])

    // Realtime listener for logbook/staff_logbook
    useEffect(() => {
        if (!supabase || !student?.id) return

        const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(student.role)
        const table = isStaff ? 'staff_logbook' : 'logbook'

        const channel = supabase.channel(`dashboard-scan-${student.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `student_id=eq.${student.id}` }, (payload) => {
                setScanNotification({ type: 'in' })
                setTimeout(() => setScanNotification(null), 4000)
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `student_id=eq.${student.id}` }, (payload) => {
                if (payload.new.time_out && !payload.old.time_out) {
                    setScanNotification({ type: 'out' })
                    setTimeout(() => setScanNotification(null), 4000)
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [student?.id, student?.role])

    const handleSaveEdit = async () => {
        if (!editName.trim() || !supabase) return
        setSaving(true); setError('')
        try {
            const { error: dbError } = await supabase
                .from('students')
                .update({
                    full_name: editName.trim(),
                    team_name: (editRole === 'executive' || editRole === 'officer') ? '' : editTeam,
                    role: editRole,
                    edit_count: (student.edit_count || 0) + 1
                })
                .eq('uuid', uuid)
            if (dbError) throw dbError

            // Create Audit Log
            try {
                await supabase.from('audit_logs').insert([{
                    student_id: student.id,
                    action: 'SELF_EDIT',
                    target_name: editName.trim(),
                    details: {
                        before: { full_name: student.full_name, team_name: student.team_name, role: student.role },
                        after: { full_name: editName.trim(), team_name: (editRole === 'executive' || editRole === 'officer') ? '' : editTeam, role: editRole }
                    }
                }])
            } catch (auditErr) { console.error('Audit log failed:', auditErr) }

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
            <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ maxWidth: '26rem', width: '100%', marginTop: '2rem' }}>
                    <div className="skeleton" style={{ height: '3rem', width: '60%', margin: '0 auto 1.5rem', borderRadius: '0.75rem' }} />
                    <div className="card skeleton" style={{ height: '24rem', width: '100%', borderRadius: '2rem', marginBottom: '1.5rem' }} />
                    <div className="skeleton" style={{ height: '3.5rem', width: '100%', borderRadius: '1rem', marginBottom: '0.75rem' }} />
                    <div className="skeleton" style={{ height: '3.5rem', width: '100%', borderRadius: '1rem' }} />
                </div>
            </div>
        )
    }

    const editsLeft = 2 - (student?.edit_count || 0)

    return (
        <div style={{ minHeight: '100dvh', background: '#0f172a', padding: '1rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Ambient Background Glows */}
            <div style={{ position: 'absolute', top: '-10rem', right: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10rem', left: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* FULLSCREEN REALTIME SCAN OVERLAY */}
            <AnimatePresence>
                {scanNotification && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9999,
                            background: scanNotification.type === 'in'
                                ? 'linear-gradient(135deg, rgba(22,163,74,0.95), rgba(0,0,0,0.98))'
                                : 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(0,0,0,0.98))',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(20px)'
                        }}
                    >
                        <motion.div
                            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}
                        >
                            <div style={{
                                width: '6rem', height: '6rem', borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
                                border: '2px solid rgba(255,255,255,0.5)', boxShadow: '0 0 40px rgba(255,255,255,0.2)'
                            }}>
                                {scanNotification.type === 'in' ? (
                                    <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                )}
                            </div>
                            <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {scanNotification.type === 'in' ? 'CHECKED IN!' : 'CHECKED OUT!'}
                            </h1>
                            <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                                {student?.full_name}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ maxWidth: '26rem', margin: '0 auto', position: 'relative', zIndex: 10 }}>

                {/* Header with Logout */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', paddingTop: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(123,28,28,0.4)', border: '2px solid rgba(201,168,76,0.3)', overflow: 'hidden' }}>
                            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'white', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>IT Week 2026</h2>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.625rem', fontWeight: 600, margin: 0 }}>OFFICIAL EVENT PASS</p>
                        </div>
                    </div>
                </motion.div>

                {/* VIP Pass Holographic Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="holographic-gold"
                    style={{
                        padding: '1px',
                        borderRadius: '2.25rem',
                        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.5)',
                        marginBottom: '2rem',
                        marginTop: '1.5rem'
                    }}
                >
                    <div className={`glass-dark pattern-circuits ${student?.role === 'leader' || student?.role === 'facilitator' ? 'vibe-hackathon' : 'vibe-masquerade'}`} style={{
                        padding: '1.75rem 1.5rem',
                        borderRadius: '2.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.25rem',
                        position: 'relative',
                        border: student?.role === 'leader' || student?.role === 'facilitator' ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(201,168,76,0.6)'
                    }}>
                        {/* ── EVENT SASH (Amplified Vibe) ── */}
                        <div style={{
                            position: 'absolute', top: '1.5rem', left: '-3rem', width: '12rem', height: '2rem',
                            background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
                            transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 30
                        }}>
                            <span style={{ color: '#7B1C1C', fontSize: '0.625rem', fontWeight: 900, letterSpacing: '0.1em' }}>IT WEEK 2026</span>
                        </div>

                        {/* ── EVENT WATERMARKS (Refined Positioning & Standing Posture) ── */}
                        {/* Super Ornate Lace-Style Masquerade Mask (Tucked into corner, rotated down-right) */}
                        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', opacity: 0.2, transform: 'rotate(15deg)', pointerEvents: 'none', zIndex: 10 }}>
                            <svg width="100" height="70" viewBox="0 0 140 100" fill="none" stroke="#C9A84C" strokeWidth="1">
                                {/* Intricate Lace Silhoutte */}
                                <path d="M10 50 C10 20, 40 10, 70 30 C100 10, 130 20, 130 50 C130 80, 100 90, 70 75 C40 90, 10 80, 10 50 Z" strokeOpacity="0.8" strokeWidth="1.5" />
                                {/* Detailed Eye Contours */}
                                <path d="M30 48 Q40 35, 50 48 Q40 60, 30 48 M90 48 Q100 35, 110 48 Q100 60, 90 48" strokeOpacity="0.6" strokeWidth="2" />
                            </svg>
                        </div>

                        {/* Standing Vintage Film Camera (moved to left side) */}
                        <div style={{ position: 'absolute', top: '4rem', left: '1rem', opacity: 0.22, pointerEvents: 'none', zIndex: 10, transform: 'rotate(25deg)' }}>
                            <svg width="100" height="110" viewBox="0 0 100 110" fill="none" stroke="#C9A84C" strokeWidth="2.5">
                                {/* Symmetrically aligned reels above body */}
                                <circle cx="30" cy="30" r="20" strokeOpacity="1" />
                                <circle cx="30" cy="30" r="5" fill="#C9A84C" fillOpacity="0.8" />
                                <path d="M30 10 V50 M10 30 H50" strokeWidth="1" strokeOpacity="0.4" />

                                <circle cx="70" cy="30" r="20" strokeOpacity="1" />
                                <circle cx="70" cy="30" r="5" fill="#C9A84C" fillOpacity="0.8" />
                                <path d="M70 10 V50 M50 30 H90" strokeWidth="1" strokeOpacity="0.4" />

                                {/* Vertical camera body */}
                                <rect x="32.5" y="55" width="35" height="50" rx="4" strokeOpacity="1" />
                                <rect x="37.5" y="65" width="25" height="20" rx="2" strokeOpacity="0.4" strokeWidth="1.5" />

                                {/* Conical Lens Projection */}
                                <path d="M67.5 75 L92.5 65 L92.5 105 L67.5 95 Z" strokeOpacity="1" strokeLinejoin="round" />
                                <path d="M82.5 71 V99" strokeWidth="1.5" strokeOpacity="0.4" />
                            </svg>
                        </div>

                        {/* Hackathon / Coding Pattern (Bottom-left, horizontal for readability) */}
                        <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', opacity: 0.22, pointerEvents: 'none', zIndex: 10, fontFamily: '"JetBrains Mono", monospace', transform: 'rotate(0deg)' }}>
                            <svg width="130" height="90" viewBox="0 0 130 90" fill="#C9A84C">
                                <text x="0" y="15" fontSize="10" fontWeight="900" style={{ letterSpacing: '2px' }}>sleep</text>
                                <text x="0" y="30" fontSize="11" fontWeight="900" opacity="0.8">{'{ HACK_IT_2026 }'}</text>
                                <text x="0" y="45" fontSize="10" fontWeight="900">while(coding)</text>
                                <text x="10" y="60" fontSize="10" fontWeight="900" opacity="0.7">coffee++;</text>
                                <text x="0" y="75" fontSize="10" fontWeight="900">build();</text>
                            </svg>
                        </div>

                        {/* Film Strip / Action Pattern (Raised a bit more and tilted) */}
                        <div style={{ position: 'absolute', bottom: '3.8rem', right: '0.5rem', opacity: 0.2, pointerEvents: 'none', zIndex: 10, transform: 'rotate(-60deg)' }}>
                            <svg width="150" height="40" viewBox="0 0 150 40" fill="none" stroke="#C9A84C" strokeWidth="2">
                                <rect x="0" y="5" width="150" height="30" rx="3" strokeOpacity="0.6" />
                                {[...Array(9)].map((_, i) => (
                                    <g key={i}>
                                        <rect x={8 + i * 15} y="8" width="8" height="8" rx="2" fill="#C9A84C" fillOpacity="0.3" />
                                        <rect x={8 + i * 15} y="24" width="8" height="8" rx="2" fill="#C9A84C" fillOpacity="0.3" />
                                    </g>
                                ))}
                            </svg>
                        </div>

                        <div style={{ textAlign: 'center', position: 'relative', zIndex: 40 }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#C9A84C', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Verified Participant</span>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', margin: 0 }}>{student?.full_name}</h1>
                        </div>

                        <div style={{ position: 'relative' }}>
                            {/* Animated Pulse Ring */}
                            <motion.div
                                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                style={{
                                    position: 'absolute', inset: '-1.5rem', borderRadius: '2rem',
                                    border: '2px solid rgba(201,168,76,0.3)', pointerEvents: 'none'
                                }}
                            />
                            <div className="qr-container" style={{ padding: '0.875rem', background: 'white', borderRadius: '1.5rem', boxShadow: '0 0 30px rgba(201,168,76,0.2)' }}>
                                <QRCode value={uuid} size={140} level="H" bgColor="#ffffff" fgColor="#0f172a" />
                            </div>
                        </div>

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                {student?.team_name ? (
                                    <span style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', fontSize: '0.75rem', fontWeight: 800, padding: '0.375rem 1rem', borderRadius: '99px', border: '1px solid rgba(201,168,76,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {student?.team_name}
                                    </span>
                                ) : null}
                                <span style={{ background: '#7B1C1C', color: 'white', fontSize: '0.75rem', fontWeight: 800, padding: '0.375rem 1rem', borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                                    {student?.role || 'Student'}
                                </span>
                            </div>

                            <AnimatePresence mode="wait">
                                {!editing ? (
                                    <motion.div key="view-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                        {editsLeft > 0 && (
                                            <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', transition: 'all 0.2s' }}>
                                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={2.5}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                Edit Info ({editsLeft} left)
                                            </button>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="edit-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Full Name</label>
                                                <input className="input" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                                            </div>
                                            {editRole !== 'executive' && editRole !== 'officer' && (
                                                <CustomDropdown
                                                    label="Team"
                                                    value={editTeam}
                                                    options={teams}
                                                    onChange={setEditTeam}
                                                    placeholder="Select your team"
                                                    dark={true}
                                                />
                                            )}
                                            <div style={{ marginTop: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
                                                    <button type="button" onClick={() => {
                                                        setShowMoreRoles(!showMoreRoles)
                                                        if (!showMoreRoles && (editRole === 'student' || editRole === 'leader' || editRole === 'facilitator')) { setEditRole('officer') }
                                                        else if (showMoreRoles && (editRole === 'executive' || editRole === 'officer')) { setEditRole('student') }
                                                    }} title={showMoreRoles ? "Back to Student Roles" : "Show Admin Roles"} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0d080', cursor: 'pointer', padding: '0.35rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: 0.9 }}>
                                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: showMoreRoles ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                                    {(showMoreRoles
                                                        ? [{ id: 'executive', label: 'Exec' }, { id: 'officer', label: 'Officer' }]
                                                        : [{ id: 'student', label: 'Student' }, { id: 'leader', label: 'Leader' }, { id: 'facilitator', label: 'Facil' }]
                                                    ).map((r) => (
                                                        <button key={r.id} type="button" onClick={() => setEditRole(r.id)} style={{ padding: '0.5rem', borderRadius: '0.75rem', fontSize: '0.6875rem', fontWeight: 700, border: '1px solid', borderColor: editRole === r.id ? '#C9A84C' : 'rgba(255,255,255,0.1)', background: editRole === r.id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)', color: editRole === r.id ? '#C9A84C' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                                                            {r.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button className="btn-secondary" onClick={() => { setEditing(false); setEditName(student.full_name); setEditTeam(student.team_name); setEditRole(student.role || 'student') }} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
                                            <button className="btn-primary" onClick={handleSaveEdit} disabled={saving} style={{ flex: 1.5, background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', border: 'none' }}>
                                                {saving ? '...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>

                {/* Sub-actions Display */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <motion.button
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}
                        onClick={() => navigate('/logbook')}
                        style={{ width: '100%', padding: '1.25rem', borderRadius: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'all 0.2s', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                    >
                        <div style={{ position: 'absolute', left: '1.25rem', padding: '0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', display: 'flex' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </div>
                        <span style={{ letterSpacing: '0.02em' }}>My Attendance Log</span>
                    </motion.button>

                    <motion.button
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}
                        onClick={() => navigate('/scoreboard')}
                        style={{ width: '100%', padding: '1.25rem', borderRadius: '1.25rem', background: 'rgba(123,28,28,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', position: 'relative', overflow: 'hidden' }}
                    >
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.05), transparent)', animation: 'shimmer 3s infinite linear' }} />
                        <div style={{ position: 'absolute', left: '1.25rem', display: 'flex' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </div>
                        Event Scoreboard
                    </motion.button>
                </div>

                <AnimatePresence>
                    {(successMsg || error) && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: 'fixed', bottom: '2rem', left: '2rem', right: '2rem', zIndex: 100 }}>
                            <div className={`alert alert-${successMsg ? 'success' : 'danger'}`} style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {successMsg || error}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Personal Credit & Admin Link */}
                <div style={{ marginTop: '4rem', textAlign: 'center', paddingBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>

                    {(student?.role === 'executive' || student?.role === 'officer') && (
                        <a href="/admin" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0.5rem 1.25rem', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                            System Administration
                        </a>
                    )}

                    <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.15)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', margin: 0 }}>Built by Lou Vincent Baroro</p>
                </div>
            </div>
        </div>
    )
}
