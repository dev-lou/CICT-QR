import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Register({ onRegistered }) {
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [teamName, setTeamName] = useState('')
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

            // Check if username already exists
            const { data: existing } = await supabase
                .from('students')
                .select('id')
                .eq('username', username.trim().toLowerCase())
                .maybeSingle()

            if (existing) {
                throw new Error('Username is already taken. Please choose another.')
            }

            const { data, error: dbError } = await supabase
                .from('students')
                .insert([{
                    full_name: fullName.trim(),
                    username: username.trim().toLowerCase(),
                    password: password,
                    team_name: teamName,
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
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-8rem', right: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-8rem', left: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: '100%', maxWidth: '26rem', position: 'relative', zIndex: 10 }}
            >
                {/* Logo */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: '1.125rem', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', marginBottom: '1.25rem', boxShadow: '0 8px 24px -4px rgba(99,102,241,0.35)' }}>
                        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="gradient-text" style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.4rem' }}>Create Account</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Register for IT Week Attendance</p>
                </motion.div>

                {/* Card */}
                <motion.form className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Full Name</label>
                        <input className="input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Username</label>
                        <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="juandelacruz" autoCapitalize="none" />
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.375rem' }}>No spaces. Used to log in.</p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: '3rem' }} />
                            <button type="button" onClick={() => setShowPassword(v => !v)}
                                style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}>
                                {showPassword
                                    ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
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

                    <motion.button type="submit" className="btn-primary" disabled={loading || teams.length === 0}
                        whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                        style={{ padding: '1rem', fontSize: '1rem', marginTop: '0.25rem' }}>
                        {loading ? (
                            <><svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating account…</>
                        ) : (
                            <>Create Account <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                        )}
                    </motion.button>
                </motion.form>

                {/* Switch to login */}
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b', marginTop: '1.25rem' }}>
                    Already have an account?{' '}
                    <button onClick={() => onRegistered(null, 'login')}
                        style={{ color: '#6366f1', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                        Sign in
                    </button>
                </p>
            </motion.div>
        </div>
    )
}
