import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

const BASE_SCORE = 150

const RANK_STYLE = [
    { bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', text: 'white', label: '🥇' },
    { bg: 'linear-gradient(135deg,#94a3b8,#cbd5e1)', text: 'white', label: '🥈' },
    { bg: 'linear-gradient(135deg,#d97706,#f59e0b)', text: 'white', label: '🥉' },
]

function Confetti() {
    const pieces = Array.from({ length: 60 }, (_, i) => i)
    const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#f43f5e']
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
            {pieces.map((i) => {
                const color = colors[i % colors.length]
                const left = Math.random() * 100
                const delay = Math.random() * 1.5
                const duration = 2 + Math.random() * 2
                const size = 8 + Math.random() * 8
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

export default function Scoreboard() {
    const [teams, setTeams] = useState([])
    const [displayMode, setDisplayMode] = useState('full') // 'full' | 'blind' | 'hidden'
    const [revealState, setRevealState] = useState('idle') // 'idle' | 'countdown' | 'revealed'
    const [countdown, setCountdown] = useState(3)
    const [showConfetti, setShowConfetti] = useState(false)
    const [showControls, setShowControls] = useState(false)
    const [countingUp, setCountingUp] = useState(false)
    const [displayedScores, setDisplayedScores] = useState({})

    const fetchTeams = useCallback(async () => {
        if (!supabase) return
        const { data } = await supabase.from('teams').select('id, name, score').order('score', { ascending: false })
        if (data) {
            setTeams(data)
            const init = {}
            data.forEach(t => { init[t.id] = 0 })
            setDisplayedScores(prev => {
                const merged = { ...init }
                data.forEach(t => { if (prev[t.id] !== undefined) merged[t.id] = prev[t.id] })
                return merged
            })
        }
    }, [])

    useEffect(() => {
        fetchTeams()
        if (!supabase) return
        // Supabase Realtime subscription (instant when replication is enabled)
        const ch = supabase.channel('scores-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchTeams)
            .subscribe()
        // Polling fallback every 3 s — guarantees live updates regardless of replication config
        const poll = setInterval(fetchTeams, 3000)
        return () => {
            supabase.removeChannel(ch)
            clearInterval(poll)
        }
    }, [fetchTeams])

    // Reveal winner flow
    const startReveal = () => {
        setRevealState('countdown')
        setCountdown(3)
        let c = 3
        const t = setInterval(() => {
            c -= 1
            setCountdown(c)
            if (c <= 0) {
                clearInterval(t)
                setRevealState('revealed')
                setShowConfetti(true)
                setCountingUp(true)
                // Count up scores
                const sorted = [...teams].sort((a, b) => b.score - a.score)
                sorted.forEach((team, idx) => {
                    const target = team.score ?? 0
                    let current = 0
                    const step = Math.ceil(target / 60)
                    const delay = idx * 200
                    setTimeout(() => {
                        const interval = setInterval(() => {
                            current = Math.min(current + step, target)
                            setDisplayedScores(prev => ({ ...prev, [team.id]: current }))
                            if (current >= target) clearInterval(interval)
                        }, 30)
                    }, delay)
                })
                setTimeout(() => setShowConfetti(false), 4000)
            }
        }, 1000)
    }

    const reset = () => {
        setRevealState('idle')
        setCountingUp(false)
        setShowConfetti(false)
    }

    const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const maxScore = Math.max(BASE_SCORE, ...teams.map(t => t.score ?? 0))

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0f0f1a 0%,#1e1b4b 50%,#0f172a 100%)', fontFamily: 'inherit', position: 'relative', overflow: 'hidden' }}>
            {showConfetti && <Confetti />}

            {/* Background glow orbs */}
            <div style={{ position: 'absolute', top: '-10rem', left: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-10rem', right: '-10rem', width: '30rem', height: '30rem', borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem 1.5rem' }}>
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>IT Week 2026</p>
                    <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', fontWeight: 900, background: 'linear-gradient(135deg,#a5b4fc,#67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
                        Team Scoreboard
                    </h1>
                    <p style={{ color: '#475569', fontSize: '0.875rem' }}>Live Rankings</p>
                </motion.div>
            </div>

            {/* Controls toggle button — small gear icon bottom right */}
            <button
                onClick={() => setShowControls(v => !v)}
                style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Controls"
            >⚙️</button>

            {/* Controls panel */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        style={{ position: 'fixed', bottom: '4.5rem', right: '1.5rem', background: 'rgba(15,23,42,0.95)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1rem', zIndex: 100, minWidth: '200px', backdropFilter: 'blur(12px)' }}
                    >
                        <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Display Mode</p>
                        {[
                            { id: 'full', label: '👁️ Full (names + scores)' },
                            { id: 'blind', label: '🙈 Blind (bars only)' },
                            { id: 'hidden', label: '🔒 Hide All' },
                        ].map(m => (
                            <button key={m.id} onClick={() => setDisplayMode(m.id)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', marginBottom: '0.375rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, background: displayMode === m.id ? '#6366f1' : 'rgba(255,255,255,0.05)', color: displayMode === m.id ? 'white' : '#94a3b8' }}>
                                {m.label}
                            </button>
                        ))}

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.75rem 0' }} />

                        {revealState === 'idle' && (
                            <button onClick={startReveal}
                                style={{ display: 'block', width: '100%', padding: '0.625rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, background: 'linear-gradient(135deg,#f59e0b,#f43f5e)', color: 'white' }}>
                                🏆 Reveal Winner
                            </button>
                        )}
                        {revealState === 'revealed' && (
                            <button onClick={reset}
                                style={{ display: 'block', width: '100%', padding: '0.625rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                                ↩ Reset
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Countdown overlay */}
            <AnimatePresence>
                {revealState === 'countdown' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                        <motion.p
                            key={countdown}
                            initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            style={{ fontSize: '10rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>
                            {countdown === 0 ? '🏆' : countdown}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scoreboard */}
            <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '0 1rem 6rem' }}>
                {displayMode === 'hidden' ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                        <p style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</p>
                        <p style={{ color: '#475569', fontWeight: 700, fontSize: '1.25rem' }}>Scores Hidden</p>
                        <p style={{ color: '#334155', fontSize: '0.875rem', marginTop: '0.5rem' }}>Open controls to change display mode</p>
                    </motion.div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        {sorted.map((team, idx) => {
                            const score = team.score ?? 0
                            const pct = Math.min((score / maxScore) * 100, 100)
                            const rankStyle = RANK_STYLE[idx] || { bg: 'rgba(255,255,255,0.06)', text: '#94a3b8', label: `#${idx + 1}` }
                            const isTop = idx === 0
                            const displayScore = revealState === 'revealed' ? displayedScores[team.id] ?? 0 : score
                            const showAsHidden = revealState === 'idle' || revealState === 'countdown'

                            return (
                                <motion.div key={team.id}
                                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.08, duration: 0.5 }}
                                    style={{
                                        background: isTop ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                                        border: `1.5px solid ${isTop ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                        borderRadius: '1rem', padding: '1.125rem 1.25rem',
                                        boxShadow: isTop ? '0 0 24px rgba(99,102,241,0.15)' : 'none',
                                    }}>
                                    {/* Row top */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.75rem' }}>
                                        {/* Rank badge */}
                                        <div style={{ width: '2.25rem', height: '2.25rem', minWidth: '2.25rem', borderRadius: '0.625rem', background: rankStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: idx < 3 ? '1.1rem' : '0.8rem', fontWeight: 800, color: rankStyle.text }}>
                                            {rankStyle.label}
                                        </div>
                                        {/* Name */}
                                        <p style={{ flex: 1, fontWeight: 800, fontSize: 'clamp(0.9375rem, 2.5vw, 1.125rem)', color: revealState === 'revealed' ? 'white' : '#e2e8f0', letterSpacing: '-0.01em' }}>
                                            {revealState === 'idle' ? (displayMode === 'full' || displayMode === 'blind' ? team.name : '?????') : team.name}
                                        </p>
                                        {/* Score */}
                                        {displayMode === 'full' && (
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: isTop ? '#a5b4fc' : '#94a3b8', lineHeight: 1 }}>
                                                    {revealState === 'revealed' ? displayScore : score}
                                                </p>
                                                <p style={{ fontSize: '0.5625rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>pts</p>
                                            </div>
                                        )}
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1, delay: 0.3 + idx * 0.1, ease: 'easeOut' }}
                                            style={{ height: '100%', borderRadius: '99px', background: isTop ? 'linear-gradient(90deg,#6366f1,#06b6d4)' : idx === 1 ? 'linear-gradient(90deg,#94a3b8,#cbd5e1)' : 'linear-gradient(90deg,#d97706,#f59e0b)' }}
                                        />
                                    </div>
                                    {displayMode === 'full' && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
                                            <p style={{ fontSize: '0.625rem', color: '#334155' }}>0</p>
                                            <p style={{ fontSize: '0.625rem', color: '#334155' }}>{maxScore}</p>
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <p style={{ position: 'fixed', bottom: '0.75rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.625rem', color: '#1e293b', pointerEvents: 'none' }}>
                Built by Lou Vincent Baroro · IT Week 2026
            </p>
        </div>
    )
}
