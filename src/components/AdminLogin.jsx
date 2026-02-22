import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function AdminLogin({ onLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
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
            <div style={{ position: 'absolute', top: '-12rem', left: '50%', transform: 'translateX(-50%)', width: '40rem', height: '40rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

            <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: '100%', maxWidth: '24rem', position: 'relative', zIndex: 10 }}
            >
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.5rem', height: '3.5rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', marginBottom: '1.25rem' }}>
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'white', letterSpacing: '-0.025em', marginBottom: '0.375rem' }}>Admin Login</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>ISUFST Attendance System</p>
                </motion.div>

                <motion.form
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    onSubmit={handleSubmit}
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '1.25rem', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}
                >
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@isufst.edu" style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#334155'} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'} onBlur={(e) => e.target.style.borderColor = '#334155'} />
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                            style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.875rem' }}>
                            {error}
                        </motion.div>
                    )}

                    <motion.button type="submit" className="btn-primary" disabled={loading} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                        style={{ padding: '1rem', fontSize: '1rem', marginTop: '0.25rem' }}>
                        {loading ? (
                            <><svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" /><path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Signing in…</>
                        ) : (
                            <>Sign In <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                        )}
                    </motion.button>
                </motion.form>
            </motion.div>
        </div>
    )
}
