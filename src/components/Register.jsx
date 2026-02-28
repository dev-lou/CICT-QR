import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import CustomDropdown from './CustomDropdown'

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
    executive: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l-3.5 10.5L2 12l6.5 3.5L8 22l4-3 4 3-.5-6.5L22 12l-6.5-.5L12 2z" />
        </svg>
    ),
    officer: (color) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    ),
}

const ROLES = [
    { id: 'student', label: 'Student' },
    { id: 'leader', label: 'Leader' },
    { id: 'facilitator', label: 'Facilitator' },
    { id: 'executive', label: 'Executive' },
    { id: 'officer', label: 'Officer' },
]

export default function Register({ onRegistered }) {
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    // Honeypot field - should remain empty
    const [website, setWebsite] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [teamName, setTeamName] = useState('')
    const [role, setRole] = useState('student')
    const [showMoreRoles, setShowMoreRoles] = useState(false)
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

        // Honeypot check
        if (website) {
            console.warn('Bot detected via honeypot.')
            setLoading(true)
            setTimeout(() => {
                onRegistered('bot-suppressed')
                setLoading(false)
            }, 2000)
            return
        }

        const isStaff = role === 'executive' || role === 'officer'
        if (!fullName.trim() || !username.trim() || !password || (!isStaff && !teamName)) {
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
                    team_name: (role === 'executive' || role === 'officer') ? '' : teamName,
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

    // Role filtering logic based on toggle state
    const visibleRoles = showMoreRoles ? ROLES.slice(3) : ROLES.slice(0, 3)

    return (
        <>
            <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-10rem', right: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-10rem', left: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%', maxWidth: '28rem', position: 'relative', zIndex: 10 }}
                >
                    {/* Logo Section */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        {/* Removed Logo */}
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 0.5rem' }}>Join the Event</h1>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '0.02em' }}>Register your participation for IT Week 2026</p>
                    </div>

                    {/* Card Container with Holographic Border */}
                    <div className="holographic-gold" style={{ padding: '1px', borderRadius: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div className="glass-dark" style={{ padding: '2rem 1.75rem', borderRadius: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            {/* Role Selector */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Role</label>
                                    <button type="button" onClick={() => {
                                        setShowMoreRoles(!showMoreRoles)
                                        if (!showMoreRoles && (role === 'student' || role === 'leader' || role === 'facilitator')) { setRole('officer') }
                                        else if (showMoreRoles && (role === 'executive' || role === 'officer')) { setRole('student') }
                                    }} title={showMoreRoles ? "Back to Student Roles" : "Show Admin Roles"} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#f0d080', cursor: 'pointer', padding: '0.35rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: 0.9 }}>
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleRoles.length}, 1fr)`, gap: '0.5rem' }}>
                                    {visibleRoles.map((r) => (
                                        <button key={r.id} type="button" onClick={() => setRole(r.id)}
                                            style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                                                padding: '0.625rem 0.25rem', borderRadius: '0.875rem', cursor: 'pointer',
                                                fontFamily: 'inherit', transition: 'all 0.2s',
                                                border: '1.5px solid',
                                                borderColor: role === r.id ? '#C9A84C' : 'rgba(255,255,255,0.1)',
                                                background: role === r.id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                                                color: role === r.id ? '#f0d080' : 'rgba(255,255,255,0.4)',
                                            }}>
                                            <span style={{ transform: role === r.id ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}>
                                                {RoleIcons[r.id](role === r.id ? '#C9A84C' : 'currentColor')}
                                            </span>
                                            <span style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Honeypot - Hidden */}
                                <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Full Name</label>
                                    <input className="input" autoFocus type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Juan Dela Cruz" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.625rem 1rem' }} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Username</label>
                                    <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="Choose a unique username" autoCapitalize="none" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.625rem 1rem' }} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a secure password" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', paddingRight: '3rem', padding: '0.625rem 1rem' }} />
                                        <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 0 }}>
                                            {showPassword
                                                ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            }
                                        </button>
                                    </div>
                                </div>

                                {role !== 'executive' && role !== 'officer' && (
                                    <div>
                                        <CustomDropdown label="Team" value={teamName} options={teams} onChange={setTeamName} placeholder="Select your team" dark={true} />
                                    </div>
                                )}

                                {error && (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="alert alert-danger" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem 1rem' }}>
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
                                        {error}
                                    </motion.div>
                                )}

                                <motion.button type="submit" disabled={loading || (role !== 'executive' && role !== 'officer' && teams.length === 0)}
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    style={{ padding: '1rem', marginTop: '0.5rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', color: 'white', border: 'none', borderRadius: '1rem', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 8px 24px -6px rgba(123,28,28,0.4)', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'shimmer 2.5s infinite linear' }} />
                                    {loading ? (
                                        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    ) : (
                                        <>Create Digital Pass<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                                    )}
                                </motion.button>
                            </form>

                            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                                    Already have an account?{' '}
                                    <button onClick={() => onRegistered(null, 'login')}
                                        style={{ color: '#f0d080', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}>
                                        Sign In
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
            <p style={{ position: 'fixed', bottom: '1.5rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.625rem', color: 'rgba(255,255,255,0.15)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none' }}>DESIGNED & DEVELOPED BY LOU VINCENT BARORO</p>
        </>
    )
}


