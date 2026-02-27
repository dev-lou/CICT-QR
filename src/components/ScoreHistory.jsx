import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import CustomDropdown from './CustomDropdown'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (ts) =>
    new Date(ts).toLocaleString('en-PH', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Manila',
    })

/* ── Icons ───────────────────────────────────────────────────────────────── */
const ArrowLeft = () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
)

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function ScoreHistory({ isAdmin, onBack, onNavigateScanner, onNavigateManageData, onNavigateAudit, onNavigateTally, onLogout }) {
    const navigate = useNavigate()
    const [logs, setLogs] = useState([])
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterTeam, setFilterTeam] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [search, setSearch] = useState('')
    const [menuOpen, setMenuOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 10

    const fetchData = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        try {
            const [{ data: logsData }, { data: teamsData }] = await Promise.all([
                supabase.from('score_logs').select('*').order('created_at', { ascending: false }).limit(500),
                supabase.from('teams').select('id, name').order('name'),
            ])
            if (logsData) setLogs(logsData)
            if (teamsData) setTeams(teamsData)
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    useEffect(() => {
        setCurrentPage(1)
    }, [filterTeam, filterType, search])

    const filtered = logs.filter((e) => {
        if (filterTeam !== 'all' && filterTeam !== 'All Participating Teams' && e.team_name !== filterTeam) return false
        if (filterType === 'merit' && e.delta <= 0) return false
        if (filterType === 'demerit' && e.delta > 0) return false
        if (search && !e.team_name.toLowerCase().includes(search.toLowerCase()) &&
            !e.reason?.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const totalPages = Math.ceil(filtered.length / pageSize)
    const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const totalMerit = filtered.filter(e => e.delta > 0).reduce((s, e) => s + e.delta, 0)
    const totalDemerit = filtered.filter(e => e.delta < 0).reduce((s, e) => s + e.delta, 0)
    const netDelta = totalMerit + totalDemerit

    const handleBack = () => {
        if (onBack) return onBack()
        if (window.history.length > 1) window.history.back()
        else window.close()
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
                .luxury-input { width: 100%; padding: 0.875rem 1.125rem; border-radius: 1rem; border: 1.5px solid rgba(255,255,255,0.12); background: rgba(15, 23, 42, 0.6); color: white; outline: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit; }
                .luxury-input::placeholder { color: rgba(255, 255, 255, 0.5); }
                .luxury-input:focus { border-color: #C9A84C; background: rgba(201,168,76,0.1); box-shadow: 0 0 20px rgba(201,168,76,0.15); }
                .luxury-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; transition: all 0.3s ease; }
                .holographic-gold { background: linear-gradient(90deg, #7B1C1C, #C9A84C, #7B1C1C); background-size: 200% 100%; animation: shimmer 3s infinite linear; }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            `}</style>

            {/* Premium Header */}
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer' }}>
                            <ArrowLeft />
                        </button>
                        <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, margin: 0 }}>ACTIVITY HISTORY</p>
                            <p style={{ fontSize: '0.625rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.125rem 0 0' }}>Merit & Demerit History</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {isAdmin && (
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
                                                <button onClick={() => { setMenuOpen(false); onNavigateScanner && onNavigateScanner(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                                    Attendance Scanner
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); onNavigateManageData && onNavigateManageData(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                    Manage Teams & Scores
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); onNavigateAudit && onNavigateAudit(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    Personnel & Audit Logs
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); onNavigateTally && onNavigateTally(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                    Point Standings
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'rgba(201,168,76,0.1)', fontSize: '0.8125rem', fontWeight: 700, color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    Activity History
                                                </button>
                                                <button onClick={() => { setMenuOpen(false); navigate('/'); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    Profile Dashboard
                                                </button>
                                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.5rem 0.75rem' }} />
                                                <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                                    Logout
                                                </button>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                        <button onClick={fetchData} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '0.75rem', padding: '0.625rem 1.25rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Refresh Ledger
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '2rem 1.5rem' }}>

                {/* ── Summary statistics ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                    {[
                        { label: 'Cumulative Merits', value: `+${totalMerit}`, color: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.2)' },
                        { label: 'Penalty Deductions', value: totalDemerit || 0, color: '#ef4444', bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.2)' },
                        { label: 'Net Standing', value: netDelta >= 0 ? `+${netDelta}` : netDelta, color: netDelta >= 0 ? '#10b981' : '#ef4444', bg: 'rgba(201,168,76,0.05)', border: 'rgba(201,168,76,0.2)' },
                    ].map(c => (
                        <div key={c.label} className="luxury-card" style={{ background: c.bg, border: `1px solid ${c.border}`, padding: '1.25rem', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{c.label}</p>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Filters ── */}
                <div className="luxury-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'visible', zIndex: 10, position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 220px' }}>
                            <CustomDropdown
                                value={filterTeam}
                                options={[{ id: 'all', name: 'All Participating Teams' }, ...teams]}
                                onChange={setFilterTeam}
                                dark={true}
                                fontSize="0.8125rem"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.875rem', padding: '0.25rem' }}>
                            {[['all', 'All'], ['merit', 'Merit'], ['demerit', 'Demerit']].map(([v, l]) => (
                                <button key={v} onClick={() => setFilterType(v)}
                                    style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: 'none', fontSize: '0.75rem', fontWeight: filterType === v ? 900 : 600, cursor: 'pointer', background: filterType === v ? 'rgba(201,168,76,0.2)' : 'transparent', color: filterType === v ? '#C9A84C' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search specific team or citation…"
                        className="luxury-input"
                        style={{ fontSize: '0.8125rem' }}
                    />
                </div>

                {/* ── Activity Logs ── */}
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <div className="skeleton-dark" style={{ width: '100%', height: '4rem', borderRadius: '1rem', marginBottom: '1rem' }} />
                        <div className="skeleton-dark" style={{ width: '100%', height: '4rem', borderRadius: '1rem' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="luxury-card" style={{ padding: '4rem', textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.875rem', fontWeight: 600 }}>No telemetry found for the current parameters.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <AnimatePresence initial={false}>
                            {paginatedData.map((entry, i) => (
                                <motion.div key={entry.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}
                                    style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '1.25rem', border: `1px solid ${entry.delta > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}`, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'white', flex: 1 }}>{entry.team_name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.625rem', fontWeight: 900, color: entry.delta > 0 ? '#10b981' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', background: entry.delta > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '0.25rem 0.625rem', borderRadius: '0.5rem' }}>
                                                {entry.delta > 0 ? 'Merit' : 'Demerit'}
                                            </span>
                                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: entry.delta > 0 ? '#10b981' : '#ef4444' }}>
                                                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', color: entry.reason ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', fontStyle: entry.reason ? 'normal' : 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {entry.reason || 'No specific citation provided'}
                                        </span>
                                        <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{fmt(entry.created_at)}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Pagination Controls */}
                        {filtered.length > 0 && (
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === 1 ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.625rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                                    PREV
                                </button>
                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>
                                    PAGE <span style={{ color: '#C9A84C' }}>{currentPage}</span> / {totalPages}
                                </span>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === totalPages ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.625rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    NEXT
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
