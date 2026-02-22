import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'

export default function AdminScanner({ onLogout }) {
    const [activeTab, setActiveTab] = useState('scanner')
    const [mode, setMode] = useState('time-in')
    const [scanning, setScanning] = useState(false)
    const [result, setResult] = useState(null)
    const [scanCount, setScanCount] = useState(0)
    const html5QrCodeRef = useRef(null)
    const processingRef = useRef(false)

    // Logbook state
    const [logbook, setLogbook] = useState([])
    const [logLoading, setLogLoading] = useState(false)
    const [logFilter, setLogFilter] = useState('all') // 'all' | 'in' | 'out'

    // Teams state
    const [teams, setTeams] = useState([])
    const [newTeamName, setNewTeamName] = useState('')
    const [teamsLoading, setTeamsLoading] = useState(false)
    const [teamError, setTeamError] = useState('')

    useEffect(() => {
        if (result) {
            const t = setTimeout(() => setResult(null), 4000)
            return () => clearTimeout(t)
        }
    }, [result])

    // ─── Logbook ────────────────────────────────────────────────────────────────
    const fetchLogbook = useCallback(async () => {
        if (!supabase) return
        setLogLoading(true)
        try {
            const { data, error } = await supabase
                .from('logbook')
                .select('id, time_in, time_out, students(full_name, team_name, uuid)')
                .order('time_in', { ascending: false })
                .limit(100)
            if (error) throw error
            setLogbook(data || [])
            // Update scan count (number of time-ins today)
            const today = new Date().toISOString().slice(0, 10)
            const todayScans = (data || []).filter((r) => r.time_in?.slice(0, 10) === today)
            setScanCount(todayScans.length)
        } catch (err) {
            console.error('Failed to load logbook:', err)
        } finally {
            setLogLoading(false)
        }
    }, [])

    // Realtime subscription to logbook
    useEffect(() => {
        fetchLogbook()
        if (!supabase) return
        const channel = supabase
            .channel('logbook-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook' }, () => {
                fetchLogbook()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchLogbook])

    // ─── Teams ──────────────────────────────────────────────────────────────────
    const fetchTeams = useCallback(async () => {
        if (!supabase) return
        setTeamsLoading(true)
        try {
            // Fetch teams and student counts in parallel
            const [{ data: teamsData }, { data: studentsData }] = await Promise.all([
                supabase.from('teams').select('*').order('name'),
                supabase.from('students').select('id, team_name'),
            ])
            // Annotate each team with member count
            const withCounts = (teamsData || []).map((t) => ({
                ...t,
                member_count: (studentsData || []).filter((s) => s.team_name === t.name).length,
            }))
            setTeams(withCounts)
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

    // ─── Scanner ─────────────────────────────────────────────────────────────────
    const handleScan = useCallback(async (decodedText) => {
        if (processingRef.current) return
        processingRef.current = true
        const scannedUuid = decodedText.trim()
        try {
            const { data: student, error: studentErr } = await supabase
                .from('students').select('id, full_name, uuid').eq('uuid', scannedUuid).single()
            if (studentErr || !student) {
                setResult({ type: 'error', name: '', message: 'Student not found.' })
                processingRef.current = false; return
            }
            if (mode === 'time-in') {
                const { data: existing } = await supabase
                    .from('logbook').select('id').eq('student_id', student.id).is('time_out', null).limit(1)
                if (existing && existing.length > 0) {
                    setResult({ type: 'error', name: student.full_name, message: 'Already checked in!' })
                    processingRef.current = false; return
                }
                const { error: insertErr } = await supabase.from('logbook').insert([{ student_id: student.id }])
                if (insertErr) throw insertErr
                setResult({ type: 'success', name: student.full_name, message: 'Checked In ✓' })
            } else {
                const { data: openEntry, error: findErr } = await supabase
                    .from('logbook').select('id').eq('student_id', student.id).is('time_out', null)
                    .order('time_in', { ascending: false }).limit(1).single()
                if (findErr || !openEntry) {
                    setResult({ type: 'error', name: student.full_name, message: 'No active check-in found.' })
                    processingRef.current = false; return
                }
                const { error: updateErr } = await supabase
                    .from('logbook').update({ time_out: new Date().toISOString() }).eq('id', openEntry.id)
                if (updateErr) throw updateErr
                setResult({ type: 'info', name: student.full_name, message: 'Checked Out ✓' })
            }
        } catch (err) {
            setResult({ type: 'error', name: '', message: err.message || 'An error occurred.' })
        } finally { processingRef.current = false }
    }, [mode])

    const startScanner = useCallback(async () => {
        if (html5QrCodeRef.current) return
        try {
            const qr = new Html5Qrcode('qr-reader')
            html5QrCodeRef.current = qr
            await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 }, (txt) => handleScan(txt), () => { })
            setScanning(true)
        } catch (err) {
            setResult({ type: 'error', name: '', message: 'Camera access denied or unavailable.' })
        }
    }, [handleScan])

    const stopScanner = useCallback(async () => {
        if (html5QrCodeRef.current) {
            try { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear() } catch (e) { }
            html5QrCodeRef.current = null; setScanning(false)
        }
    }, [])

    useEffect(() => () => { if (html5QrCodeRef.current) html5QrCodeRef.current.stop().catch(() => { }) }, [])

    // ─── Helpers ─────────────────────────────────────────────────────────────────
    const fmtTime = (iso) => {
        if (!iso) return '—'
        return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    const fmtDate = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    }

    const filteredLog = logbook.filter((r) => {
        if (logFilter === 'in') return !r.time_out
        if (logFilter === 'out') return !!r.time_out
        return true
    })

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>

            {/* Header */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>Admin Panel</p>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ISUFST Attendance</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>{scanCount}</p>
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Scanned Today</p>
                        </div>
                        <button
                            onClick={() => { stopScanner(); onLogout() }}
                            style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >Logout</button>
                    </div>
                </div>
            </div>

            {/* Tab Nav */}
            <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1.25rem 1.5rem 0' }}>
                <div className="tab-nav">
                    {[
                        { id: 'scanner', label: '📷 Scanner' },
                        { id: 'logbook', label: '📋 Logbook' },
                        { id: 'teams', label: '👥 Teams' },
                    ].map((tab) => (
                        <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1.25rem 1.5rem 2rem' }}>
                <AnimatePresence mode="wait">

                    {/* ── SCANNER TAB ─────────────────────────────────────── */}
                    {activeTab === 'scanner' && (
                        <motion.div key="scanner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Mode toggle */}
                            <div className="card" style={{ padding: '1.125rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', marginBottom: '0.2rem' }}>Scan Mode</p>
                                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>{mode === 'time-in' ? 'Recording arrivals' : 'Recording departures'}</p>
                                </div>
                                <div className="mode-toggle" style={{ minWidth: '200px' }}>
                                    <button className={`mode-toggle-btn ${mode === 'time-in' ? 'active' : ''}`} onClick={() => setMode('time-in')}>⏰ Time In</button>
                                    <button className={`mode-toggle-btn ${mode === 'time-out' ? 'active' : ''}`} onClick={() => setMode('time-out')}>🚪 Time Out</button>
                                </div>
                            </div>

                            {/* Camera */}
                            <div className="card" style={{ overflow: 'hidden' }}>
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: scanning ? '#10b981' : '#e2e8f0', animation: scanning ? 'pulse-dot 1.5s infinite' : 'none' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{scanning ? 'Camera Active' : 'Camera Off'}</span>
                                    </div>
                                    <button
                                        onClick={scanning ? stopScanner : startScanner}
                                        style={{ padding: '0.5rem 1.125rem', borderRadius: '0.625rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: scanning ? '#fef2f2' : 'linear-gradient(135deg,#6366f1,#06b6d4)', color: scanning ? '#dc2626' : 'white' }}
                                    >{scanning ? 'Stop' : 'Start Scanner'}</button>
                                </div>
                                <div style={{ background: '#0f172a', position: 'relative', minHeight: '260px' }}>
                                    <div id="qr-reader" style={{ width: '100%' }} />
                                    {!scanning && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                            <svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={1} opacity={0.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            </svg>
                                            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Click "Start Scanner" to begin</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scan result */}
                            <AnimatePresence mode="wait">
                                {result && (
                                    <motion.div key={result.message + result.name}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                                        className={`result-card result-card-${result.type}`}>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: '50%', marginBottom: '1rem',
                                            background: result.type === 'success' ? '#dcfce7' : result.type === 'error' ? '#fee2e2' : '#dbeafe'
                                        }}>
                                            {result.type === 'error'
                                                ? <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                : <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke={result.type === 'success' ? '#16a34a' : '#2563eb'} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            }
                                        </div>
                                        {result.name && <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>{result.name}</p>}
                                        <p style={{ fontSize: '1rem', fontWeight: 600, color: result.type === 'success' ? '#16a34a' : result.type === 'error' ? '#dc2626' : '#2563eb' }}>{result.message}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Mini logbook preview (last 5) */}
                            {logbook.length > 0 && (
                                <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>Recent Scans</p>
                                        <button onClick={() => setActiveTab('logbook')} style={{ fontSize: '0.8125rem', color: '#6366f1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            View all →
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {logbook.slice(0, 5).map((row) => (
                                            <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: '#f8fafc', borderRadius: '0.625rem', border: '1px solid #f1f5f9' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <span className={`badge ${row.time_out ? 'badge-brand' : 'badge-success'}`} style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem' }}>
                                                        {row.time_out ? 'OUT' : 'IN'}
                                                    </span>
                                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{row.students?.full_name}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{row.students?.team_name}</span>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                                    {row.time_out ? fmtTime(row.time_out) : fmtTime(row.time_in)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── LOGBOOK TAB ─────────────────────────────────────── */}
                    {activeTab === 'logbook' && (
                        <motion.div key="logbook" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Stats row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                {[
                                    { label: 'Total Entries', value: logbook.length, color: '#6366f1' },
                                    { label: 'Currently In', value: logbook.filter(r => !r.time_out).length, color: '#10b981' },
                                    { label: 'Checked Out', value: logbook.filter(r => !!r.time_out).length, color: '#94a3b8' },
                                ].map((stat) => (
                                    <div key={stat.label} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color, letterSpacing: '-0.03em' }}>{stat.value}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Filter + Refresh */}
                            <div className="card" style={{ padding: '1rem 1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {[{ id: 'all', label: 'All' }, { id: 'in', label: '🟢 Still In' }, { id: 'out', label: '⚪ Checked Out' }].map((f) => (
                                            <button key={f.id} onClick={() => setLogFilter(f.id)}
                                                style={{
                                                    padding: '0.375rem 0.875rem', borderRadius: '99px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                                    background: logFilter === f.id ? '#6366f1' : '#f1f5f9',
                                                    color: logFilter === f.id ? 'white' : '#64748b',
                                                }}
                                            >{f.label}</button>
                                        ))}
                                    </div>
                                    <button onClick={fetchLogbook}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="card" style={{ overflow: 'hidden' }}>
                                {logLoading ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
                                            <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3" /><path fill="#6366f1" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <p style={{ fontSize: '0.875rem' }}>Loading logbook…</p>
                                    </div>
                                ) : filteredLog.length === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>No records yet</p>
                                        <p style={{ fontSize: '0.8125rem' }}>Scan QR codes to populate the logbook</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                    {['Student', 'Team', 'Date', 'Time In', 'Time Out', 'Status'].map((h) => (
                                                        <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: '0.8125rem', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredLog.map((row, i) => (
                                                    <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                                                        style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fdfdfe' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9ff'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fdfdfe'}
                                                    >
                                                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{row.students?.full_name}</td>
                                                        <td style={{ padding: '0.875rem 1rem', color: '#64748b' }}>
                                                            <span className="badge badge-brand" style={{ fontSize: '0.725rem', padding: '0.2rem 0.625rem' }}>{row.students?.team_name}</span>
                                                        </td>
                                                        <td style={{ padding: '0.875rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(row.time_in)}</td>
                                                        <td style={{ padding: '0.875rem 1rem', color: '#1e293b', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtTime(row.time_in)}</td>
                                                        <td style={{ padding: '0.875rem 1rem', color: row.time_out ? '#1e293b' : '#94a3b8', fontWeight: row.time_out ? 500 : 400, whiteSpace: 'nowrap' }}>{fmtTime(row.time_out)}</td>
                                                        <td style={{ padding: '0.875rem 1rem' }}>
                                                            <span className={`badge ${row.time_out ? '' : 'badge-success'}`}
                                                                style={{ fontSize: '0.725rem', padding: '0.25rem 0.625rem', background: row.time_out ? '#f1f5f9' : '', color: row.time_out ? '#64748b' : '' }}>
                                                                {row.time_out ? 'Checked Out' : '● Present'}
                                                            </span>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── TEAMS TAB ───────────────────────────────────────── */}
                    {activeTab === 'teams' && (
                        <motion.div key="teams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', marginBottom: '1rem' }}>Add New Team</p>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input className="input" type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name…" onKeyDown={(e) => e.key === 'Enter' && addTeam()} style={{ flex: 1 }} />
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={addTeam} disabled={!newTeamName.trim()}
                                        style={{ padding: '0.875rem 1.5rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', color: 'white', fontWeight: 700, fontSize: '0.9375rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: newTeamName.trim() ? 1 : 0.4 }}>
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
                                        {teams.map((team, i) => (
                                            <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', flexShrink: 0 }} />
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

                </AnimatePresence>
            </div>
        </div>
    )
}
