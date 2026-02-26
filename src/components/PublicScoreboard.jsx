import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import { supabase } from '../lib/supabase'

/* ── Rank config ── */
const RANK_STYLES = [
    { color: '#C9A84C', glow: 'rgba(201,168,76,0.35)', barGrad: 'linear-gradient(90deg, #b8860b, #C9A84C, #f0d080)', cardBg: 'linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(123,28,28,0.08) 100%)', cardBorder: 'rgba(201,168,76,0.4)', label: '1ST' },
    { color: '#94a3b8', glow: 'rgba(148,163,184,0.25)', barGrad: 'linear-gradient(90deg, #475569, #94a3b8)', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(148,163,184,0.2)', label: '2ND' },
    { color: '#cd7f32', glow: 'rgba(205,127,50,0.25)', barGrad: 'linear-gradient(90deg, #92400e, #cd7f32)', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(205,127,50,0.2)', label: '3RD' },
    { color: '#6366f1', glow: 'rgba(99,102,241,0.2)', barGrad: 'linear-gradient(90deg, #4338ca, #6366f1)', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(99,102,241,0.15)', label: '4TH' },
]

/* ── Confetti ── */
function Confetti() {
    const pieces = Array.from({ length: 80 }, (_, i) => i)
    const colors = ['#C9A84C', '#f0d080', '#7B1C1C', '#ef4444', '#6366f1', '#06b6d4', '#10b981']
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
            {pieces.map((i) => {
                const color = colors[i % colors.length]
                const left = Math.random() * 100
                const delay = Math.random() * 2
                const duration = 2.5 + Math.random() * 2.5
                const size = 6 + Math.random() * 10
                return (
                    <motion.div key={i}
                        initial={{ y: -20, x: `${left}vw`, opacity: 1, rotate: 0 }}
                        animate={{ y: '110vh', opacity: 0, rotate: 720 }}
                        transition={{ duration, delay, ease: 'easeIn' }}
                        style={{ position: 'absolute', width: size, height: size, borderRadius: Math.random() > 0.5 ? '50%' : '2px', background: color, top: 0 }}
                    />
                )
            })}
        </div>
    )
}

/* ── Animated score number ── */
function AnimatedScore({ value, color, glow, fontSize }) {
    const spring = useSpring(value, { stiffness: 60, damping: 18 })
    const display = useTransform(spring, v => Math.round(v).toString())
    useEffect(() => { spring.set(value) }, [value, spring])
    return (
        <motion.span style={{
            fontWeight: 900, fontSize, color, fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.04em', flexShrink: 0,
            textShadow: `0 0 24px ${glow}`,
        }}>
            {display}
        </motion.span>
    )
}

export default function PublicScoreboard() {
    const [teams, setTeams] = useState([])
    const [settings, setSettings] = useState({
        hide_names: false, hide_scores: false,
        hide_bars: false, hide_top2: false, hide_all: false,
        reveal_state: 'idle', reveal_countdown: 10,
    })
    const [loading, setLoading] = useState(true)
    const [showConfetti, setShowConfetti] = useState(false)
    const [winnerScore, setWinnerScore] = useState(0)
    const winnerScoreRef = useRef(null)
    const prevRevealState = useRef('idle')
    const prevSettings = useRef(settings)

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
        const poll = setInterval(fetchAll, 2000)
        return () => {
            supabase.removeChannel(teamChan)
            supabase.removeChannel(settingsChan)
            clearInterval(poll)
        }
    }, [])

    // Trigger winner animation when reveal_state transitions to 'winner'
    useEffect(() => {
        const prev = prevRevealState.current
        const curr = settings.reveal_state
        if (prev !== 'winner' && curr === 'winner') {
            setShowConfetti(true)
            setTimeout(() => setShowConfetti(false), 6000)
            const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            const target = sorted[0]?.score ?? 0
            setWinnerScore(0)
            let cur = 0
            const step = Math.ceil(target / 80)
            if (winnerScoreRef.current) clearInterval(winnerScoreRef.current)
            winnerScoreRef.current = setInterval(() => {
                cur = Math.min(cur + step, target)
                setWinnerScore(cur)
                if (cur >= target) clearInterval(winnerScoreRef.current)
            }, 25)
        }
        if (curr === 'idle') { setShowConfetti(false); setWinnerScore(0) }
        prevRevealState.current = curr
    }, [settings.reveal_state])

    useEffect(() => { prevSettings.current = settings }, [settings])

    const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const maxScore = Math.max(...sorted.map(t => t.score ?? 0), 1)
    const { hide_names, hide_scores, hide_bars, hide_top2, hide_all, reveal_state, reveal_countdown } = settings
    const winner = sorted[0]

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#080b18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(201,168,76,0.15)', borderTopColor: '#C9A84C' }} />
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, #0d1428 0%, #080b18 60%)', color: 'white', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', padding: '0 0 2rem' }}>

            {showConfetti && <Confetti />}

            {/* Ambient glow */}
            <div style={{ position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)', width: '60vw', height: '40vh', background: 'radial-gradient(ellipse, rgba(123,28,28,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '-10vh', right: '-10vw', width: '40vw', height: '40vh', background: 'radial-gradient(ellipse, rgba(201,168,76,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            {/* ── Countdown overlay ── */}
            <AnimatePresence>
                {reveal_state === 'countdown' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            style={{ color: '#475569', fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Revealing Champion
                        </motion.p>
                        <AnimatePresence mode="popLayout">
                            <motion.p
                                key={reveal_countdown}
                                initial={{ scale: 0.1, opacity: 0, y: 40 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 2.5, opacity: 0, y: -20 }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                style={{ fontSize: 'clamp(7rem, 25vw, 12rem)', fontWeight: 900, color: '#C9A84C', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 80px rgba(201,168,76,0.5)' }}>
                                {reveal_countdown === 0 ? '✦' : reveal_countdown}
                            </motion.p>
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Winner screen ── */}
            <AnimatePresence>
                {reveal_state === 'winner' && winner && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'radial-gradient(ellipse at 50% 40%, #1a1060 0%, #080b18 65%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '3rem 1.5rem' }}>
                        {[0, 1, 2].map(i => (
                            <motion.div key={i} initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 3.5, opacity: 0 }}
                                transition={{ duration: 3.5, delay: i * 0.9, repeat: Infinity }}
                                style={{ position: 'absolute', width: '12rem', height: '12rem', borderRadius: '50%', border: '1.5px solid rgba(201,168,76,0.2)' }} />
                        ))}
                        <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.15 }}
                            style={{ marginBottom: '1.75rem' }}>
                            <div style={{ width: '7rem', height: '7rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.2) 0%, transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'drop-shadow(0 0 32px rgba(201,168,76,0.45))' }}>
                                <svg viewBox="0 0 72 72" width="72" height="72" fill="none">
                                    <path d="M22 10h28v22a14 14 0 0 1-28 0V10z" fill="url(#tg2)" />
                                    <path d="M22 14H14a6 6 0 0 0 0 12h8" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                    <path d="M50 14h8a6 6 0 0 1 0 12h-8" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                    <rect x="31" y="44" width="10" height="10" rx="1" fill="url(#tg2)" />
                                    <rect x="22" y="54" width="28" height="5" rx="2.5" fill="url(#tg2)" />
                                    <path d="M28 16 Q30 24 28 30" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" fill="none" />
                                    <defs>
                                        <linearGradient id="tg2" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#C9A84C" />
                                            <stop offset="100%" stopColor="#8B6914" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </motion.div>
                        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                            style={{ fontSize: 'clamp(0.625rem, 2vw, 0.875rem)', fontWeight: 800, color: '#C9A84C', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                            Congratulations
                        </motion.p>
                        <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
                            style={{ fontSize: 'clamp(1.875rem, 7vw, 4.25rem)', fontWeight: 900, background: 'linear-gradient(125deg, #C9A84C 0%, #f0d080 50%, #C9A84C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.08, marginBottom: '1.75rem' }}>
                            {winner.name}
                        </motion.h2>
                        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9, type: 'spring' }}
                            style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', background: 'rgba(201,168,76,0.1)', padding: '0.875rem 2.5rem', borderRadius: '1.25rem', border: '1px solid rgba(201,168,76,0.25)' }}>
                            <span style={{ fontSize: 'clamp(2.75rem, 9vw, 4.5rem)', fontWeight: 900, color: '#C9A84C', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{winnerScore}</span>
                            <span style={{ fontSize: '0.9375rem', color: '#8B6914', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>pts</span>
                        </motion.div>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
                            style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', fontWeight: 600, marginTop: '2rem', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            IT Week 2026 Champion
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
                style={{ textAlign: 'center', padding: '2.5rem 1rem 1.5rem', position: 'relative', zIndex: 1 }}>
                <motion.img src="/logo.png" alt="CICT Logo"
                    initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
                    style={{ display: 'block', margin: '0 auto', width: '6rem', height: '6rem', borderRadius: '50%', objectFit: 'cover', marginBottom: '1.25rem', boxShadow: '0 0 0 4px rgba(201,168,76,0.15), 0 0 48px rgba(201,168,76,0.25)' }} />
                <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #C9A84C 0%, #f0d080 50%, #C9A84C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 0.35rem', lineHeight: 1 }}>
                    IT Week 2026
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
                    <span style={{ width: '24px', height: '1.5px', background: 'rgba(255,255,255,0.12)' }} />
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Live Scoreboard</p>
                    <span style={{ width: '24px', height: '1.5px', background: 'rgba(255,255,255,0.12)' }} />
                </div>
            </motion.div>

            {/* ── Scoreboard cards ── */}
            <div style={{ flex: 1, maxWidth: '56rem', width: '100%', margin: '0 auto', padding: '0.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
                <AnimatePresence mode="popLayout">
                    {hide_all ? (
                        <motion.div key="hidden"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
                        const nameHidden = hide_names || isHiddenTop
                        const scoreHidden = hide_scores || isHiddenTop

                        return (
                            <motion.div
                                key={team.id}
                                layout
                                initial={{ opacity: 0, x: -40, scale: 0.96 }}
                                animate={{
                                    opacity: 1, x: 0, scale: 1,
                                    // Flash gold when top2 is revealed
                                    boxShadow: isTop && !isHiddenTop
                                        ? `0 0 40px -8px ${rs.glow}, inset 0 0 40px -20px ${rs.glow}`
                                        : '0 0 0px transparent',
                                }}
                                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                                transition={{ delay: index * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                    background: rs.cardBg,
                                    border: `1.5px solid ${rs.cardBorder}`,
                                    borderRadius: '1.25rem',
                                    padding: isTop ? '1.75rem 2rem' : '1.375rem 2rem',
                                    position: 'relative', overflow: 'hidden',
                                }}>

                                {/* Gold glint for 1st */}
                                <AnimatePresence>
                                    {isTop && !isHiddenTop && (
                                        <motion.div
                                            key="glint"
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            transition={{ duration: 0.8 }}
                                            style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1.5px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)', borderRadius: '99px' }} />
                                    )}
                                </AnimatePresence>

                                {/* Flash overlay when revealed */}
                                <AnimatePresence>
                                    {!isHiddenTop && prevSettings.current[`hide_top2`] && isTop && (
                                        <motion.div key="flash"
                                            initial={{ opacity: 0.6 }} animate={{ opacity: 0 }}
                                            transition={{ duration: 1.2, ease: 'easeOut' }}
                                            style={{ position: 'absolute', inset: 0, background: 'rgba(201,168,76,0.18)', borderRadius: '1.25rem', pointerEvents: 'none' }} />
                                    )}
                                </AnimatePresence>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: hide_bars ? 0 : '1rem' }}>
                                    {/* Rank badge */}
                                    <motion.div
                                        animate={{
                                            width: isTop ? '3.5rem' : '3rem',
                                            height: isTop ? '3.5rem' : '3rem',
                                            borderColor: isHiddenTop ? 'rgba(255,255,255,0.06)' : rs.color,
                                        }}
                                        transition={{ duration: 0.4 }}
                                        style={{
                                            borderRadius: '50%', background: `${rs.color}14`,
                                            border: `2px solid ${isHiddenTop ? 'rgba(255,255,255,0.06)' : rs.color}`,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, boxShadow: isHiddenTop ? 'none' : `0 0 16px -4px ${rs.glow}`,
                                        }}>
                                        <span style={{ fontSize: isTop ? '1.125rem' : '0.9375rem', fontWeight: 900, color: isHiddenTop ? 'rgba(255,255,255,0.08)' : rs.color, lineHeight: 1 }}>
                                            {isHiddenTop ? '?' : index + 1}
                                        </span>
                                        <AnimatePresence>
                                            {!isHiddenTop && (
                                                <motion.span
                                                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 0.8, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                    transition={{ duration: 0.3 }}
                                                    style={{ fontSize: '0.4rem', fontWeight: 800, color: rs.color, letterSpacing: '0.06em' }}>
                                                    {rs.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>

                                    {/* Team name with animated reveal */}
                                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: '2rem' }}>
                                        <AnimatePresence mode="wait">
                                            {nameHidden ? (
                                                <motion.div key="redacted"
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -10 }}
                                                    transition={{ duration: 0.3 }}
                                                    style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                                                    <div style={{ height: '55%', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', width: '65%' }} />
                                                </motion.div>
                                            ) : (
                                                <motion.span key="name"
                                                    initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                                    exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                                                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                                    style={{
                                                        display: 'block',
                                                        fontWeight: 800,
                                                        fontSize: isTop ? 'clamp(1.25rem, 3vw, 1.75rem)' : 'clamp(1rem, 2.5vw, 1.375rem)',
                                                        color: isTop ? '#f0d080' : 'rgba(255,255,255,0.85)',
                                                        letterSpacing: '-0.02em', lineHeight: 1.15,
                                                    }}>
                                                    {team.name}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Score with animated reveal */}
                                    <div style={{ flexShrink: 0, minWidth: '3.5rem', textAlign: 'right' }}>
                                        <AnimatePresence mode="wait">
                                            {scoreHidden ? (
                                                <motion.div key="score-hidden"
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 10 }}
                                                    transition={{ duration: 0.3 }}
                                                    style={{ height: isTop ? '2.25rem' : '1.75rem', background: 'rgba(255,255,255,0.07)', borderRadius: '6px', width: '3rem', marginLeft: 'auto' }} />
                                            ) : (
                                                <motion.div key="score-visible"
                                                    initial={{ opacity: 0, scale: 0.6, filter: 'blur(12px)' }}
                                                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                                    exit={{ opacity: 0, scale: 0.6 }}
                                                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
                                                    <AnimatedScore
                                                        value={score}
                                                        color={rs.color}
                                                        glow={rs.glow}
                                                        fontSize={isTop ? 'clamp(1.75rem, 4vw, 2.5rem)' : 'clamp(1.375rem, 3vw, 2rem)'}
                                                    />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Progress bar with smooth reveal */}
                                <AnimatePresence>
                                    {!hide_bars && (
                                        <motion.div
                                            key="bar-wrap"
                                            initial={{ opacity: 0, scaleY: 0 }}
                                            animate={{ opacity: 1, scaleY: 1 }}
                                            exit={{ opacity: 0, scaleY: 0 }}
                                            style={{ height: isTop ? '0.625rem' : '0.5rem', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', transformOrigin: 'bottom' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: isHiddenTop ? '0%' : `${pct}%` }}
                                                transition={{ duration: 1.1, delay: 0.2, ease: 'easeOut' }}
                                                style={{ height: '100%', borderRadius: '99px', background: rs.barGrad, boxShadow: `0 0 12px 0 ${rs.glow}` }}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', display: 'inline-block' }} />
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Live · Updates automatically</span>
            </motion.div>
        </div>
    )
}
