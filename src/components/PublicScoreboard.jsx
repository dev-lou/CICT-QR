import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function PublicScoreboard() {
    const [teams, setTeams] = useState([])
    const [settings, setSettings] = useState({
        hide_names: false, hide_scores: false,
        hide_bars: false, hide_top2: false, hide_all: false,
    })
    const [loading, setLoading] = useState(true)

    // Fetch both teams and settings
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

        // Realtime subscriptions (may require replication enabled in Supabase dashboard)
        const teamChan = supabase
            .channel('pub-teams')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchAll)
            .subscribe()
        const settingsChan = supabase
            .channel('pub-settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scoreboard_settings' }, fetchAll)
            .subscribe()

        // Guaranteed fallback: poll every 3 seconds regardless of realtime status
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
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C' }} />
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080b18 0%, #0f1729 100%)', color: 'white', fontFamily: 'inherit', padding: '0 0 3rem' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', padding: '2rem 1rem 1.5rem' }}>
                {/* CICT Logo */}
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: '50%', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', marginBottom: '1rem', flexDirection: 'column', gap: '1px', boxShadow: '0 0 32px rgba(201,168,76,0.3)' }}>
                    <span style={{ color: 'white', fontWeight: 900, fontSize: '0.875rem', letterSpacing: '0.05em' }}>CICT</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.4375rem', letterSpacing: '0.08em' }}>ISUFST</span>
                </div>
                <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 900, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #C9A84C, #f0d080)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                    IT Week 2026
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Live Scoreboard</p>
            </div>

            {/* Scoreboard */}
            <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <AnimatePresence>
                    {hide_all ? (
                        <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ textAlign: 'center', padding: '4rem 1rem', color: 'rgba(255,255,255,0.25)', fontSize: '1rem' }}>
                            🔒 Scoreboard is currently hidden
                        </motion.div>
                    ) : sorted.map((team, index) => {
                        if (hide_top2 && index < 2) return null
                        const score = team.score ?? 0
                        const pct = Math.max(4, (score / maxScore) * 100)
                        const isTop = index === 0
                        const medals = ['🥇', '🥈', '🥉']

                        return (
                            <motion.div key={team.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.06, duration: 0.4 }}
                                style={{
                                    background: isTop
                                        ? 'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(123,28,28,0.1) 100%)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: `1.5px solid ${isTop ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)'}`,
                                    borderRadius: '1rem',
                                    padding: '1rem 1.25rem',
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: hide_bars ? 0 : '0.625rem' }}>
                                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{medals[index] ?? `#${index + 1}`}</span>
                                    <span style={{ flex: 1, fontWeight: 700, fontSize: '1rem', color: hide_names ? 'transparent' : isTop ? '#f0d080' : 'white', textShadow: hide_names ? 'none' : undefined, userSelect: hide_names ? 'none' : undefined, filter: hide_names ? 'blur(6px)' : 'none', transition: 'filter 0.3s' }}>
                                        {team.name}
                                    </span>
                                    <span style={{ fontWeight: 900, fontSize: '1.25rem', color: hide_scores ? 'transparent' : isTop ? '#C9A84C' : '#94a3b8', filter: hide_scores ? 'blur(8px)' : 'none', transition: 'filter 0.3s', fontVariantNumeric: 'tabular-nums' }}>
                                        {score}
                                    </span>
                                </div>
                                {!hide_bars && (
                                    <div style={{ height: '0.375rem', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.8, delay: index * 0.06 + 0.2, ease: 'easeOut' }}
                                            style={{ height: '100%', borderRadius: '99px', background: isTop ? 'linear-gradient(90deg, #C9A84C, #f0d080)' : 'linear-gradient(90deg, #7B1C1C, #a02424)' }}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', marginTop: '2rem' }}>
                🔴 Live · Updates automatically
            </p>
        </div>
    )
}
