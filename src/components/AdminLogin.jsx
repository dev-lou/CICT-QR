import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function AdminLogin({ onLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
        setLoading(true); setError('')
        try {
            if (!supabase) throw new Error('Supabase is not configured.')
            const { data, error: dbError } = await supabase
                .from('admins')
                .select('id, email')
                .eq('email', email.trim().toLowerCase())
                .eq('password', password)
                .single()
            if (dbError || !data) throw new Error('Invalid email or password.')
            localStorage.setItem('admin_session', JSON.stringify({ id: data.id, email: data.email }))
            onLogin(data)
        } catch (err) {
            setError(err.message || 'Login failed.')
        } finally {
            setLoading(false)
        }
    }

    const inputStyle = {
        width: '100%', padding: '0.875rem 1rem', borderRadius: '0.75rem',
        border: '1.5px solid #334155', background: '#0f172a',
        color: 'white', fontSize: '0.9375rem', outline: 'none',
        fontFamily: 'inherit', transition: 'border-color 0.2s', boxSizing: 'border-box',
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-12rem', left: '50%', transform: 'translateX(-50%)', width: '40rem', height: '40rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,28,28,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: '100%', maxWidth: '24rem', position: 'relative', zIndex: 10 }}
            >
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.5rem', height: '3.5rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', marginBottom: '1.25rem' }}>
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'white', letterSpacing: '-0.025em', marginBottom: '0.375rem' }}>Admin Login</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>IT Week Attendance System</p>
                </motion.div>

                <motion.form
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    onSubmit={handleSubmit}
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '1.25rem', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}
                >
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@isufst.edu" style={inputStyle}
                            onFocus={(e) => { e.target.style.borderColor = '#C9A84C'; e.target.style.boxShadow = '0 0 15px rgba(201,168,76,0.1)' }} onBlur={(e) => { e.target.style.borderColor = '#334155'; e.target.style.boxShadow = 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, paddingRight: '3rem' }}
                                onFocus={(e) => { e.target.style.borderColor = '#C9A84C'; e.target.style.boxShadow = '0 0 15px rgba(201,168,76,0.1)' }} onBlur={(e) => { e.target.style.borderColor = '#334155'; e.target.style.boxShadow = 'none' }} />
                            <button type="button" onClick={() => setShowPassword(v => !v)}
                                style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
                                {showPassword
                                    ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                }
                            </button>
                        </div>
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                            style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.875rem' }}>
                            {error}
                        </motion.div>
                    )}

                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                        style={{
                            padding: '1rem', fontSize: '1rem', marginTop: '0.5rem', borderRadius: '0.875rem',
                            background: 'linear-gradient(135deg, #7B1C1C, #9B1C1C)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                            boxShadow: '0 4px 15px rgba(123,28,28,0.25)'
                        }}>
                        {loading ? (
                            <><svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>AUTHENTICATING…</>
                        ) : (
                            <>SECURE ENTRY <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                        )}
                    </motion.button>
                </motion.form>
            </motion.div>
        </div>
    )
}
