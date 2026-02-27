import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function AdminPointTally({ isPublic = false, onLogout, onNavigateScanner, onNavigateManageData, onNavigateAudit, onNavigateHistory }) {
    const navigate = useNavigate()
    const [teams, setTeams] = useState([])
    const [events, setEvents] = useState([])
    const [scoreLogs, setScoreLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    // NEW: 150 Base points for each team
    const BASE_POINTS = 150;

    const fetchData = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        try {
            const [
                { data: teamsData },
                { data: eventsData, error: eventsErr },
                { data: logsData }
            ] = await Promise.all([
                supabase.from('teams').select('*').order('name'),
                supabase.from('events').select('*').order('name'),
                supabase.from('score_logs').select('*')
            ])
            setTeams(teamsData || [])
            setScoreLogs(logsData || [])
            if (eventsErr && eventsErr.code === '42P01') {
                const uniqueReasons = [...new Set((logsData || []).map(l => l.reason))].filter(Boolean)
                // If events table is missing, just use an empty array. We put manual reasons in 'Other'.
                setEvents([])
            } else {
                setEvents(eventsData || [])
            }
        } catch (err) {
            console.error('Failed to fetch tally data:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Public Remote Navigation Listener
    useEffect(() => {
        if (!isPublic || !supabase) return

        const fetchRoute = async () => {
            const { data } = await supabase.from('scoreboard_settings').select('force_route').eq('id', 1).single()
            if (data?.force_route && data.force_route !== '/official-standings-2026-secure') {
                navigate(data.force_route)
            }
        }

        const sub = supabase.channel('tally-settings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scoreboard_settings' }, fetchRoute)
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [isPublic, navigate])

    const getScore = (teamName, eventName) => scoreLogs.filter(l => l.team_name === teamName && l.reason === eventName).reduce((sum, l) => sum + Number(l.delta), 0)

    // getOtherScore is the mathematical difference so the columns always sum to the DB total.
    // It captures manually added overrides, 0-clamping adjustments, and points from before logging existed
    const getOtherScore = (teamName) => {
        const teamTotal = getTeamTotal(teamName)
        const eventNames = new Set(events.map(e => e.name))

        const eventsSum = scoreLogs
            .filter(l => l.team_name === teamName && eventNames.has(l.reason))
            .reduce((sum, l) => sum + Number(l.delta), 0)

        return teamTotal - BASE_POINTS - eventsSum
    }

    const getTeamTotal = (teamName) => {
        const team = teams.find(t => t.name === teamName)
        return team?.score ?? BASE_POINTS
    }

    const eventNames = new Set(events.map(e => e.name))
    const rankedTeams = [...teams].sort((a, b) => getTeamTotal(b.name) - getTeamTotal(a.name));
    const top3 = rankedTeams.slice(0, 3);
    const highestScore = rankedTeams.length > 0 ? getTeamTotal(rankedTeams[0].name) : 0;

    // Theme Colors
    const colorMaroon = '#7B1C1C';
    const colorMaroonDark = '#4A1111';
    const colorGold = '#C9A84C';
    const colorGoldLight = '#FDE047';
    const colorGreyDark = '#1E293B'; // Slate 800
    const colorGreyDarker = '#0F172A'; // Slate 900
    const colorGreyLight = '#94A3B8'; // Slate 400
    const colorTextLight = '#F8FAFC'; // Slate 50

    return (
        <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top center, ${colorGreyDark}, ${colorGreyDarker} 120%)`, color: colorTextLight, fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>
            <style>{`
                .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(201, 168, 76, 0.1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
                .glow-gold { text-shadow: 0 0 25px rgba(201, 168, 76, 0.6); }
                .glow-green { text-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
                .glow-red { text-shadow: 0 0 15px rgba(239, 68, 68, 0.5); }
                .tally-table th { border-bottom: 1px solid rgba(201, 168, 76, 0.15); }
                .tally-table td { border-bottom: 1px solid rgba(201, 168, 76, 0.05); }
                .tally-row { transition: background 0.3s ease; }
                .tally-row:hover { background: rgba(123, 28, 28, 0.15); }
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(201, 168, 76, 0.3); border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: ${colorGold}; }
                .gold-gradient-text { background: linear-gradient(135deg, ${colorGoldLight}, ${colorGold}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            `}</style>

            {/* Premium Header */}
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(123,28,28,0.3)' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, margin: 0 }}>POINT STANDINGS</p>
                            <p style={{ fontSize: '0.625rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.125rem 0 0' }}>Official 2026 Standing Orders</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {!isPublic && (
                            <div style={{ position: 'relative' }}>
                                <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '0.625rem', borderRadius: '0.75rem', background: menuOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </button>
                                <AnimatePresence>
                                    {menuOpen && (
                                        <>
                                            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                                            <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                style={{ position: 'absolute', right: 0, top: 'calc(100% + 0.75rem)', background: '#1e293b', borderRadius: '1.25rem', padding: '0.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '220px', zIndex: 50, overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />

                                                <button onClick={() => { setMenuOpen(false); onNavigateScanner && onNavigateScanner(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                                    Attendance Scanner
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); onNavigateManageData && onNavigateManageData(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                    Manage Teams & Scores
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); onNavigateAudit && onNavigateAudit(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    Personnel & Audit Logs
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'rgba(201,168,76,0.1)', fontSize: '0.8125rem', fontWeight: 700, color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                    Point Standings
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); onNavigateHistory && onNavigateHistory(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    Activity History
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); navigate('/'); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    Profile Dashboard
                                                </button>
                                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.5rem 0.75rem' }} />
                                                <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                                    Logout
                                                </button>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <main style={{ maxWidth: '90rem', margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        {/* Podium Skeleton */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="glass-panel" style={{ padding: '3rem 2rem', borderRadius: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                                    <div className="skeleton-gold" style={{ width: '4rem', height: '4rem', borderRadius: '50%' }} />
                                    <div className="skeleton-dark" style={{ width: '8rem', height: '1.5rem', borderRadius: '0.5rem' }} />
                                    <div className="skeleton-gold" style={{ width: '6rem', height: '3.5rem', borderRadius: '0.5rem' }} />
                                </div>
                            ))}
                        </div>

                        {/* Table Skeleton */}
                        <div className="glass-panel" style={{ borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="skeleton-gold" style={{ width: '12rem', height: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }} />
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                                    <div className="skeleton-dark" style={{ flex: 2, height: '3rem', borderRadius: '0.75rem' }} />
                                    <div className="skeleton-dark" style={{ flex: 1, height: '3rem', borderRadius: '0.75rem' }} />
                                    <div className="skeleton-dark" style={{ flex: 1, height: '3rem', borderRadius: '0.75rem' }} />
                                    <div className="skeleton-dark" style={{ flex: 1, height: '3rem', borderRadius: '0.75rem' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : teams.length === 0 ? (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '8rem 0', borderRadius: '1.5rem' }}>
                        <p style={{ fontSize: '1.75rem', fontWeight: 800, color: colorTextLight, marginBottom: '0.5rem' }}>No Data Feeds Active</p>
                        <p style={{ color: colorGreyLight, fontSize: '1.125rem' }}>Awaiting team registration in central database.</p>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
                        {/* Podium */}
                        {top3.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
                                {top3.map((team, index) => {
                                    const score = getTeamTotal(team.name);
                                    const isFirst = index === 0 && score > 0;
                                    const podiumColors = [
                                        `linear-gradient(135deg, rgba(201,168,76,0.2), rgba(123,28,28,0.4))`, // Gold to Maroon
                                        `linear-gradient(135deg, rgba(148,163,184,0.15), rgba(30,41,59,0.5))`,   // Silver/Grey
                                        `linear-gradient(135deg, rgba(180,83,9,0.15), rgba(123,28,28,0.2))`       // Bronze to Maroon-ish
                                    ];
                                    const podiumBorders = [
                                        `rgba(201,168,76,0.6)`,
                                        `rgba(148,163,184,0.4)`,
                                        `rgba(180,83,9,0.4)`
                                    ];

                                    return (
                                        <motion.div key={team.id}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.15, type: 'spring', stiffness: 100 }}
                                            className="glass-panel"
                                            style={{
                                                position: 'relative',
                                                padding: '3rem 2rem',
                                                borderRadius: '1.5rem',
                                                background: score > 0 ? podiumColors[index] : `rgba(30,41,59,0.4)`,
                                                border: `1px solid ${score > 0 ? podiumBorders[index] : 'rgba(255,255,255,0.05)'}`,
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                overflow: 'hidden',
                                                boxShadow: isFirst ? `0 10px 40px rgba(123,28,28,0.4)` : '0 8px 32px rgba(0,0,0,0.3)'
                                            }}>
                                            {isFirst && (
                                                <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: `radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)`, zIndex: 0, pointerEvents: 'none' }} />
                                            )}
                                            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                                                {isFirst && (
                                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                                        <svg width="64" height="64" viewBox="0 0 24 24" fill="url(#goldGradient)" style={{ filter: `drop-shadow(0 0 20px rgba(201,168,76,0.8))` }}>
                                                            <defs>
                                                                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                                    <stop offset="0%" stopColor={colorGoldLight} />
                                                                    <stop offset="50%" stopColor={colorGold} />
                                                                    <stop offset="100%" stopColor={colorMaroon} />
                                                                </linearGradient>
                                                            </defs>
                                                            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                                        </svg>
                                                    </motion.div>
                                                )}
                                                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: score > 0 ? colorGold : colorGreyLight, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                                                    {score > 0 ? `RANK 0${index + 1}` : 'UNRANKED'}
                                                </div>
                                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: colorTextLight, marginBottom: '1rem', lineHeight: 1.2 }}>
                                                    {team.name}
                                                </div>
                                                <div className={isFirst ? "glow-gold gold-gradient-text" : ""} style={{ fontSize: '4.5rem', fontWeight: 900, color: isFirst ? colorGold : colorTextLight, lineHeight: 1 }}>
                                                    {score}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Data Matrix */}
                        <div className="glass-panel" style={{ borderRadius: '1.5rem', overflow: 'hidden', border: `1px solid rgba(201,168,76,0.2)` }}>
                            <div style={{ padding: '1.5rem 2rem', borderBottom: `1px solid rgba(201,168,76,0.2)`, display: 'flex', alignItems: 'center', gap: '0.75rem', background: `linear-gradient(90deg, rgba(123,28,28,0.4), rgba(30,41,59,0.4))` }}>
                                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorGold, boxShadow: `0 0 10px ${colorGold}` }} />
                                <span className="gold-gradient-text" style={{ fontWeight: 800, letterSpacing: '0.2em', fontSize: '0.875rem', textTransform: 'uppercase' }}>Detailed Point Matrix</span>
                            </div>

                            {/* Desktop Matrix Table */}
                            <div className="desktop-table">
                                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                    <table className="tally-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: colorGreyLight, textTransform: 'uppercase', letterSpacing: '0.15em', background: 'rgba(0,0,0,0.2)', width: '25%' }}>
                                                    Metrics
                                                </th>
                                                {teams.map(team => (
                                                    <th key={team.id} style={{ padding: '1.25rem 1rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: colorGold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                                            {team.name}
                                                        </span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <motion.tr className="tally-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: `rgba(201,168,76,0.05)` }}>
                                                <td style={{ padding: '1.5rem 2rem', fontWeight: 800, color: colorGold, fontSize: '0.9375rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Base Points</td>
                                                {teams.map(team => (
                                                    <td key={`base-${team.id}`} style={{ padding: '1.5rem 1rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 900, color: colorGold }}>{BASE_POINTS}</td>
                                                ))}
                                            </motion.tr>
                                            {events.map((event, ei) => (
                                                <motion.tr key={event.id || event.name} className="tally-row" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * ei }}>
                                                    <td style={{ padding: '1.25rem 2rem', fontWeight: 600, color: '#e2e8f0', fontSize: '0.9375rem' }}>{event.name}</td>
                                                    {teams.map(team => {
                                                        const score = getScore(team.name, event.name);
                                                        return (
                                                            <td key={team.id} className={score > 0 ? "glow-green" : score < 0 ? "glow-red" : ""} style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '1.125rem', fontWeight: 800, color: score > 0 ? '#10b981' : score < 0 ? '#ef4444' : colorGreyLight }}>
                                                                {score !== 0 ? (score > 0 ? `+${score}` : score) : '0'}
                                                            </td>
                                                        )
                                                    })}
                                                </motion.tr>
                                            ))}
                                            <motion.tr className="tally-row" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * events.length }}>
                                                <td style={{ padding: '1.25rem 2rem' }}>
                                                    <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONDUCT & DISCIPLINE</div>
                                                </td>
                                                {teams.map(team => {
                                                    const teamTotal = team.score ?? BASE_POINTS
                                                    const logSum = scoreLogs
                                                        .filter(l => l.team_name === team.name && eventNames.has(l.reason))
                                                        .reduce((sum, l) => sum + Number(l.delta), 0)
                                                    const score = teamTotal - BASE_POINTS - logSum
                                                    return (
                                                        <td key={team.id} className={score > 0 ? "glow-green" : score < 0 ? "glow-red" : ""} style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '1.125rem', fontWeight: 800, color: score > 0 ? '#10b981' : score < 0 ? '#ef4444' : colorGreyLight }}>
                                                            {score !== 0 ? (score > 0 ? `+${score}` : score) : '0'}
                                                        </td>
                                                    )
                                                })}
                                            </motion.tr>
                                            <tr style={{ background: `linear-gradient(90deg, ${colorMaroonDark}, ${colorGreyDarker})`, borderTop: `1.5px solid ${colorGold}` }}>
                                                <td style={{ padding: '1.5rem 2rem', color: colorGold, fontWeight: 900, fontSize: '0.9375rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>AGGREGATE TOTAL</td>
                                                {teams.map(team => {
                                                    const total = getTeamTotal(team.name);
                                                    const isWinner = total === highestScore && total > 0;
                                                    return (
                                                        <td key={team.id} className={isWinner ? "glow-gold gold-gradient-text" : ""} style={{ padding: '1.5rem 1rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900, color: isWinner ? colorGold : colorTextLight }}>{total}</td>
                                                    )
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Team Cards */}
                            <div className="mobile-cards" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {teams.map((team, index) => {
                                        const total = getTeamTotal(team.name);
                                        const isWinner = total === highestScore && total > 0;
                                        return (
                                            <motion.div key={team.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }}
                                                className="luxury-card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', border: isWinner ? `1px solid ${colorGold}` : '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                                    <span style={{ fontSize: '1.125rem', fontWeight: 900, color: isWinner ? colorGold : 'white' }}>{team.name}</span>
                                                    <span className={isWinner ? "glow-gold gold-gradient-text" : ""} style={{ fontSize: '1.75rem', fontWeight: 900, color: isWinner ? colorGold : 'white' }}>{total}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                                                        <span style={{ color: colorGreyLight }}>BASE POINTS</span>
                                                        <span style={{ color: colorGold }}>{BASE_POINTS}</span>
                                                    </div>
                                                    {events.map(event => {
                                                        const score = getScore(team.name, event.name);
                                                        if (score === 0) return null;
                                                        return (
                                                            <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
                                                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{event.name}</span>
                                                                <span style={{ color: score > 0 ? '#10b981' : '#ef4444' }}>{score > 0 ? `+${score}` : score}</span>
                                                            </div>
                                                        )
                                                    })}
                                                    {(() => {
                                                        const teamTotal = team.score ?? BASE_POINTS
                                                        const logSum = scoreLogs
                                                            .filter(l => l.team_name === team.name && eventNames.has(l.reason))
                                                            .reduce((sum, l) => sum + Number(l.delta), 0)
                                                        const score = teamTotal - BASE_POINTS - logSum
                                                        if (score === 0) return null;
                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
                                                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>CONDUCT & DISCIPLINE</span>
                                                                    <span style={{ color: score > 0 ? '#10b981' : '#ef4444' }}>{score > 0 ? `+${score}` : score}</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}
            </main>
        </div>
    )
}

function React() { /* Placeholder */ }
