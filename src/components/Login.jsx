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
        <>
            <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-8rem', right: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-8rem', left: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%', maxWidth: '24rem', position: 'relative', zIndex: 10 }}
                >
                    {/* Logo */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <img src="/logo.png" alt="CICT Logo" style={{ display: 'block', margin: '0 auto', width: '5rem', height: '5rem', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', boxShadow: '0 8px 24px -4px rgba(123,28,28,0.3)' }} />
                        <h1 className="gradient-text" style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.4rem' }}>IT Week Attendance</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Sign in to access your QR pass</p>
                    </motion.div>

                    {/* Card */}
                    <motion.form className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Username</label>
                            <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder="juandelacruz" autoCapitalize="none" autoComplete="username" />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ paddingRight: '3rem' }} />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}>
                                    {showPassword
                                        ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    }
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div className="alert alert-danger" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                {error}
                            </motion.div>
                        )}

                        <motion.button type="submit" className="btn-primary" disabled={loading}
                            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                            style={{ padding: '1rem', fontSize: '1rem', marginTop: '0.25rem' }}>
                            {loading ? (
                                <><svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Signing in…</>
                            ) : (
                                <>Sign In <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                            )}
                        </motion.button>
                    </motion.form>

                    {/* Switch to register */}
                    <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b', marginTop: '1.25rem' }}>
                        No account yet?{' '}
                        <button onClick={onGoRegister}
                            style={{ color: '#6366f1', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                            Register
                        </button>
                    </p>

                    {/* Download App Button */}
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', textAlign: 'center' }}>
                        <a
                            href="/it-week-attendance.apk"
                            download="IT_Week_Attendance.apk"
                            style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                background: '#1e293b', color: 'white', padding: '0.875rem 1.25rem', borderRadius: '0.75rem',
                                textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                transition: 'transform 0.15s ease'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Android App
                        </a>
                    </div>
                </motion.div>
            </div>

            <p style={{ position: 'fixed', bottom: '1rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.6875rem', color: '#94a3b8', pointerEvents: 'none' }}>Built by Lou Vincent Baroro</p>
        </>
    )
}
