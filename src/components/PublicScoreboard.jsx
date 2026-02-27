import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
// Encryption pulse animation for hidden states
function EncryptedPulse({ height = '1rem', width = '100%', opacity = 0.15 }) {
    return (
        <div style={{ position: 'relative', height, width, background: `rgba(255,255,255,${opacity * 0.4})`, borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.25), transparent)',
                }}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: '4px', padding: '4px' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{ opacity: [0.2, 0.8, 0.2] }}
                        transition={{ duration: 0.8 + Math.random(), repeat: Infinity, delay: Math.random() }}
                        style={{ height: '2px', width: '2px', borderRadius: '50%', background: '#C9A84C' }}
                    />
                ))}
            </div>
        </div>
    )
}

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
    const navigate = useNavigate()
    const [teams, setTeams] = useState([])
    const [settings, setSettings] = useState({
        hide_names: false, hide_scores: false,
        hide_bars: false, hide_top2: false,
        hide_rank_3: false, hide_rank_4: false,
        hide_all: false,
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

    // Responsive Window Width Hook
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Remote Navigation Listener
    useEffect(() => {
        if (settings.force_route && settings.force_route !== '/scoreboard') {
            navigate(settings.force_route)
        }
    }, [settings.force_route, navigate])

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
    const { hide_names, hide_scores, hide_bars, hide_top2, hide_rank_3, hide_rank_4, hide_all, reveal_state, reveal_countdown } = settings
    const winner = sorted[0]

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#080b18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        style={{ width: 64, height: 64, borderRadius: '50%', border: '4px solid rgba(201,168,76,0.1)', borderTopColor: '#C9A84C', margin: '0 auto 1.5rem', boxShadow: '0 0 30px rgba(201,168,76,0.2)' }} />
                    <p style={{ color: '#C9A84C', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.5em', textTransform: 'uppercase' }}>Synchronizing Standings</p>
                </motion.div>
                <div style={{ width: '200px' }}>
                    <EncryptedPulse opacity={0.3} height="2px" />
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, #0d1428 0%, #080b18 60%)', color: 'white', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', padding: isMobile ? '4rem 0 1rem' : '10vh 0 2rem' }}>

            {showConfetti && <Confetti />}

            {/* Ambient glows */}
            <div style={{ position: 'fixed', top: '-25vh', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '50vh', background: 'radial-gradient(ellipse, rgba(201,168,76,0.15) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '-15vh', right: '-15vw', width: '50vw', height: '50vh', background: 'radial-gradient(ellipse, rgba(123,28,28,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '-15vh', left: '-15vw', width: '50vw', height: '50vh', background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            {/* Cinematic Scanline Overlay (Tournament Polish) */}
            <div className="pattern-cinematic" style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none', opacity: 0.25 }} />

            {/* ── Countdown overlay (Luxury Overhaul) ── */}
            <AnimatePresence>
                {reveal_state === 'countdown' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at center, #2a0808 0%, #050505 80%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 300, overflow: 'hidden' }}>

                        {/* Immersive Background Effects */}
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                            style={{ position: 'absolute', width: '150vh', height: '150vh', background: 'conic-gradient(from 0deg, transparent 0deg, rgba(201,168,76,0.05) 90deg, transparent 180deg, rgba(201,168,76,0.05) 270deg, transparent 360deg)', pointerEvents: 'none' }} />

                        {/* Glassmorphic Container */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            style={{ position: 'relative', width: 'clamp(280px, 80vw, 400px)', aspectRatio: '1/1', background: 'rgba(20,5,5,0.4)', backdropFilter: 'blur(24px)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 80px rgba(0,0,0,0.8), inset 0 0 40px rgba(201,168,76,0.05)' }}>
                            <motion.p
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                                style={{ color: '#C9A84C', fontSize: '0.875rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '0.3em', textTransform: 'uppercase', textShadow: '0 0 10px rgba(201,168,76,0.5)' }}>
                                Revealing Champion
                            </motion.p>

                            <AnimatePresence mode="popLayout">
                                <motion.p
                                    key={reveal_countdown}
                                    initial={{ scale: 0.5, opacity: 0, filter: 'blur(10px)' }}
                                    animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
                                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ fontSize: 'clamp(6rem, 20vw, 10rem)', fontWeight: 900, background: 'linear-gradient(135deg, #f0d080, #C9A84C, #8B6914)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, fontVariantNumeric: 'tabular-nums', filter: 'drop-shadow(0 0 40px rgba(201,168,76,0.6))', margin: 0 }}>
                                    {reveal_countdown === 0 ? '✦' : reveal_countdown}
                                </motion.p>
                            </AnimatePresence>
                        </motion.div>

                        {/* Camera Flash Overlay at 0 */}
                        <AnimatePresence>
                            {reveal_countdown === 0 && (
                                <motion.div
                                    initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}
                                    style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 400, pointerEvents: 'none' }} />
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Winner screen (Luxury Overhaul) ── */}
            <AnimatePresence>
                {reveal_state === 'winner' && winner && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'radial-gradient(ellipse at 50% 30%, #2a0808 0%, #050505 80%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '3rem 1.5rem' }}>

                        {/* Cinematic Scanlines & Dust */}
                        <div className="pattern-cinematic" style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }} />
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 2 }}
                            style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.1, pointerEvents: 'none' }} />

                        {/* Grand Radiating Circles */}
                        {[0, 1, 2].map(i => (
                            <motion.div key={i} initial={{ scale: 0.5, opacity: 0.5 }} animate={{ scale: 4, opacity: 0 }}
                                transition={{ duration: 4, delay: i * 1.2, repeat: Infinity, ease: 'easeOut' }}
                                style={{ position: 'absolute', width: '15rem', height: '15rem', borderRadius: '50%', border: '2px solid rgba(201,168,76,0.2)', pointerEvents: 'none' }} />
                        ))}

                        {/* Massive Luxury Podium Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                            style={{ position: 'relative', width: '100%', maxWidth: '36rem', background: 'rgba(15,5,5,0.6)', backdropFilter: 'blur(32px)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '2.5rem', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 30px 100px rgba(0,0,0,0.8), inset 0 0 60px rgba(201,168,76,0.05)', overflow: 'hidden' }}>

                            {/* Inner Gold Glint */}
                            <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.8), transparent)' }} />

                            {/* Luxurious SVG Emblem */}
                            <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.3 }}
                                style={{ marginBottom: '2.5rem', position: 'relative' }}>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                                    style={{ position: 'absolute', inset: '-1rem', borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent, rgba(201,168,76,0.3), transparent)', filter: 'blur(10px)' }} />
                                <div style={{ width: '9rem', height: '9rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,5,5,0.8) 0%, rgba(201,168,76,0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.4)', boxShadow: '0 0 40px rgba(201,168,76,0.3), inset 0 0 20px rgba(201,168,76,0.2)' }}>
                                    <svg viewBox="0 0 72 72" width="80" height="80" fill="none">
                                        {/* Laurels / Grand Curves */}
                                        <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.8 }} d="M12 36c0-14 10-24 24-24s24 10 24 24" stroke="url(#tg2)" strokeWidth="1.5" strokeLinecap="round" />
                                        <path d="M22 10h28v22a14 14 0 0 1-28 0V10z" fill="url(#tg2)" opacity="0.8" />
                                        <path d="M22 14H14a6 6 0 0 0 0 12h8" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
                                        <path d="M50 14h8a6 6 0 0 1 0 12h-8" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" />
                                        <rect x="31" y="44" width="10" height="10" rx="1" fill="url(#tg2)" />
                                        <rect x="22" y="54" width="28" height="5" rx="2.5" fill="url(#tg2)" />
                                        <path d="M36 20 l-4 6 h8 l-4 -6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                                        <defs>
                                            <linearGradient id="tg2" x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor="#f0d080" />
                                                <stop offset="50%" stopColor="#C9A84C" />
                                                <stop offset="100%" stopColor="#8B6914" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                            </motion.div>

                            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                                style={{ fontSize: 'clamp(0.75rem, 2.5vw, 1rem)', fontWeight: 800, color: '#C9A84C', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '0.75rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                Crowned Champion
                            </motion.p>

                            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                                style={{ fontSize: 'clamp(2rem, 8vw, 4.5rem)', fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, #f0d080 50%, #C9A84C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.1, marginBottom: '2.5rem', filter: 'drop-shadow(0 4px 12px rgba(201,168,76,0.3))' }}>
                                {winner.name}
                            </motion.h2>

                            {/* Sweeping Score Box */}
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, type: 'spring', bounce: 0.4 }}
                                style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', background: 'linear-gradient(180deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.05) 100%)', padding: '1.25rem 3.5rem', borderRadius: '1.5rem', border: '1px solid rgba(201,168,76,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 2px 10px rgba(255,255,255,0.1)' }}>
                                <span style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 900, color: '#f0d080', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 20px rgba(201,168,76,0.6)' }}>{winnerScore}</span>
                                <span style={{ fontSize: '1rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>pts</span>
                            </motion.div>

                            <motion.div initial={{ width: 0 }} animate={{ width: '80%' }} transition={{ delay: 1.5, duration: 1 }}
                                style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)', marginTop: '2.5rem', marginBottom: '1.5rem' }} />

                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
                                style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                IT Week 2026 • Official Results
                            </motion.p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
                style={{ textAlign: 'center', padding: isMobile ? '0 1rem 0.5rem' : '1.5rem 1rem 1.5rem', position: 'relative', zIndex: 1 }}>

                {/* Logo - Hidden on mobile to save vertical space and prevent scroll */}
                {!isMobile && (
                    <motion.img src="/logo.png" alt="CICT Logo"
                        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 18 }}
                        style={{ display: 'block', margin: '0 auto', width: '5.5rem', height: '5.5rem', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', boxShadow: '0 0 0 4px rgba(201,168,76,0.15), 0 0 48px rgba(201,168,76,0.25)' }} />
                )}

                <h1 style={{ fontSize: isMobile ? 'clamp(2.5rem, 10vw, 3rem)' : 'clamp(3rem, 6vw, 4rem)', fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #f0d080 0%, #C9A84C 50%, #8B6914 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 0.5rem', lineHeight: 1, filter: 'drop-shadow(0px 4px 20px rgba(201,168,76,0.4))' }}>
                    IT Week 2026
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 1.25rem', borderRadius: '100px', width: 'max-content', margin: '0 auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 12px #ef4444' }} />
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>LIVE SCOREBOARD</p>
                </div>
            </motion.div>

            {/* ── Scoreboard cards ── */}
            <div style={{ flex: 1, maxWidth: '56rem', width: '100%', margin: '0 auto', padding: '0.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.5rem' : '1rem', position: 'relative', zIndex: 1 }}>
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
                        const isHiddenTop2 = hide_top2 && index < 2
                        const isHiddenRank3 = hide_rank_3 && index === 2
                        const isHiddenRank4 = hide_rank_4 && index === 3
                        const isHiddenTop = isHiddenTop2 || isHiddenRank3 || isHiddenRank4
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
                                    y: [0, -4, 0], // Idle floating
                                    // Flash gold when top2 is revealed
                                    boxShadow: isTop && !isHiddenTop
                                        ? `0 0 40px -8px ${rs.glow}, inset 0 0 40px -20px ${rs.glow}`
                                        : '0 0 0px transparent',
                                }}
                                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                                transition={{
                                    opacity: { duration: 0.55 },
                                    x: { duration: 0.55 },
                                    scale: { duration: 0.55 },
                                    y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 },
                                    layout: { type: 'spring', stiffness: 350, damping: 40 },
                                    default: { ease: [0.22, 1, 0.36, 1] }
                                }}
                                style={{
                                    background: rs.cardBg,
                                    border: `1.5px solid ${rs.cardBorder}`,
                                    borderRadius: '1.5rem',
                                    padding: isMobile ? '0.75rem 1rem' : (isTop ? '2rem 2.5rem' : '1.5rem 2.5rem'),
                                    position: 'relative', overflow: 'hidden',
                                    backdropFilter: 'blur(24px)',
                                    boxShadow: isTop && !isHiddenTop ? `0 20px 60px -15px ${rs.glow}` : '0 10px 30px -10px rgba(0,0,0,0.5)',
                                }}>

                                {/* Gold glint for 1st */}
                                <AnimatePresence>
                                    {isTop && !isHiddenTop && (
                                        <motion.div
                                            key="glint"
                                            initial={{ opacity: 0, x: '-100%' }} animate={{ opacity: 1, x: '100%' }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '1.5px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.8), transparent)', zIndex: 10 }} />
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

                                {/* Responsive Card Layout */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    alignItems: isMobile ? 'flex-start' : 'center',
                                    gap: isMobile ? '1.25rem' : '2.5rem'
                                }}>
                                    {/* Rank badge and Score combination on mobile, standalone on desktop */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: isMobile ? '100%' : 'auto' }}>
                                        {/* Rank badge */}
                                        <motion.div
                                            animate={{
                                                width: isTop ? '4rem' : '3.25rem',
                                                height: isTop ? '4rem' : '3.25rem',
                                                borderColor: isHiddenTop ? 'rgba(255,255,255,0.06)' : rs.color,
                                                background: isHiddenTop ? 'rgba(255,255,255,0.02)' : `${rs.color}18`,
                                                scale: isHiddenTop ? 1 : [1, 1.05, 1],
                                            }}
                                            transition={{
                                                width: { duration: 0.4 }, height: { duration: 0.4 },
                                                borderColor: { duration: 0.4 }, background: { duration: 0.4 },
                                                scale: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 }
                                            }}
                                            style={{
                                                borderRadius: '1rem',
                                                border: `2px solid ${isHiddenTop ? 'rgba(255,255,255,0.06)' : rs.color}`,
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, boxShadow: isHiddenTop ? 'none' : `0 0 25px -5px ${rs.glow}`,
                                                transform: 'rotate(-5deg)',
                                            }}>
                                            <span style={{ fontSize: isTop ? '1.5rem' : '1.125rem', fontWeight: 900, color: isHiddenTop ? 'rgba(255,255,255,0.08)' : rs.color, lineHeight: 1, textShadow: isHiddenTop ? 'none' : `0 0 10px ${rs.glow}` }}>
                                                {isHiddenTop ? '?' : index + 1}
                                            </span>
                                            <AnimatePresence>
                                                {!isHiddenTop && (
                                                    <motion.span
                                                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 0.9, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                        transition={{ duration: 0.3 }}
                                                        style={{ fontSize: '0.45rem', fontWeight: 900, color: rs.color, letterSpacing: '0.1em', marginTop: '2px' }}>
                                                        {rs.label}
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>

                                        {/* Mobile Score (Pushed up next to Rank Badge) */}
                                        {isMobile && (
                                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                                <AnimatePresence mode="wait">
                                                    {scoreHidden ? (
                                                        <motion.div key="score-hidden-mobile"
                                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 10 }}
                                                            transition={{ duration: 0.3 }}
                                                            style={{ width: '3rem', marginLeft: 'auto' }}>
                                                            <EncryptedPulse height="1.5rem" opacity={0.15} />
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div key="score-visible-mobile"
                                                            initial={{ opacity: 0, scale: 0.6, filter: 'blur(12px)' }}
                                                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                                            exit={{ opacity: 0, scale: 0.6 }}
                                                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
                                                            <AnimatedScore
                                                                value={score}
                                                                color={rs.color}
                                                                glow={rs.glow}
                                                                fontSize={'clamp(1.375rem, 3vw, 2rem)'}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                    {/* Right Content Pillar / Main Body */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: hide_bars ? 0 : (isMobile ? '0.75rem' : '1.25rem'), width: '100%', justifyContent: 'center' }}>

                                        {/* Top Row: Team Name & Numeric Score */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem' }}>
                                            {/* Team name with animated reveal */}
                                            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: isTop ? '2rem' : '1.5rem' }}>
                                                <AnimatePresence mode="wait">
                                                    {nameHidden ? (
                                                        <motion.div key="redacted"
                                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -10 }}
                                                            transition={{ duration: 0.3 }}
                                                            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                                                            <EncryptedPulse width="70%" opacity={0.12} />
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
                                                                fontSize: isTop ? 'clamp(1.15rem, 5vw, 1.75rem)' : 'clamp(1rem, 4.5vw, 1.375rem)',
                                                                color: isTop ? '#f0d080' : 'rgba(255,255,255,0.85)',
                                                                letterSpacing: '-0.02em', lineHeight: 1.15,
                                                                whiteSpace: isMobile ? 'normal' : 'nowrap',
                                                                overflow: 'hidden', textOverflow: 'ellipsis'
                                                            }}>
                                                            {team.name}
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Desktop Score (Right-Aligned) */}
                                            {!isMobile && (
                                                <div style={{ flexShrink: 0, minWidth: '4.5rem', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    <AnimatePresence mode="wait">
                                                        {scoreHidden ? (
                                                            <motion.div key="score-hidden"
                                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 10 }}
                                                                transition={{ duration: 0.3 }}
                                                                style={{ width: '4rem', marginLeft: 'auto' }}>
                                                                <EncryptedPulse height={isTop ? '2.5rem' : '1.75rem'} opacity={0.15} />
                                                            </motion.div>
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
                                                                    fontSize={isTop ? 'clamp(1.75rem, 4vw, 2.75rem)' : 'clamp(1.5rem, 3vw, 2.25rem)'}
                                                                />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </div>

                                        {/* Progress bar with animated reveal */}
                                        <div style={{ position: 'relative', height: hide_bars ? 0 : (isMobile ? '4px' : '5px'), width: '100%', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden', opacity: hide_bars ? 0 : 1, transition: 'all 0.5s ease-in-out' }}>
                                            {!hide_bars && (
                                                <AnimatePresence mode="wait">
                                                    {scoreHidden ? (
                                                        <motion.div key="bar-hidden"
                                                            className="scanner-line-vertical"
                                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.3 }}
                                                            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />
                                                    ) : (
                                                        <motion.div key="bar-visible"
                                                            initial={{ width: '0%', opacity: 0.5 }}
                                                            animate={{ width: `${pct}%`, opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 1.8, ease: "easeOut", type: 'tween' }}
                                                            style={{
                                                                height: '100%',
                                                                background: `linear-gradient(90deg, ${rs.color}20, ${rs.color})`,
                                                                boxShadow: `0 0 15px ${rs.glow}`
                                                            }}
                                                        />
                                                    )}
                                                </AnimatePresence>
                                            )}
                                        </div>
                                    </div> {/* END Right Content Pillar */}
                                </div> {/* END RESPONSIVE CARD LAYOUT DIV */}
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )
}


