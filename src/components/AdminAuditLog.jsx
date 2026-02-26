import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'

export default function AdminAuditLog({ onLogout, onNavigateScanner, onNavigateManageData, onNavigateTally }) {
    const [activeTab, setActiveTab] = useState('logs') // 'logs' or 'users'
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all') // 'all', 'UPDATE_USER', 'DELETE_USER', 'SELF_EDIT'
    const [menuOpen, setMenuOpen] = useState(false)

    // ─── User Management State (Migrated)
    const [users, setUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [userSearch, setUserSearch] = useState('')
    const [editingUser, setEditingUser] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [showMoreRolesEdit, setShowMoreRolesEdit] = useState(false)
    const [teams, setTeams] = useState([])

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

    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        user.team_name?.toLowerCase().includes(userSearch.toLowerCase())
    )

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : ''

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>Audit & Users</p>
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Logs & User Management</p>
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '0.5rem', borderRadius: '0.5rem', background: menuOpen ? '#f1f5f9' : 'transparent', border: 'none', cursor: 'pointer' }}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <AnimatePresence>
                            {menuOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        style={{ position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)', background: 'white', borderRadius: '0.75rem', padding: '0.5rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', minWidth: '200px', zIndex: 50 }}>
                                        <button onClick={() => { setMenuOpen(false); onNavigateScanner(); }} style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                            Scanner & Logs
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateManageData(); }} style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                            Manage Data
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateTally(); }} style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                            Point Tally
                                        </button>
                                        <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }} />
                                        <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

            <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className="tab-nav">
                            <button onClick={() => setActiveTab('logs')} className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Audit & Users
                            </button>
                            <button onClick={() => setActiveTab('users')} className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}>
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                                Manage Users
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'logs' ? (
                            <motion.div key="logs" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                                {/* Controls */}
                                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)' }} width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input type="text" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.75rem', borderRadius: '0.75rem', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                                        {[{ id: 'all', label: 'All Actions' }, { id: 'UPDATE_USER', label: 'Updates' }, { id: 'DELETE_USER', label: 'Deletions' }, { id: 'SELF_EDIT', label: 'Self Edits' }].map(f => (
                                            <button key={f.id} onClick={() => setFilter(f.id)}
                                                style={{ padding: '0.4rem 0.875rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: filter === f.id ? '#7B1C1C' : '#f1f5f9', color: filter === f.id ? 'white' : '#64748b', whiteSpace: 'nowrap' }}>
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="card" style={{ overflow: 'hidden' }}>
                                    {loading ? (
                                        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                            <p style={{ fontSize: '0.875rem' }}>Loading logs...</p>
                                        </div>
                                    ) : filteredLogs.length === 0 ? (
                                        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{logs.length === 0 ? 'No audit logs found' : 'No matching logs'}</p>
                                            <p style={{ fontSize: '0.8125rem' }}>{logs.length === 0 ? 'Tracking for user updates and deletions will appear here once active.' : 'Try adjusting your search or filters.'}</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Time</th>
                                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Action</th>
                                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>User</th>
                                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>By</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredLogs.map((log, i) => (
                                                        <tr key={log.id} style={{ borderBottom: i < filteredLogs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                                <p style={{ fontWeight: 600, color: '#0f172a' }}>{fmtTime(log.created_at)}</p>
                                                                <p style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{fmtDate(log.created_at)}</p>
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                                <span style={{
                                                                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 700,
                                                                    background: log.action === 'DELETE_USER' ? '#fee2e2' : log.action === 'UPDATE_USER' ? '#f0fdf4' : '#eff6ff',
                                                                    color: log.action === 'DELETE_USER' ? '#dc2626' : log.action === 'UPDATE_USER' ? '#16a34a' : '#2563eb'
                                                                }}>
                                                                    {log.action?.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#334155' }}>{log.target_name}</td>
                                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#64748b' }}>{log.admin_email || 'System'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="users" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* User Controls */}
                                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.125rem', marginBottom: '0.25rem' }}>User List</p>
                                        <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{users.length} registered students & staff</p>
                                    </div>
                                    <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '400px' }}>
                                        <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)' }} width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        <input type="text" placeholder="Search name or team…" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.75rem', borderRadius: '0.75rem', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }} />
                                    </div>
                                </div>

                                {/* User Table */}
                                <div className="card" style={{ overflow: 'hidden' }}>
                                    {usersLoading ? (
                                        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                            <p style={{ fontSize: '0.875rem' }}>Loading users...</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '600px' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                        {['Name', 'Role', 'Team', 'Registered', 'Actions'].map((h, i) => (
                                                            <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredUsers.length === 0 ? (
                                                        <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No users found matching "{userSearch}"</td></tr>
                                                    ) : filteredUsers.map((user, i) => {
                                                        const isEditing = editingUser === user.id
                                                        const tdBase = { padding: '1rem', borderBottom: i < filteredUsers.length - 1 ? '1px solid #f1f5f9' : 'none', background: isEditing ? '#f8fafc' : 'white', verticalAlign: 'middle' }
                                                        const roleColor = user.role === 'leader' ? { bg: '#fdf0f0', text: '#7B1C1C' } : user.role === 'facilitator' ? { bg: '#fefce8', text: '#854d0e' } : { bg: '#f1f5f9', text: '#475569' }

                                                        if (isEditing) {
                                                            return (
                                                                <tr key={user.id} style={{ boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}>
                                                                    <td style={tdBase}>
                                                                        <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} style={{ fontFamily: 'inherit', padding: '0.375rem 0.625rem', width: '100%', minWidth: '160px', fontSize: '0.8125rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a' }} />
                                                                    </td>
                                                                    <td style={tdBase}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: '160px' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                                <button type="button" onClick={() => setShowMoreRolesEdit(!showMoreRolesEdit)}
                                                                                    style={{ background: 'none', border: 'none', color: '#7B1C1C', fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                                                    </svg>
                                                                                    {showMoreRolesEdit ? 'Regular' : 'Admin'}
                                                                                </button>
                                                                            </div>
                                                                            <div style={{ display: 'grid', gridTemplateColumns: showMoreRolesEdit ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.25rem' }}>
                                                                                {(showMoreRolesEdit ? ['executive', 'officer'] : ['student', 'leader', 'facilitator']).map(r => (
                                                                                    <button key={r} onClick={() => setEditForm(prev => ({ ...prev, role: r }))}
                                                                                        style={{
                                                                                            padding: '0.375rem 0', borderRadius: '0.375rem', border: `1.5px solid ${editForm.role === r ? '#7B1C1C' : '#e2e8f0'}`,
                                                                                            background: editForm.role === r ? '#fdf0f0' : 'white', color: editForm.role === r ? '#7B1C1C' : '#64748b',
                                                                                            fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize'
                                                                                        }}>
                                                                                        {r}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td style={tdBase}>
                                                                        <select value={editForm.team_name} onChange={e => setEditForm({ ...editForm, team_name: e.target.value })} style={{ fontFamily: 'inherit', padding: '0.375rem 0.625rem', width: '100%', minWidth: '120px', fontSize: '0.8125rem', borderRadius: '0.5rem', border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a' }}>
                                                                            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                                                        </select>
                                                                    </td>
                                                                    <td style={{ ...tdBase, color: '#94a3b8', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{fmtDate(user.created_at)}</td>
                                                                    <td style={{ ...tdBase, textAlign: 'right' }}>
                                                                        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', minWidth: '110px' }}>
                                                                            <button onClick={() => saveEditUser(user.id)} style={{ padding: '0.5rem 0.75rem', background: '#10b981', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Save</button>
                                                                            <button onClick={() => setEditingUser(null)} style={{ padding: '0.5rem 0.75rem', background: '#e2e8f0', color: '#475569', borderRadius: '0.5rem', border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        }

                                                        return (
                                                            <tr key={user.id}>
                                                                <td style={{ ...tdBase, fontWeight: 600, color: '#0f172a' }}>{user.full_name}</td>
                                                                <td style={tdBase}>
                                                                    <span style={{ background: roleColor.bg, color: roleColor.text, fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '99px', textTransform: 'capitalize' }}>
                                                                        {user.role}
                                                                    </span>
                                                                </td>
                                                                <td style={tdBase}>
                                                                    <span style={{ background: '#eef2ff', color: '#4f46e5', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.625rem', borderRadius: '0.375rem' }}>
                                                                        {user.team_name}
                                                                    </span>
                                                                </td>
                                                                <td style={{ ...tdBase, color: '#64748b', fontSize: '0.8125rem' }}>{fmtDate(user.created_at)}</td>
                                                                <td style={{ ...tdBase, textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                                                        <button onClick={() => startEditUser(user)} style={{ padding: '0.5rem 0.75rem', background: '#f1f5f9', color: '#475569', borderRadius: '0.5rem', border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Edit</button>
                                                                        <button onClick={() => deleteUser(user.id, user.full_name)} style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#dc2626', borderRadius: '0.5rem', border: 'none', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}
