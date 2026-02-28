import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import CustomDropdown from './CustomDropdown'

export default function AdminManageData({ onLogout, onNavigateScanner, onNavigateAudit, onNavigateTally, onNavigateHistory }) {
    const navigate = useNavigate()
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
    const [scorePage, setScorePage] = useState(1)
    const scorePageSize = 10



    // ─── Events state
    const [events, setEvents] = useState([])
    const [newEventName, setNewEventName] = useState('')
    const [eventError, setEventError] = useState('')
    const [menuOpen, setMenuOpen] = useState(false)

    // ─── Data Fetching logic ───
    const fetchScoreLogs = useCallback(async () => {
        if (!supabase) return
        const { data } = await supabase
            .from('score_logs')
            .select('id, team_name, delta, reason, created_at')
            .order('created_at', { ascending: false })
            .limit(200) // Increased limit for better pagination depth
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
            const { error } = await supabase.from('teams').insert([{ name: newTeamName.trim(), score: 150 }])
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

    const initializeScores = async () => {
        const result = await Swal.fire({
            title: 'Initialize All Scores?',
            text: 'This will set the point total of ALL teams to 150. Use this to catch up existing 0-point teams to the 2026 standard.',
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#C9A84C',
            confirmButtonText: 'Yes, initialize all',
            background: '#1e293b',
            color: '#fff'
        })
        if (result.isConfirmed) {
            const { error } = await supabase.from('teams').update({ score: 150 }).neq('id', 0)
            if (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message,
                    background: '#1e293b',
                    color: '#fff'
                })
            } else {
                await fetchTeams()
                Swal.fire({
                    icon: 'success',
                    title: 'Initialized!',
                    text: 'All teams have been set to 150 base points.',
                    background: '#1e293b',
                    color: '#fff'
                })
            }
        }
    }

    const recalculateTotals = async () => {
        const result = await Swal.fire({
            title: 'Recalculate All Totals?',
            text: 'This will sync the Point Standings by calculating: 150 + sum(all logs) for every team. Use this if your scoreboard is out of sync.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#C9A84C',
            confirmButtonText: 'Yes, Recalculate',
            background: '#1e293b',
            color: '#fff'
        })
        if (!result.isConfirmed) return

        Swal.fire({
            title: 'Processing...',
            text: 'Synchronizing central ledger...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            background: '#1e293b',
            color: '#fff'
        })

        try {
            const { data: logs } = await supabase.from('score_logs').select('team_name, delta')
            const { data: teamsList } = await supabase.from('teams').select('id, name')

            const updates = teamsList.map(async (team) => {
                const teamLogs = (logs || []).filter(l => l.team_name === team.name)
                const logSum = teamLogs.reduce((sum, l) => sum + Number(l.delta), 0)
                const finalScore = 150 + logSum
                return supabase.from('teams').update({ score: finalScore }).eq('id', team.id)
            })

            await Promise.all(updates)
            await fetchTeams()

            Swal.fire({
                icon: 'success',
                title: 'Sync Complete',
                text: 'All team scores have been recalculated from the logs.',
                background: '#1e293b',
                color: '#fff'
            })
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Sync Failed',
                text: err.message,
                background: '#1e293b',
                color: '#fff'
            })
        }
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

    const deleteScoreLog = async (log) => {
        const result = await Swal.fire({
            title: 'Delete this score?',
            text: `Permanently remove ${log.delta} pts from ${log.team_name}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, delete it',
            background: '#1e293b',
            color: '#fff'
        })

        if (result.isConfirmed) {
            try {
                // 1. Get current team score
                const { data: team } = await supabase.from('teams').select('id, score').eq('name', log.team_name).single()

                if (team) {
                    // 2. Update team score (subtract the delta we're deleting)
                    const newScore = Math.max(0, (team.score || 150) - log.delta)
                    await supabase.from('teams').update({ score: newScore }).eq('id', team.id)
                }

                // 3. Delete the log
                const { error } = await supabase.from('score_logs').delete().eq('id', log.id)
                if (error) throw error

                await createAuditLog('DELETE_SCORE', log.team_name, `Deleted ${log.delta} pts record: ${log.reason}`)

                await Promise.all([fetchTeams(), fetchScoreLogs()])

                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Score removed and standings updated.',
                    background: '#1e293b',
                    color: '#fff',
                    timer: 2000,
                    showConfirmButton: false
                })
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1e293b', color: '#fff' })
            }
        }
    }


    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .luxury-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; }
                .tab-nav-luxury { display: flex; background: rgba(0,0,0,0.3); padding: 0.375rem; border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.05); gap: 0.5rem; overflow-x: auto; scrollbar-width: none; }
                .tab-btn-luxury { padding: 0.625rem 1.25rem; border-radius: 0.875rem; border: none; background: transparent; color: rgba(255,255,255,0.4); font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
                .tab-btn-luxury.active { background: rgba(201,168,76,0.1); color: #C9A84C; border: 1px solid rgba(201,168,76,0.25); box-shadow: 0 4px 15px rgba(201,168,76,0.1); }
                .luxury-input { width: 100%; padding: 0.875rem 1.125rem; border-radius: 1rem; border: 1.5px solid rgba(255,255,255,0.12); background: rgba(15, 23, 42, 0.6); color: white; outline: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .luxury-input::placeholder { color: rgba(255, 255, 255, 0.5); }
                .luxury-input:focus { border-color: #C9A84C; background: rgba(201,168,76,0.1); box-shadow: 0 0 20px rgba(201,168,76,0.15); }
            `}</style>

            {/* Premium Header */}
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(123,28,28,0.3)' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, margin: 0 }}>MANAGE TEAMS & SCORES</p>
                            <p style={{ fontSize: '0.625rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.125rem 0 0' }}>Update Records & Event Points</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
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
                                            <button onClick={() => { setMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'rgba(201,168,76,0.1)', fontSize: '0.8125rem', fontWeight: 700, color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                Manage Teams & Scores
                                            </button>
                                            <button onClick={() => { setMenuOpen(false); onNavigateAudit && onNavigateAudit(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Personnel & Audit Logs
                                            </button>
                                            <button onClick={() => { setMenuOpen(false); onNavigateTally && onNavigateTally(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
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
                    </div>
                </div>
            </div>

            {/* Tab Nav Container */}
            <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem 0', display: 'flex', justifyContent: 'center' }}>
                <div className="tab-nav-luxury">
                    {[
                        { id: 'teams', label: 'Teams', icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
                        { id: 'scores', label: 'Scores', icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> },
                        { id: 'events', label: 'Events', icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
                    ].map((tab) => (
                        <button key={tab.id} className={`tab-btn-luxury ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
                <AnimatePresence mode="wait">

                    {/* ── TEAMS TAB ───────────────────────────────────────── */}
                    {activeTab === 'teams' && (
                        <motion.div key="teams" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            <div className="luxury-card" style={{ padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '4px', height: '1.25rem', background: '#C9A84C', borderRadius: '2px' }} />
                                    ADD NEW TEAM
                                </h3>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <input
                                        className="luxury-input"
                                        type="text"
                                        value={newTeamName}
                                        onChange={(e) => setNewTeamName(e.target.value)}
                                        placeholder="Enter team name..."
                                        onKeyDown={(e) => e.key === 'Enter' && addTeam()}
                                        style={{ flex: 1, padding: '1rem 1.25rem' }}
                                    />
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={addTeam}
                                        disabled={!newTeamName.trim()}
                                        style={{
                                            padding: '0 2rem',
                                            borderRadius: '1rem',
                                            background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)',
                                            color: 'white',
                                            fontWeight: 900,
                                            fontSize: '0.875rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            opacity: newTeamName.trim() ? 1 : 0.3
                                        }}
                                    >
                                        Add Team
                                    </motion.button>
                                </div>
                                {teamError && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '1rem', fontWeight: 600 }}>{teamError}</p>}
                            </div>

                            <div className="luxury-card">
                                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ fontWeight: 800, color: '#C9A84C', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                        ACTIVE TEAMS ({teams.length})
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button onClick={recalculateTotals} style={{ fontSize: '0.625rem', fontWeight: 800, color: '#C9A84C', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', cursor: 'pointer', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', textTransform: 'uppercase' }}>
                                            Recalculate Totals
                                        </button>
                                        <button onClick={initializeScores} style={{ fontSize: '0.625rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', textTransform: 'uppercase' }}>
                                            Reset to 150
                                        </button>
                                    </div>
                                </div>
                                {teamsLoading ? (
                                    <div style={{ padding: '4rem 0', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-dark" style={{ width: '12rem', height: '4rem', borderRadius: '1rem' }} />)}
                                    </div>
                                ) : teams.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1rem', fontWeight: 600 }}>No teams detected in sector.</p>
                                    </div>
                                ) : (
                                    <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                        {teams.map((team) => (
                                            <motion.div
                                                layout
                                                key={team.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '1.25rem',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: '1.25rem',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                whileHover={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.03)' }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.875rem', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontWeight: 900 }}>
                                                        {team.name[0]}
                                                    </div>
                                                    <div>
                                                        <span style={{ fontWeight: 700, color: 'white', fontSize: '1rem', display: 'block' }}>{team.name}</span>
                                                        <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                            {team.member_count} {team.member_count === 1 ? 'MEMBER' : 'MEMBERS'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteTeam(team.id)}
                                                    style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent' }}
                                                >
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── SCORES TAB ──────────────────────────────────────────── */}
                    {activeTab === 'scores' && (
                        <motion.div key="scores" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            <div className="luxury-card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
                                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <p style={{ fontSize: '0.8125rem', color: '#C9A84C', fontWeight: 600, margin: 0 }}>
                                            Master Scoreboard Control: Merit adds points while Demerit subtracts. Teams initialized at 150 points.
                                        </p>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => window.open('/scoreboard-itweek2026', '_blank')}
                                        style={{ padding: '0.625rem 1.25rem', borderRadius: '0.875rem', background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                                    >
                                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        VIEW LIVE IT WEEK SCOREBOARD
                                    </motion.button>
                                </div>
                            </div>

                            {scoreLoading ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="luxury-card" style={{ padding: '1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                                <div className="skeleton-dark" style={{ width: '8rem', height: '1.25rem', borderRadius: '0.5rem' }} />
                                                <div className="skeleton-gold" style={{ width: '4rem', height: '2rem', borderRadius: '0.5rem' }} />
                                            </div>
                                            <div className="skeleton-dark" style={{ width: '100%', height: '8rem', borderRadius: '1rem' }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
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
                                                Swal.fire({
                                                    icon: 'warning',
                                                    title: 'Protocol Violation',
                                                    text: `Please ${reasonType === 'event' ? 'select an event' : 'enter a valid reason'} before finalizing points.`,
                                                    background: '#1e293b',
                                                    color: '#fff',
                                                    confirmButtonColor: '#7B1C1C'
                                                })
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
                                                    title: `${isMerit ? 'Merit' : 'Demerit'} Documented`,
                                                    background: '#0f172a',
                                                    color: '#fff',
                                                    html: `<span style="color:#C9A84C;font-weight:900">${team.name}</span>: <span style="color:${isMerit ? '#10b981' : '#ef4444'}">${isMerit ? '+' : ''}${delta} PTS</span>`,
                                                    showConfirmButton: false, timer: 3000, timerProgressBar: true,
                                                })
                                            } catch (err) {
                                                console.error('Score apply error:', err)
                                                Swal.fire({ icon: 'error', title: 'System Error', text: err.message || 'Failed to update central ledger.', background: '#1e293b', color: '#fff' })
                                            } finally {
                                                setSubmitting(prev => { const s = new Set(prev); s.delete(team.id); return s })
                                            }
                                        }

                                        const isBusy = submitting.has(team.id)

                                        return (
                                            <div key={team.id} className="luxury-card" style={{ position: 'relative', zIndex: teams.length - idx, overflow: 'visible' }}>
                                                {idx === 0 && <div className="holographic-gold" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px' }} />}

                                                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                            <span style={{
                                                                background: idx === 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)',
                                                                color: idx === 0 ? '#C9A84C' : 'rgba(255,255,255,0.5)',
                                                                fontSize: '0.625rem', fontWeight: 900, padding: '0.25rem 0.625rem', borderRadius: '0.5rem', letterSpacing: '0.05em'
                                                            }}>
                                                                {idx === 0 ? '🏆 CHAMPION' : `RANK 0${idx + 1}`}
                                                            </span>
                                                        </div>
                                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>{team.name}</h3>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#C9A84C', lineHeight: 1, letterSpacing: '-0.02em' }}>{score}</span>
                                                        <span style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', display: 'block' }}>TOTAL SCORE</span>
                                                    </div>
                                                </div>

                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.03)', overflow: 'visible' }}>
                                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                                        <CustomDropdown
                                                            dark
                                                            value={scoreReason[team.id + '_type'] || 'event'}
                                                            options={[
                                                                { name: 'Official Event', id: 'event' },
                                                                { name: 'Manual Entry', id: 'manual' }
                                                            ]}
                                                            onChange={(val) => {
                                                                const id = val === 'Official Event' ? 'event' : 'manual'
                                                                setScoreReason(prev => ({ ...prev, [team.id + '_type']: id }))
                                                            }}
                                                        />

                                                        <input
                                                            type="number" min="1"
                                                            value={scoreReason[team.id + '_pts'] || ''}
                                                            onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id + '_pts']: e.target.value }))}
                                                            placeholder="10"
                                                            className="luxury-input"
                                                            style={{ width: '80px', textAlign: 'center', padding: '0.625rem' }}
                                                        />
                                                    </div>

                                                    <div style={{ marginBottom: '1.25rem' }}>
                                                        {(scoreReason[team.id + '_type'] || 'event') === 'event' ? (
                                                            <CustomDropdown
                                                                dark
                                                                placeholder="Select Target Event..."
                                                                value={scoreReason[team.id + '_event'] || ''}
                                                                options={events.map(e => ({ name: e.name, id: e.id }))}
                                                                onChange={(val) => setScoreReason(prev => ({ ...prev, [team.id + '_event']: val }))}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={scoreReason[team.id] || ''}
                                                                onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id]: e.target.value }))}
                                                                placeholder="Reason for adjustment..."
                                                                className="luxury-input"
                                                                style={{ fontSize: '0.875rem' }}
                                                            />
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                        <motion.button
                                                            whileHover={{ scale: isBusy ? 1 : 1.03 }} whileTap={{ scale: isBusy ? 1 : 0.97 }}
                                                            onClick={() => applyScore(+pts)} disabled={isBusy}
                                                            style={{ padding: '0.875rem', borderRadius: '0.875rem', background: '#10b981', color: 'white', border: 'none', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', opacity: isBusy ? 0.4 : 1 }}
                                                        >
                                                            Merit
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: isBusy ? 1 : 1.03 }} whileTap={{ scale: isBusy ? 1 : 0.97 }}
                                                            onClick={() => applyScore(-pts)} disabled={isBusy}
                                                            style={{ padding: '0.875rem', borderRadius: '0.875rem', background: 'transparent', color: '#ef4444', border: '1.5px solid rgba(239,68,68,0.3)', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', opacity: isBusy ? 0.4 : 1 }}
                                                        >
                                                            Demerit
                                                        </motion.button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {scoreLog.length > 0 && (
                                <div className="luxury-card" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>RECENT ACTIVITY</h4>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {scoreLog.slice((scorePage - 1) * scorePageSize, scorePage * scorePageSize).map((entry, i) => (
                                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                                key={entry.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{
                                                    width: '8px', height: '8px', borderRadius: '50%', background: entry.delta > 0 ? '#10b981' : '#ef4444', flexShrink: 0,
                                                    boxShadow: `0 0 10px ${entry.delta > 0 ? '#10b981' : '#ef4444'}`
                                                }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontWeight: 800, fontSize: '0.875rem', color: 'white', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.team_name}</p>
                                                    <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.reason}</p>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <p style={{ fontWeight: 900, fontSize: '1rem', color: entry.delta > 0 ? '#10b981' : '#ef4444', margin: 0 }}>
                                                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                                    </p>
                                                    <button onClick={() => deleteScoreLog(entry)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', padding: '0.25rem', transition: 'all 0.2s' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderRadius = '0.375rem'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'transparent'; }}>
                                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}

                                        {/* Pagination Controls */}
                                        {scoreLog.length > 0 && (
                                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                                <button
                                                    disabled={scorePage === 1}
                                                    onClick={() => setScorePage(prev => Math.max(1, prev - 1))}
                                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: scorePage === 1 ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.6875rem', fontWeight: 800, cursor: scorePage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                >
                                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                                                    PREV
                                                </button>
                                                <span style={{ fontSize: '0.6875rem', fontWeight: 900, color: 'white', letterSpacing: '0.05em' }}>
                                                    {scorePage} / {Math.ceil(scoreLog.length / scorePageSize)}
                                                </span>
                                                <button
                                                    disabled={scorePage === Math.ceil(scoreLog.length / scorePageSize)}
                                                    onClick={() => setScorePage(prev => Math.min(Math.ceil(scoreLog.length / scorePageSize), prev + 1))}
                                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: scorePage === Math.ceil(scoreLog.length / scorePageSize) ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.6875rem', fontWeight: 800, cursor: scorePage === Math.ceil(scoreLog.length / scorePageSize) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                >
                                                    NEXT
                                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}


                    {/* ── EVENTS TAB ──────────────────────────────────────────── */}
                    {activeTab === 'events' && (
                        <motion.div key="events" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="luxury-card" style={{ padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '4px', height: '1.25rem', background: '#C9A84C', borderRadius: '2px' }} />
                                    EVENT COMMISSIONING
                                </h3>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <input type="text" placeholder="Designate competition name..." value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
                                        className="luxury-input" style={{ flex: 1 }} />
                                    <motion.button
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={addEvent}
                                        style={{ padding: '0 2rem', borderRadius: '1rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', color: 'white', fontWeight: 900, fontSize: '0.875rem', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                    >
                                        Establish
                                    </motion.button>
                                </div>
                                {eventError && <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, marginTop: '1rem' }}>{eventError}</p>}
                            </div>

                            <div className="luxury-card">
                                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                                    <p style={{ fontWeight: 800, color: '#C9A84C', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                        ACTIVE COMPETITIONS ({events.length})
                                    </p>
                                </div>
                                <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                                    {events.map((e) => (
                                        <motion.div key={e.id} layout style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.875rem', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C' }}>
                                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m1 1v11a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                                                </div>
                                                <span style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{e.name}</span>
                                            </div>
                                            <button onClick={() => deleteEvent(e.id)} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                                                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent' }}
                                            >
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </motion.div>
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
