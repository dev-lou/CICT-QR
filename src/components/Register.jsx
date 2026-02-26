import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const RoleIcons = {
    student: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
        </svg>
    ),
    leader: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15l-3-3h6l-3 3z" fill={color} opacity="0.3" /><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
    ),
    facilitator: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 14l2 2 4-4" />
        </svg>
    ),
}

const ROLES = [
    { id: 'student', label: 'Student' },
    { id: 'leader', label: 'Leader' },
    { id: 'facilitator', label: 'Facilitator' },
]

export default function Register({ onRegistered }) {
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [teamName, setTeamName] = useState('')
    const [role, setRole] = useState('student')
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(false)
    const [teamsLoading, setTeamsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchTeams = async () => {
            if (!supabase) { setTeamsLoading(false); return }
            try {
                const { data } = await supabase.from('teams').select('id, name').order('name')
                setTeams(data || [])
            } catch (err) {
                console.error('Failed to load teams:', err)
            } finally {
                setTeamsLoading(false)
            }
        }
        fetchTeams()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        if (!fullName.trim() || !username.trim() || !password || !teamName) {
            setError('Please fill in all fields.')
            return
        }
        if (username.includes(' ')) {
            setError('Username cannot contain spaces.')
            return
        }
        if (password.length < 4) {
            setError('Password must be at least 4 characters.')
            return
        }
        setLoading(true)
        try {
            if (!supabase) throw new Error('Supabase is not configured.')

            const { data: existing } = await supabase
                .from('students')
                .select('id')
                .eq('username', username.trim().toLowerCase())
                .maybeSingle()

            if (existing) throw new Error('Username is already taken. Please choose another.')

            const { data, error: dbError } = await supabase
                .from('students')
                .insert([{
                    full_name: fullName.trim(),
                    username: username.trim().toLowerCase(),
                    password: password,
                    team_name: teamName,
                    role: role,
                    edit_count: 0,
                }])
                .select('uuid')
                .single()

            if (dbError) throw dbError

            localStorage.setItem('student_uuid', data.uuid)
            onRegistered(data.uuid)
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem 1rem 0.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-8rem', right: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-8rem', left: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%', maxWidth: '26rem', position: 'relative', zIndex: 10 }}
                >
                    {/* Logo */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                        <img src="/logo.png" alt="CICT Logo" style={{ display: 'block', margin: '0 auto', width: '5rem', height: '5rem', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem', boxShadow: '0 4px 16px -2px rgba(123,28,28,0.25)' }} />
                        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.15rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Create Account</h1>
                        <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Register for IT Week Attendance</p>
                    </motion.div>

                    {/* Card */}
                    <motion.form className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                        {/* Role Selector */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Role</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem' }}>
                                {ROLES.map((r) => (
                                    <button key={r.id} type="button" onClick={() => setRole(r.id)}
                                        style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem',
                                            padding: '0.375rem 0.25rem', borderRadius: '0.625rem', cursor: 'pointer',
                                            fontFamily: 'inherit', transition: 'all 0.15s',
                                            border: `2px solid ${role === r.id ? '#7B1C1C' : '#e2e8f0'}`,
                                            background: role === r.id ? '#fdf0f0' : 'white',
                                        }}>
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{RoleIcons[r.id](role === r.id ? '#7B1C1C' : '#94a3b8')}</span>
                                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: role === r.id ? '#7B1C1C' : '#374151' }}>{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Full Name</label>
                            <input className="input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" style={{ padding: '0.625rem 0.875rem' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Username</label>
                            <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="juandelacruz" autoCapitalize="none" style={{ padding: '0.625rem 0.875rem' }} />
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.2rem' }}>No spaces. Used to log in.</p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: '3rem', padding: '0.625rem 0.875rem' }} />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}>
                                    {showPassword
                                        ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    }
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Team</label>
                            {teamsLoading ? (
                                <div className="input" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" fill="none" /><path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Loading teams…
                                </div>
                            ) : teams.length === 0 ? (
                                <div className="alert alert-warning">
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    No teams yet. Ask an admin to add teams first.
                                </div>
                            ) : (
                                <select className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                                    style={{ appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}>
                                    <option value="" disabled>Select your team</option>
                                    {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                            )}
                        </div>

                        {error && (
                            <motion.div className="alert alert-danger" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                {error}
                            </motion.div>
                        )}

                        <motion.button type="submit" disabled={loading || teams.length === 0}
                            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                            style={{ padding: '0.75rem', fontSize: '0.9375rem', marginTop: '0.125rem', background: 'linear-gradient(135deg, #7B1C1C, #a02424)', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: loading || teams.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: loading || teams.length === 0 ? 0.7 : 1 }}>
                            {loading ? (
                                <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating…</>
                            ) : (
                                <>Create Account <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                            )}
                        </motion.button>
                    </motion.form>

                    <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#64748b', marginTop: '0.75rem' }}>
                        Already have an account?{' '}
                        <button onClick={() => onRegistered(null, 'login')}
                            style={{ color: '#7B1C1C', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                            Sign in
                        </button>
                    </p>
                </motion.div>
            </div>
            <p style={{ position: 'fixed', bottom: '1rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', pointerEvents: 'none' }}>Built by Lou Vincent Baroro</p>
        </>
    )
}
