import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Registration({ onRegistered }) {
    const [fullName, setFullName] = useState('')
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
        if (!fullName.trim() || !teamName) { setError('Please fill in all fields.'); return }
        setLoading(true)
        setError('')
        try {
            if (!supabase) throw new Error('Supabase is not configured. Please add your .env file.')
            const { data, error: dbError } = await supabase
                .from('students')
                .insert([{ full_name: fullName.trim(), team_name: teamName, edit_count: 0 }])
                .select('uuid')
                .single()
            if (dbError) throw dbError
            localStorage.setItem('student_uuid', data.uuid)
            onRegistered(data.uuid)
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Subtle background shapes */}
            <div style={{
                position: 'absolute', top: '-8rem', right: '-8rem',
                width: '28rem', height: '28rem', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute', bottom: '-8rem', left: '-8rem',
                width: '28rem', height: '28rem', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: '100%', maxWidth: '26rem', position: 'relative', zIndex: 10 }}
            >
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: '2.5rem' }}
                >
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '4rem', height: '4rem', borderRadius: '1.125rem',
                        background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                        marginBottom: '1.25rem',
                        boxShadow: '0 8px 24px -4px rgba(99,102,241,0.35)',
                    }}>
                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <h1 className="gradient-text" style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                        IT Week Attendance
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>Register to receive your event QR pass</p>
                </motion.div>

                {/* Card */}
                <motion.form
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    onSubmit={handleSubmit}
                    style={{ padding: '2rem' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Full Name */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                Full Name
                            </label>
                            <input
                                className="input"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="e.g. Juan Dela Cruz"
                            />
                        </div>

                        {/* Team */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                Team
                            </label>
                            {teamsLoading ? (
                                <div className="input" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" fill="none" />
                                        <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Loading teams...
                                </div>
                            ) : teams.length === 0 ? (
                                <div className="alert alert-warning">
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    No teams yet. Ask an admin to add teams first.
                                </div>
                            ) : (
                                <select
                                    className="input"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    style={{
                                        appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%2394a3b8' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 1rem center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <option value="" disabled>Select your team</option>
                                    {teams.map((t) => (
                                        <option key={t.id} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <motion.div className="alert alert-danger" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: '0.1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {error}
                            </motion.div>
                        )}

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || teams.length === 0}
                            whileHover={{ scale: 1.015 }}
                            whileTap={{ scale: 0.985 }}
                            style={{ marginTop: '0.5rem', fontSize: '1rem', padding: '1rem' }}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" />
                                        <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Registering…
                                </>
                            ) : (
                                <>
                                    Register & Get QR Pass
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </motion.button>
                    </div>
                </motion.form>

                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '1.5rem' }}>
                    IT Week Event Attendance System · Built by Lou Vincent Baroro
                </p>
            </motion.div>
        </div>
    )
}
