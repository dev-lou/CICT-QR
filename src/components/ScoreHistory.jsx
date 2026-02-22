import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

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
export default function ScoreHistory() {
    const [logs, setLogs] = useState([])
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterTeam, setFilterTeam] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [search, setSearch] = useState('')

    const fetchData = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        const [{ data: logsData }, { data: teamsData }] = await Promise.all([
            supabase.from('score_logs').select('*').order('created_at', { ascending: false }).limit(500),
            supabase.from('teams').select('id, name').order('name'),
        ])
        if (logsData) setLogs(logsData)
        if (teamsData) setTeams(teamsData)
        setLoading(false)
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const filtered = logs.filter((e) => {
        if (filterTeam !== 'all' && e.team_name !== filterTeam) return false
        if (filterType === 'merit' && e.delta <= 0) return false
        if (filterType === 'demerit' && e.delta > 0) return false
        if (search && !e.team_name.toLowerCase().includes(search.toLowerCase()) &&
            !e.reason?.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const totalMerit = filtered.filter(e => e.delta > 0).reduce((s, e) => s + e.delta, 0)
    const totalDemerit = filtered.filter(e => e.delta < 0).reduce((s, e) => s + e.delta, 0)
    const netDelta = totalMerit + totalDemerit

    const handleBack = () => {
        if (window.history.length > 1) window.history.back()
        else window.close()
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>

            {/* ── Header ── */}
            <div style={{
                background: 'white', borderBottom: '1px solid #e2e8f0',
                padding: '0.75rem 1rem',
                position: 'sticky', top: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <button onClick={handleBack}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#f1f5f9', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 0.875rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', color: '#475569', fontFamily: 'inherit', flexShrink: 0 }}>
                    <ArrowLeft /> Back
                </button>
                <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Score Activity Log</h1>
                    <p style={{ margin: 0, fontSize: '0.6875rem', color: '#94a3b8' }}>Merit &amp; demerit history</p>
                </div>
                <button onClick={fetchData}
                    style={{ background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#64748b', fontFamily: 'inherit', flexShrink: 0 }}>
                    Refresh
                </button>
            </div>

            <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '1.25rem 0.875rem' }}>

                {/* ── Summary cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.625rem', marginBottom: '1.25rem' }}>
                    {[
                        { label: 'Merits', value: `+${totalMerit}`, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                        { label: 'Demerits', value: totalDemerit || 0, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                        { label: 'Net', value: netDelta >= 0 ? `+${netDelta}` : netDelta, color: netDelta >= 0 ? '#16a34a' : '#dc2626', bg: 'white', border: '#e2e8f0' },
                    ].map(c => (
                        <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: '0.875rem', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</p>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '1.375rem', fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.625rem', color: '#94a3b8' }}>{filtered.filter(e => c.label === 'Merits' ? e.delta > 0 : c.label === 'Demerits' ? e.delta < 0 : true).length} actions</p>
                        </div>
                    ))}
                </div>

                {/* ── Filters ── */}
                <div style={{ background: 'white', borderRadius: '0.875rem', border: '1px solid #e2e8f0', padding: '0.875rem', marginBottom: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {/* Team + type row */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                            value={filterTeam}
                            onChange={e => setFilterTeam(e.target.value)}
                            style={{ flex: '1 1 130px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', background: '#f8fafc', fontFamily: 'inherit' }}>
                            <option value="all">All Teams</option>
                            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', borderRadius: '0.625rem', padding: '0.2rem', flexShrink: 0 }}>
                            {[['all', 'All'], ['merit', 'Merit'], ['demerit', 'Demerit']].map(([v, l]) => (
                                <button key={v} onClick={() => setFilterType(v)}
                                    style={{ padding: '0.375rem 0.625rem', borderRadius: '0.375rem', border: 'none', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: filterType === v ? 'white' : 'transparent', color: filterType === v ? (v === 'merit' ? '#16a34a' : v === 'demerit' ? '#dc2626' : '#0f172a') : '#64748b', boxShadow: filterType === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Search */}
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search team or reason…"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', fontSize: '0.8125rem', fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>

                {/* ── Log cards (mobile-first) ── */}
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '0.875rem', border: '1px solid #e2e8f0' }}>No actions found</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <AnimatePresence initial={false}>
                            {filtered.map((entry, i) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                    style={{
                                        background: 'white', borderRadius: '0.75rem',
                                        border: `1.5px solid ${entry.delta > 0 ? '#dcfce7' : '#fee2e2'}`,
                                        padding: '0.75rem 1rem',
                                        display: 'flex', flexDirection: 'column', gap: '0.25rem',
                                    }}>
                                    {/* Top row: team + badge + delta */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', flex: 1 }}>{entry.team_name}</span>
                                        <span style={{
                                            padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.6875rem', fontWeight: 700,
                                            background: entry.delta > 0 ? '#dcfce7' : '#fee2e2',
                                            color: entry.delta > 0 ? '#16a34a' : '#dc2626',
                                            border: `1px solid ${entry.delta > 0 ? '#86efac' : '#fca5a5'}`,
                                        }}>
                                            {entry.delta > 0 ? 'Merit' : 'Demerit'}
                                        </span>
                                        <span style={{ fontSize: '1rem', fontWeight: 900, color: entry.delta > 0 ? '#16a34a' : '#dc2626', minWidth: '3rem', textAlign: 'right' }}>
                                            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                        </span>
                                    </div>
                                    {/* Bottom row: reason + time */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: entry.reason ? '#475569' : '#cbd5e1', fontStyle: entry.reason ? 'normal' : 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {entry.reason || 'No reason given'}
                                        </span>
                                        <span style={{ fontSize: '0.6875rem', color: '#94a3b8', flexShrink: 0 }}>{fmt(entry.created_at)}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#cbd5e1', marginTop: '1rem' }}>
                    Showing {filtered.length} of {logs.length} total actions
                </p>
            </div>
        </div>
    )
}
