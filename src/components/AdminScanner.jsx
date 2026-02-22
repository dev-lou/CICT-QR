import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function AdminScanner({ onLogout }) {
    const [activeTab, setActiveTab] = useState('scanner')
    const [mode, setMode] = useState('time-in')
    const [scanning, setScanning] = useState(false)
    const [scanCount, setScanCount] = useState(0)
    const html5QrCodeRef = useRef(null)
    const processingRef = useRef(false)

    // Modal alert state (replaces inline result card)
    const [scanModal, setScanModal] = useState(null) // { type, name, message }

    // Logbook state
    const [logbook, setLogbook] = useState([])
    const [logLoading, setLogLoading] = useState(false)
    const [logFilter, setLogFilter] = useState('all') // 'all' | 'in' | 'out'
    const [dayFilter, setDayFilter] = useState('all') // 'all' | 'YYYY-MM-DD'

    // Teams state
    const [teams, setTeams] = useState([])
    const [newTeamName, setNewTeamName] = useState('')
    const [teamsLoading, setTeamsLoading] = useState(false)
    const [teamError, setTeamError] = useState('')

    // Scores state
    const [scoreLog, setScoreLog] = useState([]) // loaded from Supabase score_logs
    const [scoreReason, setScoreReason] = useState({})
    const [scoreLoading, setScoreLoading] = useState(false)
    const [submitting, setSubmitting] = useState(new Set()) // team IDs currently being saved

    const dismissModal = () => {
        setScanModal(null)
        processingRef.current = false  // allow next scan only after admin dismisses
    }

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

    // ─── Score Logs ──────────────────────────────────────────────────────────────
    const fetchScoreLogs = useCallback(async () => {
        if (!supabase) return
        const { data } = await supabase
            .from('score_logs')
            .select('id, team_name, delta, reason, created_at')
            .order('created_at', { ascending: false })
            .limit(5)
        if (data) setScoreLog(data)
    }, [])

    useEffect(() => { fetchScoreLogs() }, [fetchScoreLogs])

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
        processingRef.current = true  // stays true until admin dismisses modal
        const scannedUuid = decodedText.trim()
        try {
            const { data: student, error: studentErr } = await supabase
                .from('students').select('id, full_name, uuid').eq('uuid', scannedUuid).single()
            if (studentErr || !student) {
                setScanModal({ type: 'error', name: '', message: 'Student not found.' })
                return
            }
            if (mode === 'time-in') {
                const { data: existing } = await supabase
                    .from('logbook').select('id').eq('student_id', student.id).is('time_out', null).limit(1)
                if (existing && existing.length > 0) {
                    setScanModal({ type: 'warning', name: student.full_name, message: 'Already checked in! Please use Time-Out mode.' })
                    return
                }
                const { error: insertErr } = await supabase.from('logbook').insert([{ student_id: student.id }])
                if (insertErr) throw insertErr
                setScanModal({ type: 'success', name: student.full_name, message: 'Successfully Checked In!' })
            } else {
                const { data: openEntry, error: findErr } = await supabase
                    .from('logbook').select('id').eq('student_id', student.id).is('time_out', null)
                    .order('time_in', { ascending: false }).limit(1).single()
                if (findErr || !openEntry) {
                    // Check if they were already fully checked out
                    const { data: lastOut } = await supabase
                        .from('logbook').select('id, time_out').eq('student_id', student.id)
                        .not('time_out', 'is', null).order('time_out', { ascending: false }).limit(1)
                    if (lastOut && lastOut.length > 0) {
                        setScanModal({ type: 'warning', name: student.full_name, message: 'Already checked out! No active check-in found.' })
                    } else {
                        setScanModal({ type: 'error', name: student.full_name, message: 'No active check-in found for this student.' })
                    }
                    return
                }
                const { error: updateErr } = await supabase
                    .from('logbook').update({ time_out: new Date().toISOString() }).eq('id', openEntry.id)
                if (updateErr) throw updateErr
                setScanModal({ type: 'info', name: student.full_name, message: 'Successfully Checked Out!' })
            }
        } catch (err) {
            setScanModal({ type: 'error', name: '', message: err.message || 'An error occurred.' })
        }
        // NOTE: processingRef.current is NOT reset here — it resets on modal dismiss
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
    const TZ = 'Asia/Manila'
    const fmtTime = (iso) => {
        if (!iso) return '—'
        return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ })
    }
    const fmtDate = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: TZ })
    }
    const fmtDateFull = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ })
    }
    // Get YYYY-MM-DD in Asia/Manila for grouping
    const dayKey = (iso) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) // en-CA = YYYY-MM-DD format
    }
    // Unique event days derived from logbook data, sorted newest first
    const eventDays = [...new Set(logbook.map((r) => dayKey(r.time_in)).filter(Boolean))].sort().reverse()

    const filteredLog = logbook.filter((r) => {
        if (dayFilter !== 'all' && dayKey(r.time_in) !== dayFilter) return false
        if (logFilter === 'in') return !r.time_out
        if (logFilter === 'out') return !!r.time_out
        return true
    })

    // ─── Export helpers ─────────────────────────────────────────────────────────
    const exportLabel = dayFilter === 'all' ? 'All Days' : fmtDateFull(dayFilter + 'T00:00:00')

    const exportExcel = () => {
        const rows = filteredLog.map((r, i) => ({
            '#': i + 1,
            'Name': r.students?.full_name || '',
            'Team': r.students?.team_name || '',
            'Date': fmtDate(r.time_in),
            'Time In': fmtTime(r.time_in),
            'Time Out': fmtTime(r.time_out),
            'Status': r.time_out ? 'Checked Out' : 'Present',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
        XLSX.writeFile(wb, `IT-Week-Attendance-${dayFilter}.xlsx`)
    }

    const exportPDF = () => {
        const doc = new jsPDF()
        doc.setFontSize(16)
        doc.text('IT Week Event Attendance', 14, 18)
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text(`${exportLabel} · Exported ${new Date().toLocaleString('en-PH', { timeZone: TZ })}`, 14, 26)
        autoTable(doc, {
            startY: 32,
            head: [['#', 'Name', 'Team', 'Date', 'Time In', 'Time Out', 'Status']],
            body: filteredLog.map((r, i) => [
                i + 1,
                r.students?.full_name || '',
                r.students?.team_name || '',
                fmtDate(r.time_in),
                fmtTime(r.time_in),
                fmtTime(r.time_out),
                r.time_out ? 'Checked Out' : 'Present',
            ]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [99, 102, 241] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        })
        doc.setFontSize(8)
        doc.setTextColor(180)
        doc.text('Built by Lou Vincent Baroro', 14, doc.internal.pageSize.height - 8)
        doc.save(`IT-Week-Attendance-${dayFilter}.pdf`)
    }

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'inherit' }}>

            {/* ── SCAN RESULT MODAL ───────────────────────────────────────────── */}
            <AnimatePresence>
                {scanModal && (
                    <motion.div
                        key="scan-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                            style={{ background: 'white', borderRadius: '1.5rem', padding: '2.5rem 2rem', maxWidth: '22rem', width: '100%', textAlign: 'center', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.35)' }}
                        >
                            {/* Icon circle */}
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '5rem', height: '5rem', borderRadius: '50%', marginBottom: '1.25rem',
                                background: scanModal.type === 'success' ? '#dcfce7'
                                    : scanModal.type === 'warning' ? '#fef9c3'
                                        : scanModal.type === 'info' ? '#dbeafe'
                                            : '#fee2e2',
                            }}>
                                {scanModal.type === 'success' && (
                                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                )}
                                {scanModal.type === 'info' && (
                                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                )}
                                {scanModal.type === 'warning' && (
                                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#ca8a04" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                )}
                                {scanModal.type === 'error' && (
                                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                            </div>

                            {/* Student name */}
                            {scanModal.name && (
                                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.5rem', lineHeight: 1.2 }}>
                                    {scanModal.name}
                                </p>
                            )}

                            {/* Message */}
                            <p style={{
                                fontSize: '1rem', fontWeight: 600, marginBottom: '1.75rem',
                                color: scanModal.type === 'success' ? '#16a34a'
                                    : scanModal.type === 'warning' ? '#ca8a04'
                                        : scanModal.type === 'info' ? '#2563eb'
                                            : '#dc2626',
                            }}>
                                {scanModal.message}
                            </p>

                            {/* OK button */}
                            <motion.button
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={dismissModal}
                                style={{
                                    width: '100%', padding: '0.9rem', borderRadius: '0.875rem', border: 'none', cursor: 'pointer',
                                    fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700,
                                    background: scanModal.type === 'success' ? 'linear-gradient(135deg,#6366f1,#06b6d4)'
                                        : scanModal.type === 'warning' ? '#fbbf24'
                                            : scanModal.type === 'info' ? '#3b82f6'
                                                : '#ef4444',
                                    color: 'white',
                                }}
                            >
                                OK — Scan Next
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                        <div style={{ width: '2rem', height: '2rem', minWidth: '2rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>Admin Panel</p>
                            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>IT Week Attendance</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>{scanCount}</p>
                            <p style={{ fontSize: '0.5625rem', color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Today</p>
                        </div>
                        <button
                            onClick={() => { stopScanner(); onLogout() }}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.625rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px' }}
                        >Logout</button>
                    </div>
                </div>
            </div>

            {/* Tab Nav */}
            <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 1rem 0' }}>
                <div className="tab-nav">
                    {[
                        { id: 'scanner', icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>, label: 'Scanner' },
                        { id: 'logbook', icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>, label: 'Logbook' },
                        { id: 'teams', icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>, label: 'Teams' },
                        { id: 'scores', icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="8 6 12 2 16 6" /><line x1="12" y1="2" x2="12" y2="15" /><path d="M20 15H4a2 2 0 000 4h16a2 2 0 000-4z" /></svg>, label: 'Scores' },
                    ].map((tab) => (
                        <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            {tab.icon}{tab.label}
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
                            <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', marginBottom: '0.1rem' }}>Scan Mode</p>
                                        <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>{mode === 'time-in' ? 'Recording arrivals' : 'Recording departures'}</p>
                                    </div>
                                </div>
                                <div className="mode-toggle" style={{ width: '100%' }}>
                                    <button className={`mode-toggle-btn ${mode === 'time-in' ? 'active' : ''}`} onClick={() => setMode('time-in')} style={{ minHeight: '44px' }}>⏰ Time In</button>
                                    <button className={`mode-toggle-btn ${mode === 'time-out' ? 'active' : ''}`} onClick={() => setMode('time-out')} style={{ minHeight: '44px' }}>🚪 Time Out</button>
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
                                                <circle cx="12" cy="13" r="3" />
                                            </svg>
                                            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Click "Start Scanner" to begin</p>
                                        </div>
                                    )}
                                </div>
                            </div>

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

                            {/* Day selector tabs */}
                            {eventDays.length > 0 && (
                                <div className="card" style={{ padding: '1rem' }}>
                                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Select Day</p>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button onClick={() => setDayFilter('all')}
                                            style={{
                                                padding: '0.4rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', minHeight: '36px',
                                                borderColor: dayFilter === 'all' ? '#6366f1' : '#e2e8f0',
                                                background: dayFilter === 'all' ? '#eef2ff' : 'white',
                                                color: dayFilter === 'all' ? '#4f46e5' : '#64748b',
                                            }}>📅 All Days</button>
                                        {eventDays.map((d) => (
                                            <button key={d} onClick={() => setDayFilter(d)}
                                                style={{
                                                    padding: '0.4rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', minHeight: '36px',
                                                    borderColor: dayFilter === d ? '#6366f1' : '#e2e8f0',
                                                    background: dayFilter === d ? '#eef2ff' : 'white',
                                                    color: dayFilter === d ? '#4f46e5' : '#64748b',
                                                }}>{fmtDateFull(d + 'T00:00:00')}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stats row — reflects current day filter */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
                                {[
                                    { label: 'Total', value: filteredLog.length, color: '#6366f1' },
                                    { label: 'Present', value: filteredLog.filter(r => !r.time_out).length, color: '#10b981' },
                                    { label: 'Done', value: filteredLog.filter(r => !!r.time_out).length, color: '#94a3b8' },
                                ].map((stat) => (
                                    <div key={stat.label} className="card" style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{stat.value}</p>
                                        <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Filter + Refresh + Export */}
                            <div className="card" style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Status pills */}
                                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                        {[{ id: 'all', label: 'All' }, { id: 'in', label: '🟢 Present' }, { id: 'out', label: '⚪ Done' }].map((f) => (
                                            <button key={f.id} onClick={() => setLogFilter(f.id)}
                                                style={{
                                                    padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', minHeight: '34px',
                                                    background: logFilter === f.id ? '#6366f1' : '#f1f5f9',
                                                    color: logFilter === f.id ? 'white' : '#64748b',
                                                }}>{f.label}</button>
                                        ))}
                                    </div>
                                    {/* Refresh + Export */}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button onClick={fetchLogbook}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Refresh
                                        </button>
                                        <button onClick={exportExcel} disabled={filteredLog.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: filteredLog.length === 0 ? '#f1f5f9' : '#dcfce7', border: '1.5px solid', borderColor: filteredLog.length === 0 ? '#e2e8f0' : '#86efac', color: filteredLog.length === 0 ? '#94a3b8' : '#16a34a', fontSize: '0.75rem', fontWeight: 700, cursor: filteredLog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                            📊 Excel
                                        </button>
                                        <button onClick={exportPDF} disabled={filteredLog.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: filteredLog.length === 0 ? '#f1f5f9' : '#fee2e2', border: '1.5px solid', borderColor: filteredLog.length === 0 ? '#e2e8f0' : '#fca5a5', color: filteredLog.length === 0 ? '#94a3b8' : '#dc2626', fontSize: '0.75rem', fontWeight: 700, cursor: filteredLog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                            📄 PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Logbook entries — table */}
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
                                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                    {['#', 'Name', 'Team', 'Date', 'Time In', 'Time Out', 'Status'].map((h, hi) => (
                                                        <th key={h} style={{
                                                            padding: '0.625rem 0.875rem',
                                                            fontSize: '0.6875rem', fontWeight: 700, color: '#64748b',
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                            whiteSpace: 'nowrap', textAlign: hi === 0 || hi === 6 ? 'center' : 'left',
                                                        }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredLog.map((row, i) => {
                                                    const tdBase = {
                                                        padding: '0.75rem 0.875rem',
                                                        borderBottom: i < filteredLog.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                        background: i % 2 === 0 ? 'white' : '#fafafa',
                                                        verticalAlign: 'middle',
                                                    }
                                                    return (
                                                        <motion.tr key={row.id}
                                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                            transition={{ delay: Math.min(i * 0.015, 0.3) }}>
                                                            <td style={{ ...tdBase, textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>{i + 1}</td>
                                                            <td style={{ ...tdBase, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{row.students?.full_name}</td>
                                                            <td style={tdBase}>
                                                                <span style={{ background: '#eef2ff', color: '#4f46e5', fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '99px', whiteSpace: 'nowrap' }}>
                                                                    {row.students?.team_name}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...tdBase, color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{fmtDate(row.time_in)}</td>
                                                            <td style={{ ...tdBase, color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_in)}</td>
                                                            <td style={{ ...tdBase, color: row.time_out ? '#0f172a' : '#cbd5e1', fontWeight: row.time_out ? 600 : 400, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_out)}</td>
                                                            <td style={{ ...tdBase, textAlign: 'center' }}>
                                                                <span style={{
                                                                    display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '99px',
                                                                    fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap',
                                                                    background: row.time_out ? '#f1f5f9' : '#dcfce7',
                                                                    color: row.time_out ? '#64748b' : '#16a34a',
                                                                    border: `1px solid ${row.time_out ? '#e2e8f0' : '#86efac'}`,
                                                                }}>
                                                                    {row.time_out ? 'Done' : '● Present'}
                                                                </span>
                                                            </td>
                                                        </motion.tr>
                                                    )
                                                })}
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

                    {/* ── SCORES TAB ──────────────────────────────────────────── */}
                    {activeTab === 'scores' && (
                        <motion.div key="scores" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Info card */}
                            <div className="card" style={{ padding: '1rem 1.25rem', background: '#eef2ff', border: '1.5px solid #c7d2fe' }}>
                                <p style={{ fontSize: '0.8125rem', color: '#4f46e5', fontWeight: 600 }}>
                                    Teams start at <strong>150 pts</strong>. Type any points in the field, then click <strong>+ Merit</strong> to add or <strong>− Demerit</strong> to subtract (min 0).
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => window.open('/scoreboard-itweek2026', '_blank')}
                                    style={{ marginTop: '0.75rem', width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
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

                            {/* Team score cards */}
                            {scoreLoading ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading…</p>
                            ) : [...teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((team, idx) => {
                                const score = team.score ?? 150
                                const pct = Math.min((score / 150) * 100, 100)
                                const rankColors = ['#f59e0b', '#94a3b8', '#d97706']
                                const rankLabel = idx < 3 ? idx + 1 : `#${idx + 1}`
                                const rankBg = idx < 3 ? rankColors[idx] : '#e2e8f0'
                                const rankTextColor = idx < 3 ? 'white' : '#64748b'
                                const pts = parseInt(scoreReason[team.id + '_pts'] || '10', 10) || 10
                                const applyScore = async (delta) => {
                                    if (!supabase || submitting.has(team.id)) return
                                    setSubmitting(prev => new Set(prev).add(team.id))
                                    try {
                                        const newScore = Math.max(0, score + delta)
                                        const reason = scoreReason[team.id] || ''
                                        await supabase.from('teams').update({ score: newScore }).eq('id', team.id)
                                        await supabase.from('score_logs').insert({ team_id: team.id, team_name: team.name, delta, reason })
                                        setScoreReason(prev => ({ ...prev, [team.id]: '', [team.id + '_pts']: '' }))
                                        fetchTeams()
                                        fetchScoreLogs()
                                        const isMerit = delta > 0
                                        Swal.fire({
                                            toast: true,
                                            position: 'top-end',
                                            icon: isMerit ? 'success' : 'error',
                                            title: `${isMerit ? 'Merit' : 'Demerit'} applied!`,
                                            html: `<strong>${team.name}</strong> &nbsp;<span style="color:${isMerit ? '#16a34a' : '#dc2626'};font-weight:700">${isMerit ? '+' : ''}${delta} pts</span>${reason ? `<br><span style="font-size:0.8em;color:#64748b">${reason}</span>` : ''}`,
                                            showConfirmButton: false,
                                            timer: 3000,
                                            timerProgressBar: true,
                                        })
                                    } finally {
                                        setSubmitting(prev => { const s = new Set(prev); s.delete(team.id); return s })
                                    }
                                }
                                const isBusy = submitting.has(team.id)
                                return (
                                    <div key={team.id} className="card" style={{ padding: '1.25rem' }}>
                                        {/* Header row */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: rankBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: idx < 3 ? '0.875rem' : '0.75rem', color: rankTextColor, flexShrink: 0 }}>{rankLabel}</div>
                                                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{team.name}</span>
                                            </div>
                                            <span style={{ fontSize: '1.625rem', fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{score} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>pts</span></span>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginBottom: '1rem' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#06b6d4)', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                                        </div>
                                        {/* Controls row: reason + points + buttons */}
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {/* Reason */}
                                            <input
                                                className="input" type="text"
                                                value={scoreReason[team.id] || ''}
                                                onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id]: e.target.value }))}
                                                placeholder="Reason (e.g. Won quiz)"
                                                style={{ flex: '2 1 120px', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', minWidth: '100px' }}
                                            />
                                            {/* Points amount */}
                                            <input
                                                className="input" type="number" min="1"
                                                value={scoreReason[team.id + '_pts'] || ''}
                                                onChange={(e) => setScoreReason(prev => ({ ...prev, [team.id + '_pts']: e.target.value }))}
                                                placeholder="Pts"
                                                style={{ flex: '0 0 64px', fontSize: '0.9375rem', fontWeight: 700, padding: '0.5rem 0.5rem', textAlign: 'center', width: '64px' }}
                                            />
                                            {/* + Merit */}
                                            <motion.button whileHover={{ scale: isBusy ? 1 : 1.05 }} whileTap={{ scale: isBusy ? 1 : 0.95 }}
                                                onClick={() => applyScore(+pts)}
                                                disabled={isBusy}
                                                style={{ flex: '1 1 80px', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', background: '#dcfce7', border: '1.5px solid #86efac', color: '#16a34a', fontWeight: 800, fontSize: '1rem', cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', opacity: isBusy ? 0.5 : 1 }}>
                                                <span style={{ fontSize: '1.1rem' }}>＋</span> {isBusy ? '…' : 'Merit'}
                                            </motion.button>
                                            {/* − Demerit */}
                                            <motion.button whileHover={{ scale: isBusy ? 1 : 1.05 }} whileTap={{ scale: isBusy ? 1 : 0.95 }}
                                                onClick={() => applyScore(-pts)}
                                                disabled={isBusy}
                                                style={{ flex: '1 1 80px', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', background: '#fee2e2', border: '1.5px solid #fca5a5', color: '#dc2626', fontWeight: 800, fontSize: '1rem', cursor: isBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', opacity: isBusy ? 0.5 : 1 }}>
                                                <span style={{ fontSize: '1.1rem' }}>－</span> {isBusy ? '…' : 'Demerit'}
                                            </motion.button>
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Recent action log */}
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

                </AnimatePresence>
            </div>
        </div>
    )
}
