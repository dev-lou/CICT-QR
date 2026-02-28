import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin, onGoRegister }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        if (!username.trim() || !password) {
            setError('Please enter your username and password.')
            return
        }
        setLoading(true)
        try {
            if (!supabase) throw new Error('Supabase is not configured.')

            const { data, error: dbError } = await supabase
                .from('students')
                .select('uuid, full_name, team_name')
                .eq('username', username.trim().toLowerCase())
                .eq('password', password)
                .single()

            if (dbError || !data) {
                throw new Error('Incorrect username or password.')
            }

            localStorage.setItem('student_uuid', data.uuid)
            onLogin(data.uuid)
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Ambient Background Glows */}
            <div style={{ position: 'absolute', top: '-10rem', right: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10rem', left: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* ── EVENT SASH (Amplified Vibe) ── */}
            <div style={{
                position: 'fixed', top: '2rem', left: '-3rem', width: '14rem', height: '2.5rem',
                background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
                transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100, pointerEvents: 'none'
            }}>
                <span style={{ color: '#7B1C1C', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em' }}>IT WEEK 2026</span>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
                style={{ width: '100%', maxWidth: '26rem', position: 'relative', zIndex: 10 }}
            >
                {/* Logo Section */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '5.5rem', height: '5.5rem', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1.5rem', border: '3px solid rgba(201,168,76,0.3)', boxShadow: '0 0 40px rgba(201,168,76,0.2)' }} />
                    </motion.div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 0.5rem' }}>Event Access</h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem', fontWeight: 500, letterSpacing: '0.02em' }}>Sign in to access your digital pass</p>
                </div>

                {/* Card Container with Holographic Border */}
                <div className="holographic-gold" style={{ padding: '1px', borderRadius: '2rem', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)' }}>
                    <div className="glass-dark" style={{ padding: '2.5rem 2rem', borderRadius: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.625rem' }}>Username</label>
                                <input
                                    className="input"
                                    autoFocus
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                                    placeholder="Enter your username"
                                    autoCapitalize="none"
                                    autoComplete="username"
                                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', height: '3.25rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.625rem' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', height: '3.25rem', paddingRight: '3.5rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 0 }}
                                    >
                                        {showPassword
                                            ? <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        }
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="alert alert-danger" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.875rem 1rem' }}>
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
                                    {error}
                                </motion.div>
                            )}

                            <motion.button
                                type="submit"
                                disabled={loading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    padding: '1.125rem',
                                    marginTop: '0.5rem',
                                    background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '1.125rem',
                                    fontWeight: 800,
                                    fontSize: '1.125rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    boxShadow: '0 12px 24px -8px rgba(123,28,28,0.5)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'shimmer 2.5s infinite linear' }} />
                                {loading ? (
                                    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                ) : (
                                    <>Access Digital Pass <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                                )}
                            </motion.button>
                        </form>

                        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                                Need an invitation?{' '}
                                <button onClick={onGoRegister}
                                    style={{ color: '#f0d080', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}>
                                    Register Now
                                </button>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Download Android App Section */}
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                    style={{ marginTop: '2.5rem', textAlign: 'center' }}
                >
                    <a
                        href="/it-week-attendance.apk"
                        download="IT_Week_Attendance.apk"
                        style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.6)', padding: '1rem 1.75rem', borderRadius: '1.25rem',
                            textDecoration: 'none', fontWeight: 700, fontSize: '0.9375rem',
                            border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Android Application
                    </a>
                </motion.div>
            </motion.div>

            <p style={{ position: 'absolute', bottom: '1.5rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.625rem', color: 'rgba(255,255,255,0.15)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', pointerEvents: 'none', margin: 0 }}>DESIGNED & DEVELOPED BY LOU VINCENT BARORO</p>
        </div>
    )
}
