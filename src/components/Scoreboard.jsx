import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'

const BASE_SCORE = 150

/* ── SVG Icons ─────────────────────────────────────────────────────────────── */
const Icon = {
    Eye: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
    ),
    EyeOff: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    ),
    Hash: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
        </svg>
    ),
    BarChart: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    ),
    Lock: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    ),
    Medal: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="15" r="6" /><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32" />
        </svg>
    ),
    Trophy: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8 21 12 17 16 21" /><line x1="12" y1="17" x2="12" y2="11" /><path d="M7 4H4a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4" /><path d="M17 4h3a2 2 0 0 1 2 2v2a4 4 0 0 1-4 4" /><rect x="7" y="2" width="10" height="12" rx="1" />
        </svg>
    ),
    RotateCcw: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.49" />
        </svg>
    ),
    Settings: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
}

/* ── Rank Badge SVG ────────────────────────────────────────────────────────── */
const RANK = [
    { gradient: ['#f59e0b', '#fb923c'], num: '1' },
    { gradient: ['#94a3b8', '#cbd5e1'], num: '2' },
    { gradient: ['#d97706', '#92400e'], num: '3' },
]

/* ── Confetti ──────────────────────────────────────────────────────────────── */
function Confetti() {
    const pieces = Array.from({ length: 80 }, (_, i) => i)
    const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#f43f5e', '#a855f7']
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

/* ── Toggle Row ────────────────────────────────────────────────────────────── */
function ToggleRow({ label, IconEl, active, onChange, accentColor = '#6366f1' }) {
    return (
        <button onClick={onChange} style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.625rem',
            border: `1px solid ${active ? accentColor + '50' : 'rgba(255,255,255,0.05)'}`,
            background: active ? accentColor + '15' : 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
        }}>
            <span style={{ color: active ? accentColor : '#475569', width: '14px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <IconEl />
            </span>
            <span style={{ flex: 1, fontSize: '0.7875rem', fontWeight: 600, color: active ? '#cbd5e1' : '#475569', textAlign: 'left' }}>{label}</span>
            {/* pill */}
            <div style={{ width: '32px', height: '18px', borderRadius: '99px', background: active ? accentColor : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: active ? '17px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
            </div>
        </button>
    )
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
export default function Scoreboard() {
    const [teams, setTeams] = useState([])
    const [hideNames, setHideNames] = useState(true)
    const [hideScores, setHideScores] = useState(true)
    const [hideTop2, setHideTop2] = useState(true)
    const [hideBars, setHideBars] = useState(true)
    const [hideAll, setHideAll] = useState(false)
    const [revealState, setRevealState] = useState('idle') // idle | countdown | winner
    const [countdown, setCountdown] = useState(10)
    const [showConfetti, setShowConfetti] = useState(false)
    const [showControls, setShowControls] = useState(false)
    const [winnerScore, setWinnerScore] = useState(0)

    const fetchTeams = useCallback(async () => {
        if (!supabase) return
        const { data } = await supabase.from('teams').select('id, name, score').order('score', { ascending: false })
        if (data) setTeams(data)
    }, [])

    useEffect(() => {
        fetchTeams()
        if (!supabase) return
        const ch = supabase.channel('scores-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchTeams)
            .subscribe()
        const poll = setInterval(fetchTeams, 3000)
        return () => { supabase.removeChannel(ch); clearInterval(poll) }
    }, [fetchTeams])

    useEffect(() => {
        const html = document.documentElement, body = document.body
        const prev = { hO: html.style.overflow, hH: html.style.height, bO: body.style.overflow, bH: body.style.height, bS: body.style.overscrollBehaviorY }
        html.style.overflow = 'auto'; html.style.height = 'auto'
        body.style.overflow = 'auto'; body.style.height = 'auto'; body.style.overscrollBehaviorY = 'auto'
        return () => {
            html.style.overflow = prev.hO; html.style.height = prev.hH
            body.style.overflow = prev.bO; body.style.height = prev.bH; body.style.overscrollBehaviorY = prev.bS
        }
    }, [])

    const startReveal = () => {
        setRevealState('countdown'); setCountdown(10)
        let c = 10
        const t = setInterval(() => {
            c -= 1; setCountdown(c)
            if (c <= 0) {
                clearInterval(t)
                setRevealState('winner'); setShowConfetti(true)
                const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                const target = sorted[0]?.score ?? 0
                let cur = 0; const step = Math.ceil(target / 80)
                const iv = setInterval(() => {
                    cur = Math.min(cur + step, target); setWinnerScore(cur)
                    if (cur >= target) clearInterval(iv)
                }, 25)
                setTimeout(() => setShowConfetti(false), 6000)
            }
        }, 1000)
    }

    // Called when winner screen is tapped — reveal full scoreboard
    const resetAll = () => {
        setRevealState('idle'); setShowConfetti(false); setWinnerScore(0)
        // Reveal everything when dismissing winner screen
        setHideNames(false); setHideScores(false); setHideTop2(false); setHideBars(false); setHideAll(false)
        setShowControls(false)
    }

    const resetToggles = async () => {
        const result = await Swal.fire({
            title: 'Reset Toggles?',
            text: 'This will hide names, scores, bars and top 2. Hide Everything stays off.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Yes, reset',
            cancelButtonText: 'Cancel',
            background: '#0f172a',
            color: '#e2e8f0',
        })
        if (!result.isConfirmed) return
        setHideNames(true); setHideScores(true); setHideTop2(true); setHideBars(true); setHideAll(false)
    }

    const sorted = [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const maxScore = Math.max(BASE_SCORE, ...teams.map(t => t.score ?? 0))
    const winner = sorted[0]

    return (
        <div className="scoreboard-page" style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#080b18 0%,#0f1630 40%,#0a0f1e 100%)', fontFamily: 'inherit', position: 'relative' }}>
            {showConfetti && <Confetti />}

            {/* Glow orbs */}
            <div style={{ position: 'fixed', top: '-8rem', left: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '-8rem', right: '-8rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle,rgba(6,182,212,0.09) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            {/* ── Header ── */}
            <div style={{ textAlign: 'center', padding: '2.75rem 1rem 1.75rem', position: 'relative', zIndex: 1 }}>
                <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4f46e5', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>IT Week 2026</p>
                    <h1 style={{ fontSize: 'clamp(1.875rem, 5vw, 3.25rem)', fontWeight: 900, background: 'linear-gradient(125deg,#c7d2fe 0%,#67e8f9 55%,#a5f3fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.035em', lineHeight: 1.1, marginBottom: '0.5rem' }}>
                        Team Scoreboard
                    </h1>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '99px', padding: '0.25rem 0.75rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                        <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 600, letterSpacing: '0.05em' }}>LIVE</span>
                    </div>
                </motion.div>
            </div>

            {/* ── Gear Button ── */}
            <motion.button
                onClick={() => setShowControls(v => !v)}
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: showControls ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1.5px solid ${showControls ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.1)'}`,
                    color: showControls ? '#a5b4fc' : '#475569',
                    cursor: 'pointer', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s',
                }}
                title="Controls"
            >
                <Icon.Settings />
            </motion.button>

            {/* ── Controls Panel ── */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.96 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: 'fixed', bottom: '4.75rem', right: '1.5rem',
                            background: 'rgba(8,12,28,0.96)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '1.125rem', padding: '1.125rem', zIndex: 100,
                            minWidth: '230px', backdropFilter: 'blur(20px)',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
                        }}
                    >
                        {/* Section: Visibility */}
                        <p style={{ fontSize: '0.5875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>Visibility</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <ToggleRow label="Hide Names" IconEl={Icon.EyeOff} active={hideNames} onChange={() => setHideNames(v => !v)} accentColor="#8b5cf6" />
                            <ToggleRow label="Hide Scores" IconEl={Icon.Hash} active={hideScores} onChange={() => setHideScores(v => !v)} accentColor="#06b6d4" />
                            <ToggleRow label="Hide Bars" IconEl={Icon.BarChart} active={hideBars} onChange={() => setHideBars(v => !v)} accentColor="#f59e0b" />
                            <ToggleRow label="Hide Top 2 (suspense)" IconEl={Icon.Medal} active={hideTop2} onChange={() => setHideTop2(v => !v)} accentColor="#ec4899" />
                            <ToggleRow label="Hide Everything" IconEl={Icon.Lock} active={hideAll} onChange={() => setHideAll(v => !v)} accentColor="#ef4444" />
                        </div>

                        <div style={{ margin: '0.875rem 0 0.5rem', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

                        {/* Section: Reveal */}
                        <p style={{ fontSize: '0.5875rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>Ceremony</p>
                        {revealState === 'idle' && (
                            <motion.button onClick={startReveal} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    width: '100%', padding: '0.7rem', borderRadius: '0.75rem', border: 'none',
                                    cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700,
                                    background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                                    color: 'white', letterSpacing: '-0.01em',
                                    boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
                                }}>
                                <Icon.Trophy />
                                Reveal Winner
                            </motion.button>
                        )}
                        {revealState === 'winner' && (
                            <button onClick={resetAll}
                                style={{ display: 'block', width: '100%', padding: '0.6rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                Close Winner Screen
                            </button>
                        )}

                        <div style={{ margin: '0.75rem 0 0.5rem', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

                        <button onClick={resetToggles}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                                width: '100%', padding: '0.45rem', borderRadius: '0.5rem',
                                border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.07)',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: '#334155',
                            }}>
                            <Icon.RotateCcw /> Reset Toggles
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Countdown ── */}
            <AnimatePresence>
                {revealState === 'countdown' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                        <p style={{ color: '#475569', fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Revealing Champion</p>
                        <motion.p
                            key={countdown}
                            initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 3, opacity: 0 }}
                            transition={{ duration: 0.45, ease: 'easeOut' }}
                            style={{ fontSize: 'clamp(7rem, 25vw, 12rem)', fontWeight: 900, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {countdown === 0 ? '✦' : countdown}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Winner Screen ── */}
            <AnimatePresence>
                {revealState === 'winner' && winner && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={resetAll}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 150, cursor: 'pointer',
                            background: 'radial-gradient(ellipse at 50% 40%, #1a1060 0%, #080b18 65%)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            overflowY: 'auto', padding: '3rem 1.5rem',
                        }}>

                        {/* Pulsing ring */}
                        {[0, 1, 2].map(i => (
                            <motion.div key={i}
                                initial={{ scale: 0, opacity: 0.6 }}
                                animate={{ scale: 3.5, opacity: 0 }}
                                transition={{ duration: 3.5, delay: i * 0.9, repeat: Infinity }}
                                style={{ position: 'absolute', width: '12rem', height: '12rem', borderRadius: '50%', border: '1.5px solid rgba(99,102,241,0.25)' }}
                            />
                        ))}

                        {/* Trophy graphic — SVG star burst + circle */}
                        <motion.div
                            initial={{ scale: 0, rotate: -15 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.15 }}
                            style={{ marginBottom: '1.75rem', position: 'relative' }}>
                            <div style={{ width: '7rem', height: '7rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'drop-shadow(0 0 32px rgba(245,158,11,0.45))' }}>
                                <svg viewBox="0 0 72 72" width="72" height="72" fill="none">
                                    {/* Cup body */}
                                    <path d="M22 10h28v22a14 14 0 0 1-28 0V10z" fill="url(#tg)" stroke="none" />
                                    {/* Handles */}
                                    <path d="M22 14H14a6 6 0 0 0 0 12h8" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                    <path d="M50 14h8a6 6 0 0 1 0 12h-8" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                    {/* Stem */}
                                    <rect x="31" y="44" width="10" height="10" rx="1" fill="url(#tg)" />
                                    {/* Base */}
                                    <rect x="22" y="54" width="28" height="5" rx="2.5" fill="url(#tg)" />
                                    {/* Shine */}
                                    <path d="M28 16 Q30 24 28 30" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" fill="none" />
                                    <defs>
                                        <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#fbbf24" />
                                            <stop offset="100%" stopColor="#d97706" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </motion.div>

                        {/* CONGRATULATIONS */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            style={{ fontSize: 'clamp(0.625rem, 2vw, 0.875rem)', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                            Congratulations
                        </motion.p>

                        {/* Winner name */}
                        <motion.h2
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.65 }}
                            style={{
                                fontSize: 'clamp(1.875rem, 7vw, 4.25rem)', fontWeight: 900,
                                background: 'linear-gradient(125deg,#c7d2fe 0%,#67e8f9 55%,#f9a8d4 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.08, marginBottom: '1.75rem',
                            }}>
                            {winner.name}
                        </motion.h2>

                        {/* Score */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.9, type: 'spring' }}
                            style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', background: 'rgba(99,102,241,0.12)', padding: '0.875rem 2.5rem', borderRadius: '1.25rem', border: '1px solid rgba(99,102,241,0.25)' }}>
                            <span style={{ fontSize: 'clamp(2.75rem, 9vw, 4.5rem)', fontWeight: 900, color: '#a5b4fc', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{winnerScore}</span>
                            <span style={{ fontSize: '0.9375rem', color: '#4f46e5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>pts</span>
                        </motion.div>

                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
                            style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, marginTop: '2rem', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            IT Week 2026 Champion
                        </motion.p>

                        {/* Tap hint */}
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }}
                            transition={{ delay: 3, duration: 2.5, repeat: Infinity }}
                            style={{ marginTop: '2.25rem', color: '#475569', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.04em', pointerEvents: 'none' }}>
                            Tap anywhere to continue
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Scoreboard Cards ── */}
            <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '0 1rem 6rem', position: 'relative', zIndex: 1 }}>
                {hideAll ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                        <div style={{ display: 'inline-flex', width: '4.5rem', height: '4.5rem', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: '#ef4444' }}>
                            <Icon.Lock />
                        </div>
                        <p style={{ color: '#475569', fontWeight: 700, fontSize: '1.125rem' }}>Scoreboard Hidden</p>
                        <p style={{ color: '#1e293b', fontSize: '0.875rem', marginTop: '0.375rem' }}>Scores will be revealed soon</p>
                    </motion.div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {sorted.map((team, idx) => {
                            const score = team.score ?? 0
                            const pct = Math.min((score / maxScore) * 100, 100)
                            const rank = RANK[idx]
                            const isTop = idx === 0
                            const masked = hideTop2 && idx < 2

                            const barColor = idx === 0 ? 'linear-gradient(90deg,#6366f1,#06b6d4)'
                                : idx === 1 ? 'linear-gradient(90deg,#94a3b8,#cbd5e1)'
                                    : idx === 2 ? 'linear-gradient(90deg,#d97706,#f59e0b)'
                                        : 'linear-gradient(90deg,#334155,#475569)'

                            return (
                                <motion.div key={team.id}
                                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.07, duration: 0.45 }}
                                    style={{
                                        background: masked ? 'rgba(255,255,255,0.015)'
                                            : isTop ? 'rgba(99,102,241,0.1)'
                                                : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${masked ? 'rgba(255,255,255,0.04)'
                                            : isTop ? 'rgba(99,102,241,0.35)'
                                                : 'rgba(255,255,255,0.06)'}`,
                                        borderRadius: '1rem', padding: '1.125rem 1.25rem',
                                        boxShadow: (!masked && isTop) ? '0 0 28px rgba(99,102,241,0.12)' : 'none',
                                    }}>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: hideBars ? 0 : '0.875rem' }}>
                                        {/* Rank Badge */}
                                        <div style={{
                                            width: '2.375rem', height: '2.375rem', minWidth: '2.375rem',
                                            borderRadius: '0.625rem',
                                            background: masked ? 'rgba(255,255,255,0.04)'
                                                : rank ? `linear-gradient(135deg,${rank.gradient[0]},${rank.gradient[1]})`
                                                    : 'rgba(255,255,255,0.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: (!masked && rank) ? `0 2px 8px ${rank.gradient[0]}50` : 'none',
                                        }}>
                                            {masked ? (
                                                <span style={{ color: '#1e293b', fontWeight: 900, fontSize: '0.875rem' }}>?</span>
                                            ) : rank ? (
                                                <span style={{ color: 'white', fontWeight: 900, fontSize: idx === 0 ? '1rem' : '0.875rem' }}>{rank.num}</span>
                                            ) : (
                                                <span style={{ color: '#475569', fontWeight: 700, fontSize: '0.75rem' }}>#{idx + 1}</span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <p style={{ flex: 1, fontWeight: 800, fontSize: 'clamp(0.9375rem, 2.5vw, 1.0625rem)', color: masked ? '#1e293b' : '#e2e8f0', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {masked ? '— —' : hideNames ? '• • • • • •' : team.name}
                                        </p>

                                        {/* Score */}
                                        {!hideScores && (
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: masked ? '#1e293b' : isTop ? '#a5b4fc' : '#64748b', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                                                    {masked ? '—' : score}
                                                </p>
                                                {!masked && <p style={{ fontSize: '0.5rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.125rem' }}>pts</p>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bar */}
                                    {!hideBars && (
                                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: masked ? '0%' : `${pct}%` }}
                                                transition={{ duration: 1.1, delay: 0.25 + idx * 0.09, ease: 'easeOut' }}
                                                style={{ height: '100%', borderRadius: '99px', background: barColor }}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <p style={{ position: 'fixed', bottom: '0.625rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.5875rem', color: '#0f172a', pointerEvents: 'none', letterSpacing: '0.04em' }}>
                IT Week 2026 · CICT
            </p>
        </div>
    )
}
