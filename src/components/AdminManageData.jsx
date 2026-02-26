import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'

export default function AdminManageData({ onLogout, onNavigateScanner, onNavigateAudit, onNavigateTally }) {
    const [activeTab, setActiveTab] = useState('teams') // Default to Teams tab

    const createAuditLog = async (action, targetName, details) => {
        try {
            const sess = localStorage.getItem('admin_session')
            const adminEmail = sess ? JSON.parse(sess).email : 'Admin'
            await supabase.from('audit_logs').insert([{
                admin_email: adminEmail,
                action,
                target_name: targetName,
                details
            }])
        } catch (err) {
            console.error('Failed to create audit log:', err)
        }
    }

    // ─── Teams state
    const [teams, setTeams] = useState([])
    const [newTeamName, setNewTeamName] = useState('')
    const [teamsLoading, setTeamsLoading] = useState(false)
    const [teamError, setTeamError] = useState('')

    // ─── Scores state
    const [scoreLog, setScoreLog] = useState([])
    const [scoreReason, setScoreReason] = useState({})
    const [scoreLoading, setScoreLoading] = useState(false)
    const [submitting, setSubmitting] = useState(new Set())


    // ─── Events state
    const [events, setEvents] = useState([])
    const [newEventName, setNewEventName] = useState('')
    const [eventError, setEventError] = useState('')

    // ─── Data Fetching logic ───
    const fetchScoreLogs = useCallback(async () => {
        if (!supabase) return
        const { data } = await supabase
            .from('score_logs')
            .select('id, team_name, delta, reason, created_at')
            .order('created_at', { ascending: false })
            .limit(20)
        if (data) setScoreLog(data)
    }, [])

    useEffect(() => { fetchScoreLogs() }, [fetchScoreLogs])

    const fetchTeams = useCallback(async () => {
        if (!supabase) return
        setTeamsLoading(true)
        try {
            const [{ data: teamsData }, { data: studentsData }, { data: eventsData }] = await Promise.all([
                supabase.from('teams').select('*').order('name'),
                supabase.from('students').select('id, team_name'),
                supabase.from('events').select('*').order('name')
            ])
            const withCounts = (teamsData || []).map((t) => ({
                ...t,
                member_count: (studentsData || []).filter((s) => s.team_name === t.name).length,
            }))
            setTeams(withCounts)
            setEvents(eventsData || [])
        } finally { setTeamsLoading(false) }
    }, [])

    useEffect(() => { fetchTeams() }, [fetchTeams])

    const addTeam = async () => {
        if (!newTeamName.trim() || !supabase) return
        setTeamError('')
        try {
            const { error } = await supabase.from('teams').insert([{ name: newTeamName.trim() }])
            if (error) throw error
            setNewTeamName('')
            await fetchTeams()
        } catch (err) { setTeamError(err.message || 'Failed to add team.') }
    }

    const deleteTeam = async (id) => {
        if (!supabase || !confirm('Delete this team?')) return
        try {
            const { error } = await supabase.from('teams').delete().eq('id', id)
            if (error) throw error
            await fetchTeams()
        } catch (err) { alert(err.message || 'Failed to delete team.') }
    }


    const addEvent = async () => {
        if (!newEventName.trim() || !supabase) return
        setEventError('')
        try {
            const { error } = await supabase.from('events').insert([{
                name: newEventName.trim(),
                category: 'GENERAL'
            }])
            if (error) throw error
            setNewEventName('')
            await fetchTeams() // Re-fetches events too
        } catch (err) { setEventError(err.message || 'Failed to add event.') }
    }

    const deleteEvent = async (id) => {
        if (!supabase || !confirm('Delete this event?')) return
        try {
            const { error } = await supabase.from('events').delete().eq('id', id)
            if (error) throw error
            await fetchTeams()
        } catch (err) { alert(err.message || 'Failed to delete event.') }
    }


    // Helpers
    const TZ = 'Asia/Manila'
    const fmtDate = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: TZ })
    }

    // Burger Menu State
    const [menuOpen, setMenuOpen] = useState(false)

    // Filtered users for the Users Tab
    const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(newTeamName.toLowerCase())) // Actually we don't have separate search for teams yet, using newTeamName as placeholder or just filter by something

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>

            {/* Header with Burger Menu */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                        <div style={{ width: '2rem', height: '2rem', minWidth: '2rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>Manage Data</p>
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>IT Week Admin</p>
                        </div>
                    </div>

                    {/* Burger Menu Button & Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            style={{
                                padding: '0.5rem', borderRadius: '0.5rem', background: menuOpen ? '#f1f5f9' : 'transparent',
                                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'background 0.2s'
                            }}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        <AnimatePresence>
                            {menuOpen && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                        onClick={() => setMenuOpen(false)}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        style={{
                                            position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)',
                                            background: 'white', borderRadius: '0.75rem', padding: '0.5rem',
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                            border: '1px solid #e2e8f0', minWidth: '180px', zIndex: 50
                                        }}
                                    >
                                        <button onClick={() => { setMenuOpen(false); onNavigateScanner() }}
                                            style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                            Scanner & Logs
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); }}
                                            style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: '#f8fafc', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                            Manage Data
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateAudit && onNavigateAudit(); }}
                                            style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Audit & Users
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateTally && onNavigateTally(); }}
                                            style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                            Point Tally
                                        </button>
                                        <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }} />
                                        <button onClick={() => { setMenuOpen(false); onLogout() }}
                                            style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                            Logout
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Tab Nav Container */}
            <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 1rem 0', display: 'flex', justifyContent: 'center' }}>
                <div className="tab-nav">
                    {[
                        {
                            id: 'teams', label: 'Teams',
                            icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                        },
                        {
                            id: 'scores', label: 'Scores',
                            icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="8 6 12 2 16 6" /><line x1="12" y1="2" x2="12" y2="15" /><path d="M20 15H4a2 2 0 000 4h16a2 2 0 000-4z" /></svg>
                        },
                        {
                            id: 'events', label: 'Events',
                            icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4M8 7H6a1 1 0 00-1 1v11a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1h-2M8 7V5h8v2M8 7h8" /></svg>
                        },
                    ].map((tab) => (
                        <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            {tab.icon}{tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 1rem 2.5rem' }}>
                <AnimatePresence mode="wait">

                    {/* ── TEAMS TAB ───────────────────────────────────────── */}
                    {activeTab === 'teams' && (
                        <motion.div key="teams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', marginBottom: '1rem' }}>Add New Team</p>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input className="input" type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name…" onKeyDown={(e) => e.key === 'Enter' && addTeam()} style={{ flex: 1 }} />
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={addTeam} disabled={!newTeamName.trim()}
                                        style={{ padding: '0.875rem 1.5rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg,#7B1C1C,#C9A84C)', color: 'white', fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: newTeamName.trim() ? 1 : 0.4 }}>
                                        Add
                                    </motion.button>
                                </div>
                                {teamError && <p style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.625rem' }}>{teamError}</p>}
                            </div>

                            <div className="card" style={{ padding: '1.5rem' }}>
                                <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                                    Teams <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.875rem' }}>({teams.length})</span>
                                </p>
                                {teamsLoading ? (
                                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>Loading…</p>
                                ) : teams.length === 0 ? (
                                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>No teams yet. Add your first team above.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {teams.map((team) => (
                                            <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#7B1C1C,#C9A84C)', flexShrink: 0 }} />
                                                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9375rem' }}>{team.name}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#f1f5f9', borderRadius: '99px', padding: '0.125rem 0.5rem', fontWeight: 500 }}>
                                                        {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                                                    </span>
                                                </div>
                                                <button onClick={() => deleteTeam(team.id)}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1' }}
                                                    style={{ padding: '0.375rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#cbd5e1', transition: 'all 0.15s' }}>
                                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── SCORES TAB ──────────────────────────────────────────── */}
                    {activeTab === 'scores' && (
                        <motion.div key="scores" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            <div className="card" style={{ padding: '1rem 1.25rem', background: '#eef2ff', border: '1.5px solid #c7d2fe' }}>
                                <p style={{ fontSize: '0.8125rem', color: '#4f46e5', fontWeight: 600 }}>
                                    Teams start at <strong>150 pts</strong>. Type any points in the field, then click <strong>+ Merit</strong> to add or <strong>− Demerit</strong> to subtract (min 0).
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => window.open('/scoreboard-itweek2026', '_blank')}
                                    style={{ marginTop: '0.75rem', width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg,#7B1C1C,#C9A84C)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Open Scoreboard (Full Screen)
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => window.open('/score-history', '_blank')}
                                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.625rem', borderRadius: '0.75rem', background: 'white', border: '1.5px solid #c7d2fe', color: '#4f46e5', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    View Full Score History
                                </motion.button>
                            </div>

                            {scoreLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#7B1C1C', borderRadius: '50%' }} />
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                                    {[...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((team, idx) => {
                                        const score = team.score ?? 150
                                        const pts = parseInt(scoreReason[team.id + '_pts'] || '10', 10) || 10

                                        const applyScore = async (delta) => {
                                            if (!supabase || submitting.has(team.id)) return

                                            const reasonType = scoreReason[team.id + '_type'] || 'event'
                                            const selectedEvent = scoreReason[team.id + '_event'] || ''
                                            const manualReason = scoreReason[team.id] || ''
                                            const reason = reasonType === 'event' ? selectedEvent : manualReason

                                            if (!reason) {
                                                Swal.fire({ icon: 'warning', title: 'Missing Reason', text: `Please ${reasonType === 'event' ? 'select an event' : 'enter a reason'} before applying points.`, timer: 2000 })
                                                return
                                            }

                                            setSubmitting(prev => new Set(prev).add(team.id))
                                            try {
                                                const newScore = Math.max(0, score + delta)

                                                const { error: updateErr } = await supabase.from('teams').update({ score: newScore }).eq('id', team.id)
                                                if (updateErr) throw updateErr

                                                const { error: logErr } = await supabase.from('score_logs').insert({ team_id: team.id, team_name: team.name, delta, reason })
                                                if (logErr) throw logErr

                                                setScoreReason(prev => ({ ...prev, [team.id]: '', [team.id + '_pts']: '', [team.id + '_event']: '' }))
                                                await Promise.all([fetchTeams(), fetchScoreLogs()])

                                                const isMerit = delta > 0
                                                Swal.fire({
                                                    toast: true, position: 'top-end', icon: isMerit ? 'success' : 'error',
                                                    title: `${isMerit ? 'Merit' : 'Demerit'} applied!`,
                                                    html: `<strong>${team.name}</strong> &nbsp;<span style="color:${isMerit ? '#16a34a' : '#dc2626'};font-weight:700">${isMerit ? '+' : ''}${delta} pts</span>${reason ? `<br><span style="font-size:0.8em;color:#64748b">${reason}</span>` : ''}`,
                                                    showConfirmButton: false, timer: 3000, timerProgressBar: true,
                                                })
                                            } catch (err) {
                                                console.error('Score apply error:', err)
                                                Swal.fire({ icon: 'error', title: 'Action Failed', text: err.message || 'Failed to update score.' })
                                            } finally {
                                                setSubmitting(prev => { const s = new Set(prev); s.delete(team.id); return s })
                                            }
                                        }

                                        const isBusy = submitting.has(team.id)

                                        return (
                                            <div key={team.id} style={{
                                                background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem',
                                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden'
                                            }}>
                                                {idx === 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <span style={{
                                                                background: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#ffedd5' : '#f8fafc',
                                                                color: idx === 0 ? '#d97706' : idx === 1 ? '#64748b' : idx === 2 ? '#c2410c' : '#94a3b8',
                                                                fontSize: '0.6875rem', fontWeight: 800, padding: '0.125rem 0.5rem', borderRadius: '99px'
                                                            }}>
                                                                {idx === 0 ? '1ST PLACE' : idx === 1 ? '2ND PLACE' : idx === 2 ? '3RD PLACE' : `RANK ${idx + 1}`}
                                                            </span>
                                                        </div>
                                                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>{team.name}</h3>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontSize: '2rem', fontWeight: 900, color: '#7B1C1C', lineHeight: 1, letterSpacing: '-0.03em' }}>{score}</span>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginLeft: '0.25rem', textTransform: 'uppercase' }}>pts</span>
                                                    </div>
                                                </div>

                                                <div style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '0.875rem', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                        <select
                                                            value={scoreReason[team.id + '_type'] || 'event'}
                                                            onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id + '_type']: e.target.value }))}
                                                            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, background: '#fff', color: '#475569', cursor: 'pointer', outline: 'none' }}
                                                        >
                                                            <option value="event">By Event</option>
                                                            <option value="manual">Manual Reason</option>
                                                        </select>

                                                        <input
                                                            type="number" min="1"
                                                            value={scoreReason[team.id + '_pts'] || ''}
                                                            onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id + '_pts']: e.target.value }))}
                                                            placeholder="10"
                                                            style={{
                                                                width: '64px', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9375rem', fontWeight: 700, textAlign: 'center', outline: 'none'
                                                            }}
                                                        />
                                                    </div>

                                                    <div style={{ marginBottom: '0.875rem' }}>
                                                        {(scoreReason[team.id + '_type'] || 'event') === 'event' ? (
                                                            <select
                                                                value={scoreReason[team.id + '_event'] || ''}
                                                                onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id + '_event']: e.target.value }))}
                                                                style={{
                                                                    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', appearance: 'none', background: 'white', cursor: 'pointer'
                                                                }}
                                                            >
                                                                <option value="">Select Event...</option>
                                                                {events.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={scoreReason[team.id] || ''}
                                                                onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id]: e.target.value }))}
                                                                placeholder="📝 Type manual reason..."
                                                                style={{
                                                                    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box'
                                                                }}
                                                            />
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                        <motion.button
                                                            whileHover={{ scale: isBusy ? 1 : 1.02 }} whileTap={{ scale: isBusy ? 1 : 0.98 }}
                                                            onClick={() => applyScore(+pts)} disabled={isBusy}
                                                            style={{
                                                                padding: '0.625rem', borderRadius: '0.5rem',
                                                                background: 'linear-gradient(180deg, #22c55e, #16a34a)', color: 'white', border: 'none',
                                                                fontWeight: 700, fontSize: '0.875rem', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                                                                boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
                                                            }}>
                                                            + Add Merit
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: isBusy ? 1 : 1.02 }} whileTap={{ scale: isBusy ? 1 : 0.98 }}
                                                            onClick={() => applyScore(-pts)} disabled={isBusy}
                                                            style={{
                                                                padding: '0.625rem', borderRadius: '0.5rem',
                                                                background: 'white', color: '#dc2626', border: '1.5px solid #fca5a5',
                                                                fontWeight: 700, fontSize: '0.875rem', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                                                            }}>
                                                            - Minus
                                                        </motion.button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {scoreLog.length > 0 && (
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>Recent Actions</p>
                                        <button
                                            onClick={async () => { await supabase.from('score_logs').delete().neq('id', 0); fetchScoreLogs() }}
                                            style={{ fontSize: '0.6875rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
                                            Clear log
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        {scoreLog.slice(0, 20).map((entry, i) => (
                                            <div key={entry.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: entry.delta > 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1e293b', flex: 1 }}>{entry.team_name ?? entry.teamName}</span>
                                                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: entry.delta > 0 ? '#16a34a' : '#dc2626' }}>{entry.delta > 0 ? `+${entry.delta}` : `${entry.delta}`}</span>
                                                {entry.reason && <span style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.reason}</span>}
                                                <span style={{ fontSize: '0.6875rem', color: '#cbd5e1', flexShrink: 0 }}>
                                                    {new Date(entry.created_at ?? entry.ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}


                    {/* ── EVENTS TAB ──────────────────────────────────────────── */}
                    {activeTab === 'events' && (
                        <motion.div key="events" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Add New Event</p>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input type="text" placeholder="Event Name (e.g. Poster Making)" value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e2e8f0', outline: 'none' }} />
                                    <button onClick={addEvent} className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>Add Event</button>
                                </div>
                                {eventError && <p style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>{eventError}</p>}
                            </div>

                            <div className="card" style={{ padding: '1.25rem', flex: 1 }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
                                    Existing Events <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.875rem' }}>({events.length})</span>
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {events.map((e) => (
                                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#7B1C1C,#C9A84C)', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9375rem' }}>{e.name}</span>
                                            </div>
                                            <button onClick={() => deleteEvent(e.id)} style={{ padding: '0.375rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
