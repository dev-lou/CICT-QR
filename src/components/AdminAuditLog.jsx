import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import CustomDropdown from './CustomDropdown'

export default function AdminAuditLog({ onLogout, onNavigateScanner, onNavigateManageData, onNavigateTally, onNavigateHistory }) {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('logs') // 'logs', 'users', 'demographics'
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all') // 'all', 'UPDATE_USER', 'DELETE_USER', 'SELF_EDIT'
    const [menuOpen, setMenuOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const logPageSize = 10

    // ─── User Management State (Migrated)
    const [users, setUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [userSearch, setUserSearch] = useState('')
    const [editingUser, setEditingUser] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [showMoreRolesEdit, setShowMoreRolesEdit] = useState(false)
    const [teams, setTeams] = useState([])
    const [userPage, setUserPage] = useState(1)
    const userPageSize = 10

    const fetchLogs = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        try {
            let query = supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })

            if (filter !== 'all') {
                query = query.eq('action', filter)
            }

            const { data, error } = await query
            if (error) {
                if (error.code === '42P01') {
                    setLogs([])
                    return
                }
                throw error
            }
            setLogs(data || [])
        } catch (err) {
            console.error('Failed to load audit logs:', err)
        } finally {
            setLoading(false)
        }
    }, [filter])

    const fetchUsersAndTeams = useCallback(async () => {
        if (!supabase) return
        setUsersLoading(true)
        try {
            const [{ data: usersData }, { data: teamsData }] = await Promise.all([
                supabase.from('students').select('*').order('full_name'),
                supabase.from('teams').select('*').order('name')
            ])
            setUsers(usersData || [])
            setTeams(teamsData || [])
        } catch (err) {
            console.error('Failed to fetch data:', err)
        } finally {
            setUsersLoading(false)
        }
    }, [])

    useEffect(() => {
        if (activeTab === 'logs') fetchLogs()
        else fetchUsersAndTeams()
    }, [activeTab, fetchLogs, fetchUsersAndTeams])

    useEffect(() => { setCurrentPage(1) }, [search, filter, activeTab])
    useEffect(() => { setUserPage(1) }, [userSearch, activeTab])

    // ─── Audit Log Helpers
    const createAuditLog = async (action, targetName, details) => {
        try {
            const sess = localStorage.getItem('admin_session')
            const adminEmail = sess ? JSON.parse(sess).email : 'Admin'
            await supabase.from('audit_logs').insert([{ admin_email: adminEmail, action, target_name: targetName, details }])
        } catch (err) { console.error('Audit log failed:', err) }
    }

    // ─── User Actions (Migrated)
    const deleteUser = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete User?',
            text: `Are you sure you want to delete ${name}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, delete it'
        })
        if (!result.isConfirmed || !supabase) return

        try {
            const { error } = await supabase.from('students').delete().eq('id', id)
            if (error) throw error
            await createAuditLog('DELETE_USER', name, { id })
            Swal.fire('Deleted!', 'User has been removed.', 'success')
            fetchUsersAndTeams()
        } catch (err) { Swal.fire('Error', err.message, 'error') }
    }

    const startEditUser = (user) => {
        setEditingUser(user.id)
        setEditForm({ ...user })
    }

    const saveEditUser = async (id) => {
        if (!supabase) return
        const oldData = users.find(u => u.id === id)
        try {
            const { error } = await supabase.from('students').update({
                full_name: editForm.full_name,
                role: editForm.role,
                team_name: editForm.team_name
            }).eq('id', id)
            if (error) throw error

            const changes = {}
            if (oldData.full_name !== editForm.full_name) changes.full_name = { old: oldData.full_name, new: editForm.full_name }
            if (oldData.role !== editForm.role) changes.role = { old: oldData.role, new: editForm.role }
            if (oldData.team_name !== editForm.team_name) changes.team_name = { old: oldData.team_name, new: editForm.team_name }

            if (Object.keys(changes).length > 0) {
                await createAuditLog('UPDATE_USER', editForm.full_name, changes)
            }

            setEditingUser(null)
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'User updated', showConfirmButton: false, timer: 2000 })
            fetchUsersAndTeams()
        } catch (err) { Swal.fire('Error', err.message, 'error') }
    }

    const filteredLogs = logs.filter(log =>
    (log.target_name?.toLowerCase().includes(search.toLowerCase()) ||
        log.admin_email?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase()))
    )

    const logTotalPages = Math.ceil(filteredLogs.length / logPageSize)
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * logPageSize, currentPage * logPageSize)

    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.team_name?.toLowerCase().includes(userSearch.toLowerCase())
    )

    const userTotalPages = Math.ceil(filteredUsers.length / userPageSize)
    const paginatedUsers = filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize)

    // ─── Demographics Calculations
    const teamStats = teams.map(t => {
        const count = users.filter(u => u.team_name === t.name).length
        return { name: t.name, count }
    }).sort((a, b) => b.count - a.count)
    const maxTeamCount = Math.max(...teamStats.map(t => t.count), 1)

    const execCount = users.filter(u => u.role === 'executive').length
    const officerCount = users.filter(u => u.role === 'officer').length
    const maxRoleCount = Math.max(execCount, officerCount, 1)

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : ''

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
                .tab-nav-luxury { display: flex; background: rgba(0,0,0,0.3); padding: 0.25rem; border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.05); gap: 0.25rem; justify-content: center; width: 100%; }
                .tab-btn-luxury { flex: 1; padding: 0.5rem 0.25rem; border-radius: 1rem; border: none; background: transparent; color: rgba(255,255,255,0.4); font-weight: 800; font-size: 0.625rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; align-items: center; gap: 0.25rem; text-align: center; line-height: 1.1; min-width: 0; }
                @media (min-width: 640px) {
                    .tab-btn-luxury { flex-direction: row; padding: 0.625rem 1.25rem; font-size: 0.875rem; gap: 0.5rem; }
                    .tab-nav-luxury { gap: 0.5rem; padding: 0.375rem; width: auto; }
                }
                .tab-btn-luxury.active { background: rgba(201,168,76,0.1); color: #C9A84C; border: 1px solid rgba(201,168,76,0.25); box-shadow: 0 4px 15px rgba(201,168,76,0.1); }
                .luxury-input { width: 100%; padding: 0.875rem 1.125rem; border-radius: 1rem; border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: white; outline: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .luxury-input:focus { border-color: #C9A84C; background: rgba(201,168,76,0.05); box-shadow: 0 0 20px rgba(201,168,76,0.1); }
                .luxury-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; }
                .luxury-table-row { transition: all 0.3s ease; border-bottom: 1px solid rgba(255,255,255,0.03); }
                .luxury-table-row:hover { background: rgba(255,255,255,0.02); }
            `}</style>

            {/* Premium Header */}
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(123,28,28,0.3)' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, margin: 0 }}>MEMBERS & ACTIVITY LOGS</p>
                            <p style={{ fontSize: '0.625rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.125rem 0 0' }}>Data Integrity & Traceability</p>
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
                                            <button onClick={() => { setMenuOpen(false); onNavigateManageData && onNavigateManageData(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', transition: 'all 0.2s' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                Manage Teams & Scores
                                            </button>
                                            <button onClick={() => { setMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'rgba(201,168,76,0.1)', fontSize: '0.8125rem', fontWeight: 700, color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Members & Activity Logs
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

            <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className="tab-nav-luxury">
                            <button onClick={() => setActiveTab('logs')} className={`tab-btn-luxury ${activeTab === 'logs' ? 'active' : ''}`}>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                ACTIVITY RECORDS
                            </button>
                            <button onClick={() => setActiveTab('users')} className={`tab-btn-luxury ${activeTab === 'users' ? 'active' : ''}`}>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                                PERSONNEL DATABASE
                            </button>
                            <button onClick={() => setActiveTab('demographics')} className={`tab-btn-luxury ${activeTab === 'demographics' ? 'active' : ''}`}>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                                OVERVIEW & DEMOGRAPHICS
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'logs' ? (
                            <motion.div key="logs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                                {/* Controls */}
                                <div className="luxury-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <svg style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input type="text" placeholder="Search operational logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="luxury-input" style={{ paddingLeft: '3rem' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
                                        {[{ id: 'all', label: 'All Segments' }, { id: 'UPDATE_USER', label: 'Updates' }, { id: 'DELETE_USER', label: 'Deletions' }, { id: 'SELF_EDIT', label: 'Self Edits' }].map(f => (
                                            <button key={f.id} onClick={() => setFilter(f.id)}
                                                style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', background: filter === f.id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)', color: filter === f.id ? '#C9A84C' : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', transition: 'all 0.2s', border: filter === f.id ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                                                {f.label.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Log List */}
                                <div className="luxury-card">
                                    <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{ fontWeight: 800, color: '#C9A84C', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                            CENTRAL LEDGER
                                        </p>
                                    </div>
                                    {loading ? (
                                        <div style={{ padding: '2rem' }}>
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="skeleton-dark" style={{ height: '4rem', width: '100%', borderRadius: '1rem', marginBottom: '1rem' }} />
                                            ))}
                                        </div>
                                    ) : filteredLogs.length === 0 ? (
                                        <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.125rem', fontWeight: 600 }}>No operations localized in current sector.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Desktop Log Table */}
                                            <div className="desktop-table" style={{ width: '100%' }}>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                                <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PRECISION TIMESTAMP</th>
                                                                <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>CLASSIFICATION</th>
                                                                <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SUBJECT TARGET</th>
                                                                <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EXECUTED BY</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {paginatedLogs.map((log) => (
                                                                <tr key={log.id} className="luxury-table-row">
                                                                    <td style={{ padding: '1.25rem 2rem' }}>
                                                                        <p style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'white', margin: 0 }}>{fmtTime(log.created_at)}</p>
                                                                        <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{fmtDate(log.created_at)}</p>
                                                                    </td>
                                                                    <td style={{ padding: '1.25rem 2rem' }}>
                                                                        <span style={{
                                                                            padding: '0.375rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 900, letterSpacing: '0.05em',
                                                                            background: log.action === 'DELETE_USER' ? 'rgba(239,68,68,0.15)' : log.action === 'UPDATE_USER' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                                                                            color: log.action === 'DELETE_USER' ? '#ef4444' : log.action === 'UPDATE_USER' ? '#10b981' : '#3b82f6',
                                                                            border: `1px solid ${log.action === 'DELETE_USER' ? 'rgba(239,68,68,0.2)' : log.action === 'UPDATE_USER' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}`
                                                                        }}>
                                                                            {log.action?.replace('_', ' ')}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '1.25rem 2rem', fontWeight: 700, color: 'white', fontSize: '0.875rem' }}>{log.target_name}</td>
                                                                    <td style={{ padding: '1.25rem 2rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{log.admin_email || 'SYSTEM AUTOMATION'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Mobile Log Cards */}
                                            <div className="mobile-cards" style={{ padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {paginatedLogs.map((log) => (
                                                        <div key={log.id} className="luxury-card" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                                <span style={{
                                                                    padding: '0.25rem 0.625rem', borderRadius: '0.375rem', fontSize: '0.625rem', fontWeight: 900,
                                                                    background: log.action === 'DELETE_USER' ? 'rgba(239,68,68,0.15)' : log.action === 'UPDATE_USER' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                                                                    color: log.action === 'DELETE_USER' ? '#ef4444' : log.action === 'UPDATE_USER' ? '#10b981' : '#3b82f6',
                                                                }}>
                                                                    {log.action?.replace('_', ' ')}
                                                                </span>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'white', margin: 0 }}>{fmtTime(log.created_at)}</p>
                                                                    <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{fmtDate(log.created_at)}</p>
                                                                </div>
                                                            </div>
                                                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>{log.target_name}</p>
                                                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>BY: {log.admin_email || 'SYSTEM AUTOMATION'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Pagination Controls */}
                                            {logTotalPages > 0 && (
                                                <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                                                    <button
                                                        disabled={currentPage === 1}
                                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === 1 ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    >
                                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                                                        PREV
                                                    </button>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>
                                                        PAGE <span style={{ color: '#C9A84C' }}>{currentPage}</span> / {logTotalPages}
                                                    </span>
                                                    <button
                                                        disabled={currentPage === logTotalPages}
                                                        onClick={() => setCurrentPage(prev => Math.min(logTotalPages, prev + 1))}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === logTotalPages ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === logTotalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    >
                                                        NEXT
                                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ) : activeTab === 'users' ? (
                            <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                                {/* User Controls */}
                                <div className="luxury-card" style={{ padding: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 900, color: 'white', fontSize: '1.25rem', marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>PERSONNEL DIRECTORY</p>
                                        <p style={{ color: '#C9A84C', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{users.length} REGISTERED ENTITIES</p>
                                    </div>
                                    <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '500px' }}>
                                        <svg style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input type="text" placeholder="Search by name, team, or designation…" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="luxury-input" style={{ paddingLeft: '3.25rem' }} />
                                    </div>
                                </div>

                                {/* User Table */}
                                <div className="luxury-card">
                                    {usersLoading ? (
                                        <div style={{ padding: '2rem' }}>
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="skeleton-dark" style={{ height: '4.5rem', width: '100%', borderRadius: '1rem', marginBottom: '1rem' }} />
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Desktop Personnel Table */}
                                            <div className="desktop-table" style={{ width: '100%' }}>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                                <th style={{ width: '30%', padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>INDIVIDUAL</th>
                                                                <th style={{ width: '22%', padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>DESIGNATION</th>
                                                                <th style={{ width: '23%', padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AFFILIATION</th>
                                                                <th style={{ width: '15%', padding: '1rem 2rem', textAlign: 'left', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ENLISTMENT</th>
                                                                <th style={{ width: '10%', padding: '1rem 2rem', textAlign: 'right', fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ACTIONS</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {paginatedUsers.length === 0 ? (
                                                                <tr><td colSpan={5} style={{ padding: '6rem 2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>No profiles localized in current database.</td></tr>
                                                            ) : paginatedUsers.map((user) => {
                                                                const isEditing = editingUser === user.id
                                                                const roleColor = user.role === 'leader' ? { bg: 'rgba(201,168,76,0.1)', text: '#C9A84C' } : user.role === 'facilitator' ? { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' } : { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.6)' }

                                                                if (isEditing) {
                                                                    return (
                                                                        <tr key={user.id} style={{ background: 'rgba(201,168,76,0.03)', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
                                                                            <td style={{ padding: '1.25rem 2rem' }}>
                                                                                <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="luxury-input" style={{ padding: '0.625rem 0.875rem', fontSize: '0.8125rem', fontWeight: 700 }} />
                                                                            </td>
                                                                            <td style={{ padding: '1.25rem 2rem' }}>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                                                                        <button type="button" onClick={() => setShowMoreRolesEdit(!showMoreRolesEdit)}
                                                                                            style={{ background: 'none', border: 'none', color: '#C9A84C', fontSize: '0.625rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase', padding: 0 }}>
                                                                                            {showMoreRolesEdit ? '← VIEW REGULAR' : '→ VIEW ADMIN'}
                                                                                        </button>
                                                                                    </div>
                                                                                    <div style={{ display: 'grid', gridTemplateColumns: showMoreRolesEdit ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.25rem' }}>
                                                                                        {(showMoreRolesEdit ? ['executive', 'officer'] : ['student', 'leader', 'facilitator']).map(r => (
                                                                                            <button key={r} onClick={() => setEditForm(prev => ({ ...prev, role: r }))}
                                                                                                style={{
                                                                                                    padding: '0.375rem 0', borderRadius: '0.5rem', border: `1.5px solid ${editForm.role === r ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.05)'}`,
                                                                                                    background: editForm.role === r ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.02)', color: editForm.role === r ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                                                                                                    fontSize: '0.5625rem', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase'
                                                                                                }}>
                                                                                                {r}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '0.75rem 2rem' }}>
                                                                                <CustomDropdown
                                                                                    value={editForm.team_name}
                                                                                    options={teams}
                                                                                    onChange={val => setEditForm(prev => ({ ...prev, team_name: val }))}
                                                                                    dark={true}
                                                                                    fontSize="0.75rem"
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '1.25rem 2rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.6875rem', fontWeight: 600 }}>{fmtDate(user.created_at)}</td>
                                                                            <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'flex-end' }}>
                                                                                    <button onClick={() => saveEditUser(user.id)} style={{ width: '100%', padding: '0.5rem', background: '#10b981', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 900, fontSize: '0.625rem', cursor: 'pointer', textTransform: 'uppercase' }}>SAVE</button>
                                                                                    <button onClick={() => setEditingUser(null)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 900, fontSize: '0.625rem', cursor: 'pointer', textTransform: 'uppercase' }}>ABORT</button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                }

                                                                return (
                                                                    <tr key={user.id} className="luxury-table-row">
                                                                        <td style={{ padding: '1.25rem 2rem', fontWeight: 900, color: 'white', fontSize: '0.8125rem' }}>{user.full_name}</td>
                                                                        <td style={{ padding: '1.25rem 2rem' }}>
                                                                            <span style={{ background: roleColor.bg, color: roleColor.text, fontSize: '0.5625rem', fontWeight: 900, padding: '0.3125rem 0.625rem', borderRadius: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${roleColor.text}33` }}>
                                                                                {user.role}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '1.25rem 2rem' }}>
                                                                            <span style={{ background: 'rgba(201,168,76,0.05)', color: '#C9A84C', fontSize: '0.6875rem', fontWeight: 800, padding: '0.3125rem 0.625rem', borderRadius: '0.375rem', border: '1px solid rgba(201,168,76,0.1)' }}>
                                                                                {user.team_name}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '1.25rem 2rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.6875rem', fontWeight: 700 }}>{fmtDate(user.created_at)}</td>
                                                                        <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                                                <button onClick={() => startEditUser(user)}
                                                                                    style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                                                                                >
                                                                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                                </button>
                                                                                <button onClick={() => deleteUser(user.id, user.full_name)}
                                                                                    style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)', cursor: 'pointer', color: 'rgba(239,68,68,0.4)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
                                                                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(239,68,68,0.4)'; e.currentTarget.style.background = 'rgba(239,68,68,0.03)' }}
                                                                                >
                                                                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Mobile Personnel Cards */}
                                            <div className="mobile-cards" style={{ padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {paginatedUsers.length === 0 ? (
                                                        <div style={{ padding: '6rem 2rem', textAlign: 'center', opacity: 0.3 }}>No profiles localized.</div>
                                                    ) : paginatedUsers.map((user) => {
                                                        const isEditing = editingUser === user.id
                                                        const roleColor = user.role === 'leader' ? { bg: 'rgba(201,168,76,0.1)', text: '#C9A84C' } : user.role === 'facilitator' ? { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' } : { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.6)' }

                                                        return (
                                                            <div key={user.id} className="luxury-card" style={{ padding: '1.25rem', background: isEditing ? 'rgba(201,168,76,0.05)' : 'rgba(0,0,0,0.2)', border: isEditing ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: paginatedUsers.length - users.indexOf(user) }}>
                                                                {isEditing ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                                        <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="luxury-input" placeholder="Entity Designation" />
                                                                        <CustomDropdown
                                                                            value={editForm.team_name}
                                                                            options={teams}
                                                                            onChange={val => setEditForm(prev => ({ ...prev, team_name: val }))}
                                                                            dark={true}
                                                                            fontSize="0.875rem"
                                                                        />
                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                                                            {(showMoreRolesEdit ? ['executive', 'officer'] : ['student', 'leader', 'facilitator']).map(r => (
                                                                                <button key={r} onClick={() => setEditForm(prev => ({ ...prev, role: r }))} style={{ padding: '0.5rem', borderRadius: '0.75rem', fontSize: '0.625rem', fontWeight: 800, background: editForm.role === r ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)', color: editForm.role === r ? '#C9A84C' : 'white', border: editForm.role === r ? '1px solid #C9A84C' : 'none' }}>{r.toUpperCase()}</button>
                                                                            ))}
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                            <button onClick={() => saveEditUser(user.id)} style={{ flex: 1, padding: '0.875rem', background: '#10b981', color: 'white', borderRadius: '1rem', border: 'none', fontWeight: 900 }}>CONFIRM</button>
                                                                            <button onClick={() => setEditingUser(null)} style={{ flex: 1, padding: '0.875rem', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '1rem', border: 'none', fontWeight: 900 }}>CANCEL</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                                            <div>
                                                                                <p style={{ fontWeight: 900, color: 'white', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{user.full_name}</p>
                                                                                <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>ENLISTED: {fmtDate(user.created_at)}</p>
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                                <button onClick={() => startEditUser(user)} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                                                                <button onClick={() => deleteUser(user.id, user.full_name)} style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                            <span style={{ background: roleColor.bg, color: roleColor.text, fontSize: '0.5rem', fontWeight: 900, padding: '0.25rem 0.625rem', borderRadius: '0.375rem', textTransform: 'uppercase', border: `1px solid ${roleColor.text}33` }}>{user.role}</span>
                                                                            <span style={{ background: 'rgba(201,168,76,0.05)', color: '#C9A84C', fontSize: '0.5625rem', fontWeight: 900, padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: '1px solid rgba(201,168,76,0.1)', textTransform: 'uppercase' }}>{user.team_name}</span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Pagination Controls */}
                                            {userTotalPages > 0 && (
                                                <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                                                    <button
                                                        disabled={userPage === 1}
                                                        onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: userPage === 1 ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: userPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    >
                                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                                                        PREV
                                                    </button>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>
                                                        PAGE <span style={{ color: '#C9A84C' }}>{userPage}</span> / {userTotalPages}
                                                    </span>
                                                    <button
                                                        disabled={userPage === userTotalPages}
                                                        onClick={() => setUserPage(prev => Math.min(userTotalPages, prev + 1))}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: userPage === userTotalPages ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: userPage === userTotalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    >
                                                        NEXT
                                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ) : activeTab === 'demographics' ? (
                            <motion.div key="demographics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                                {/* Top Status Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    <div className="luxury-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', right: '-1rem', top: '-1rem', opacity: 0.05, color: '#C9A84C' }}>
                                            <svg width="120" height="120" fill="currentColor" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                                        </div>
                                        <h3 style={{ fontSize: '0.6875rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Total Registered Population</h3>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '3rem', fontWeight: 900, color: '#C9A84C', lineHeight: 1 }}>{users.length}</span>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>ENTITIES</span>
                                        </div>
                                    </div>

                                    <div className="luxury-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)' }}>
                                        <h3 style={{ fontSize: '0.6875rem', fontWeight: 900, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Total Enlisted Executives</h3>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{execCount}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>EXECUTIVES</span>
                                        </div>
                                    </div>

                                    <div className="luxury-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                        <h3 style={{ fontSize: '0.6875rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Total Enlisted Officers</h3>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{officerCount}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>OFFICERS</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Graph Layout */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

                                    {/* Team Distribution Graph */}
                                    <div className="luxury-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '4px', height: '1.25rem', background: '#C9A84C', borderRadius: '2px' }} />
                                            TEAM AFFILIATION DISTRIBUTION
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                            {teamStats.map((team, idx) => {
                                                const percentage = Math.max((team.count / maxTeamCount) * 100, 2)
                                                return (
                                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>{team.name}</span>
                                                            <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#C9A84C' }}>{team.count}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${percentage}%` }}
                                                                transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                                                                style={{ height: '100%', background: 'linear-gradient(90deg, #7B1C1C, #C9A84C)', borderRadius: '4px' }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Role Comparison Graph */}
                                    <div className="luxury-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'flex-start' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'white', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '4px', height: '1.25rem', background: '#3b82f6', borderRadius: '2px' }} />
                                            ADMINISTRATIVE ROLE COMPARISON
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>

                                            {/* Executive Bar */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C9A84C' }} /> EXECUTIVES
                                                    </span>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#C9A84C' }}>{execCount}</span>
                                                </div>
                                                <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.max((execCount / maxRoleCount) * 100, 2)}%` }}
                                                        transition={{ duration: 1, ease: "easeOut" }}
                                                        style={{ height: '100%', background: 'linear-gradient(90deg, rgba(201,168,76,0.6), #C9A84C)', borderRadius: '6px' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Officer Bar */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} /> OFFICERS
                                                    </span>
                                                    <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#3b82f6' }}>{officerCount}</span>
                                                </div>
                                                <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.max((officerCount / maxRoleCount) * 100, 2)}%` }}
                                                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                                        style={{ height: '100%', background: 'linear-gradient(90deg, rgba(59,130,246,0.6), #3b82f6)', borderRadius: '6px' }}
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}
