import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const RANK_STYLES = [
    {
        color: '#C9A84C',
        glow: 'rgba(201,168,76,0.35)',
        barGrad: 'linear-gradient(90deg, #b8860b, #C9A84C, #f0d080)',
        cardBg: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(123,28,28,0.08) 100%)',
        cardBorder: 'rgba(201,168,76,0.4)',
        label: '1ST',
    },
    {
        color: '#94a3b8',
        glow: 'rgba(148,163,184,0.25)',
        barGrad: 'linear-gradient(90deg, #475569, #94a3b8)',
        cardBg: 'rgba(255,255,255,0.04)',
        cardBorder: 'rgba(148,163,184,0.2)',
        label: '2ND',
    },
    {
        color: '#cd7f32',
        glow: 'rgba(205,127,50,0.25)',
        barGrad: 'linear-gradient(90deg, #92400e, #cd7f32)',
        cardBg: 'rgba(255,255,255,0.04)',
        cardBorder: 'rgba(205,127,50,0.2)',
        label: '3RD',
    },
    {
        color: '#6366f1',
        glow: 'rgba(99,102,241,0.2)',
        barGrad: 'linear-gradient(90deg, #4338ca, #6366f1)',
        cardBg: 'rgba(255,255,255,0.04)',
        cardBorder: 'rgba(99,102,241,0.15)',
        label: '4TH',
    },
]

export default function PublicScoreboard() {
    const [teams, setTeams] = useState([])
    const [settings, setSettings] = useState({
        hide_names: false, hide_scores: false,
        hide_bars: false, hide_top2: false, hide_all: false,
    })
    const [loading, setLoading] = useState(true)

    const fetchAll = async () => {
        if (!supabase) return
        const [{ data: teamsData }, { data: settingsData }] = await Promise.all([
            supabase.from('teams').select('id, name, score').order('score', { ascending: false }),
            supabase.from('scoreboard_settings').select('*').eq('id', 1).single(),
        ])
        if (teamsData) setTeams(teamsData)
        if (settingsData) setSettings(settingsData)
        setLoading(false)
    }

    useEffect(() => {
        if (!supabase) return
        fetchAll()
        const teamChan = supabase.channel('pub-teams')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchAll)
            .subscribe()
        const settingsChan = supabase.channel('pub-settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scoreboard_settings' }, fetchAll)
            .subscribe()
        const poll = setInterval(fetchAll, 3000)
        return () => {
            supabase.removeChannel(teamChan)
            supabase.removeChannel(settingsChan)
            clearInterval(poll)
        }
    }, [])

    const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const maxScore = Math.max(...sorted.map(t => t.score ?? 0), 1)
    const { hide_names, hide_scores, hide_bars, hide_top2, hide_all } = settings

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#080b18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(201,168,76,0.15)', borderTopColor: '#C9A84C' }} />
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at top, #0d1428 0%, #080b18 60%)',
            color: 'white',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            padding: '0 0 2rem',
        }}>
            {/* Ambient glow orbs */}
            <div style={{ position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)', width: '60vw', height: '40vh', background: 'radial-gradient(ellipse, rgba(123,28,28,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '-10vh', right: '-10vw', width: '40vw', height: '40vh', background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            {/* ── Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                style={{ textAlign: 'center', padding: '2.5rem 1rem 1.5rem', position: 'relative', zIndex: 1 }}
            >
                <motion.img
                    src="/logo.png"
                    alt="CICT Logo"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
                    style={{
                        display: 'block', margin: '0 auto',
                        width: '6rem', height: '6rem',
                        borderRadius: '50%', objectFit: 'cover',
                        marginBottom: '1.25rem',
                        boxShadow: '0 0 0 4px rgba(201,168,76,0.15), 0 0 48px rgba(201,168,76,0.25)',
                    }}
                />
                <h1 style={{
                    fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    background: 'linear-gradient(135deg, #C9A84C 0%, #f0d080 50%, #C9A84C 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: '0 0 0.35rem',
                    lineHeight: 1,
                }}>
                    IT Week 2026
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
                    <span style={{ width: '24px', height: '1.5px', background: 'rgba(255,255,255,0.12)' }} />
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Live Scoreboard</p>
                    <span style={{ width: '24px', height: '1.5px', background: 'rgba(255,255,255,0.12)' }} />
                </div>
            </motion.div>

            {/* ── Scoreboard ── */}
            <div style={{ flex: 1, maxWidth: '56rem', width: '100%', margin: '0 auto', padding: '0.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
                <AnimatePresence>
                    {hide_all ? (
                        <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1rem', gap: '1rem' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem', margin: 0 }}>Scoreboard is currently hidden</p>
                        </motion.div>
                    ) : sorted.map((team, index) => {
                        const score = team.score ?? 0
                        const pct = Math.max(3, (score / maxScore) * 100)
                        const isTop = index === 0
                        const isHiddenTop = hide_top2 && index < 2
                        const rs = RANK_STYLES[index] ?? RANK_STYLES[3]

                        return (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, x: -32, scale: 0.97 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                transition={{ delay: index * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                    background: rs.cardBg,
                                    border: `1.5px solid ${rs.cardBorder}`,
                                    borderRadius: '1.25rem',
                                    padding: isTop ? '1.75rem 2rem' : '1.375rem 2rem',
                                    boxShadow: isTop && !isHiddenTop ? `0 0 40px -8px ${rs.glow}, inset 0 0 40px -20px ${rs.glow}` : 'none',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'box-shadow 0.4s',
                                }}
                            >
                                {/* Top glint line for 1st place */}
                                {isTop && !isHiddenTop && (
                                    <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1.5px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)', borderRadius: '99px' }} />
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: hide_bars ? 0 : '1rem' }}>
                                    {/* Rank badge */}
                                    <div style={{
                                        width: isTop ? '3.5rem' : '3rem',
                                        height: isTop ? '3.5rem' : '3rem',
                                        borderRadius: '50%',
                                        background: `${rs.color}14`,
                                        border: `2px solid ${rs.color}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: `0 0 16px -4px ${rs.glow}`,
                                        filter: isHiddenTop ? 'blur(4px)' : 'none',
                                        transition: 'filter 0.3s',
                                    }}>
                                        <span style={{ fontSize: isTop ? '1.125rem' : '0.9375rem', fontWeight: 900, color: rs.color, lineHeight: 1 }}>
                                            {index + 1}
                                        </span>
                                        <span style={{ fontSize: '0.4rem', fontWeight: 800, color: rs.color, letterSpacing: '0.06em', opacity: 0.8 }}>
                                            {rs.label}
                                        </span>
                                    </div>

                                    {/* Team name */}
                                    <span style={{
                                        flex: 1,
                                        fontWeight: 800,
                                        fontSize: isTop ? 'clamp(1.25rem, 3vw, 1.75rem)' : 'clamp(1rem, 2.5vw, 1.375rem)',
                                        color: isTop ? '#f0d080' : 'rgba(255,255,255,0.85)',
                                        filter: (hide_names || isHiddenTop) ? 'blur(10px)' : 'none',
                                        transition: 'filter 0.4s',
                                        userSelect: (hide_names || isHiddenTop) ? 'none' : undefined,
                                        letterSpacing: '-0.02em',
                                        lineHeight: 1.15,
                                    }}>
                                        {team.name}
                                    </span>

                                    {/* Score */}
                                    <span style={{
                                        fontWeight: 900,
                                        fontSize: isTop ? 'clamp(1.75rem, 4vw, 2.5rem)' : 'clamp(1.375rem, 3vw, 2rem)',
                                        color: (hide_scores || isHiddenTop) ? 'transparent' : rs.color,
                                        filter: (hide_scores || isHiddenTop) ? 'blur(12px)' : 'none',
                                        transition: 'filter 0.4s, color 0.4s',
                                        fontVariantNumeric: 'tabular-nums',
                                        letterSpacing: '-0.04em',
                                        textShadow: (hide_scores || isHiddenTop) ? 'none' : `0 0 24px ${rs.glow}`,
                                        flexShrink: 0,
                                    }}>
                                        {score}
                                    </span>
                                </div>

                                {/* Progress bar */}
                                {!hide_bars && (
                                    <div style={{ height: isTop ? '0.625rem' : '0.5rem', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1, delay: index * 0.09 + 0.25, ease: 'easeOut' }}
                                            style={{
                                                height: '100%',
                                                borderRadius: '99px',
                                                background: rs.barGrad,
                                                boxShadow: `0 0 12px 0 ${rs.glow}`,
                                            }}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}
            >
                <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', display: 'inline-block' }}
                />
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Live · Updates automatically</span>
            </motion.div>
        </div>
    )
}
