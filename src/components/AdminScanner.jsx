import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function AdminScanner({ onLogout, onNavigateManageData, onNavigateAudit, onNavigateTally }) {
    const [activeTab, setActiveTab] = useState('scanner')
    const [menuOpen, setMenuOpen] = useState(false)
    const [mode, setMode] = useState('time-in')
    const [scanning, setScanning] = useState(false)
    const [scanCount, setScanCount] = useState(0)
    const html5QrCodeRef = useRef(null)
    const processingRef = useRef(false)

    const [scanModal, setScanModal] = useState(null) // { type, name, message }

    // Synthetic scanner beep using Web Audio API
    const playBeep = useCallback(() => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch scanner beep
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) { }
    }, []);

    // Student Logbook state
    const [logbook, setLogbook] = useState([])
    const [logLoading, setLogLoading] = useState(false)
    const [logFilter, setLogFilter] = useState('all') // 'all' | 'in' | 'out'
    const [dayFilter, setDayFilter] = useState('all')

    // Staff Logbook state (leaders + facilitators)
    const [staffLogbook, setStaffLogbook] = useState([])
    const [staffLogLoading, setStaffLogLoading] = useState(false)
    const [staffLogFilter, setStaffLogFilter] = useState('all')
    const [staffDayFilter, setStaffDayFilter] = useState('all')

    // Minimal state for Logbook stats
    const [users, setUsers] = useState([])
    const [teams, setTeams] = useState([])

    const dismissModal = () => {
        setScanModal(null)
        processingRef.current = false  // allow next scan only after admin dismisses
    }

    // ─── Student Logbook ─────────────────────────────────────────────────────────
    const fetchLogbook = useCallback(async () => {
        if (!supabase) return
        setLogLoading(true)
        try {
            const { data, error } = await supabase
                .from('logbook')
                .select('id, time_in, time_out, students(id, full_name, team_name, uuid, role)')
                .order('time_in', { ascending: false })
                .limit(100)
            if (error) throw error
            setLogbook(data || [])
            const today = new Date().toISOString().slice(0, 10)
            const todayScans = (data || []).filter((r) => r.time_in?.slice(0, 10) === today)
            setScanCount(todayScans.length)
        } catch (err) {
            console.error('Failed to load logbook:', err)
        } finally {
            setLogLoading(false)
        }
    }, [])

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

    // ─── Staff Logbook ───────────────────────────────────────────────────────────
    const fetchStaffLogbook = useCallback(async () => {
        if (!supabase) return
        setStaffLogLoading(true)
        try {
            const { data, error } = await supabase
                .from('staff_logbook')
                .select('id, time_in, time_out, students(id, full_name, team_name, uuid, role)')
                .order('time_in', { ascending: false })
                .limit(100)
            if (error) {
                console.error('Staff Logbook Fetch Error:', error)
                throw error
            }
            setStaffLogbook(data || [])
        } catch (err) {
            console.error('Failed to load staff logbook:', err.message)
        } finally {
            setStaffLogLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStaffLogbook()
        if (!supabase) return
        const channel = supabase
            .channel('staff-logbook-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_logbook' }, () => {
                fetchStaffLogbook()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchStaffLogbook])

    const fetchStats = useCallback(async () => {
        if (!supabase) return
        const [{ data: ud }, { data: td }] = await Promise.all([
            supabase.from('students').select('id'),
            supabase.from('teams').select('id')
        ])
        setUsers(ud || [])
        setTeams(td || [])
    }, [])

    useEffect(() => {
        fetchLogbook()
        fetchStaffLogbook()
        fetchStats()
        if (!supabase) return
        const c1 = supabase.channel('logbook-update').on('postgres_changes', { event: '*', schema: 'public', table: 'logbook' }, () => fetchLogbook()).subscribe()
        const c2 = supabase.channel('staff-update').on('postgres_changes', { event: '*', schema: 'public', table: 'staff_logbook' }, () => fetchStaffLogbook()).subscribe()
        return () => { supabase.removeChannel(c1); supabase.removeChannel(c2); }
    }, [fetchLogbook, fetchStaffLogbook, fetchStats])

    // ─── Scanner ─────────────────────────────────────────────────────────────────
    const handleScan = useCallback(async (decodedText) => {
        if (processingRef.current) return
        processingRef.current = true
        const scannedUuid = decodedText.trim()
        try {
            const { data: student, error: studentErr } = await supabase
                .from('students').select('id, full_name, uuid, role').eq('uuid', scannedUuid).single()
            if (studentErr || !student) {
                setScanModal({ type: 'error', name: '', message: 'Student not found.' })
                return
            }

            // Route to correct logbook table based on role
            const isStaff = student.role === 'leader' || student.role === 'facilitator' || student.role === 'executive' || student.role === 'officer'
            const table = isStaff ? 'staff_logbook' : 'logbook'
            const roleLabel = student.role === 'leader' ? '⭐ Leader' : student.role === 'facilitator' ? '🎯 Facilitator' : student.role === 'executive' ? '👔 Executive' : student.role === 'officer' ? '🏛️ Officer' : '🎓 Student'

            if (mode === 'time-in') {
                const { data: existing } = await supabase
                    .from(table).select('id').eq('student_id', student.id).is('time_out', null).limit(1)
                if (existing && existing.length > 0) {
                    setScanModal({ type: 'warning', name: student.full_name, message: `Already checked in! (${roleLabel}) Please use Time-Out mode.` })
                    return
                }
                const { error: insertErr } = await supabase.from(table).insert([{ student_id: student.id }])
                if (insertErr) throw insertErr

                // Play success beep
                playBeep();

                setScanModal({ type: 'success', name: student.full_name, message: `✅ Checked In! (${roleLabel})` })
            } else {
                const { data: openEntry, error: findErr } = await supabase
                    .from(table).select('id').eq('student_id', student.id).is('time_out', null)
                    .order('time_in', { ascending: false }).limit(1).single()
                if (findErr || !openEntry) {
                    const { data: lastOut } = await supabase
                        .from(table).select('id, time_out').eq('student_id', student.id)
                        .not('time_out', 'is', null).order('time_out', { ascending: false }).limit(1)
                    if (lastOut && lastOut.length > 0) {
                        setScanModal({ type: 'warning', name: student.full_name, message: 'Already checked out! No active check-in found.' })
                    } else {
                        setScanModal({ type: 'error', name: student.full_name, message: 'No active check-in found for this person.' })
                    }
                    return
                }
                const { error: updateErr } = await supabase
                    .from(table).update({ time_out: new Date().toISOString() }).eq('id', openEntry.id)
                if (updateErr) throw updateErr

                // Play success beep
                playBeep();

                setScanModal({ type: 'info', name: student.full_name, message: `👋 Checked Out! (${roleLabel})` })
            }
        } catch (err) {
            setScanModal({ type: 'error', name: '', message: err.message || 'An error occurred.' })
        }
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

    // Staff filter logic (moved from render scope)
    const staffEventDays = [...new Set(staffLogbook.map((r) => dayKey(r.time_in)).filter(Boolean))].sort().reverse()
    const filteredStaff = staffLogbook.filter((r) => {
        if (staffDayFilter !== 'all' && dayKey(r.time_in) !== staffDayFilter) return false
        if (staffLogFilter === 'in') return !r.time_out
        if (staffLogFilter === 'out') return !!r.time_out
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

    const exportStaffLabel = staffDayFilter === 'all' ? 'All Days' : fmtDateFull(staffDayFilter + 'T00:00:00')

    const exportExcelStaff = () => {
        const rows = filteredStaff.map((r, i) => ({
            '#': i + 1,
            'Name': r.students?.full_name || '',
            'Role': r.students?.role ? r.students.role.charAt(0).toUpperCase() + r.students.role.slice(1) : '',
            'Team': r.students?.team_name || '',
            'Date': fmtDate(r.time_in),
            'Time In': fmtTime(r.time_in),
            'Time Out': fmtTime(r.time_out),
            'Status': r.time_out ? 'Checked Out' : 'Present',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Staff Attendance')
        XLSX.writeFile(wb, `IT-Week-Staff-${staffDayFilter}.xlsx`)
    }

    const exportPDFStaff = () => {
        const doc = new jsPDF()
        doc.setFontSize(16)
        doc.text('IT Week Staff Event Attendance', 14, 18)
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text(`${exportStaffLabel} · Exported ${new Date().toLocaleString('en-PH', { timeZone: TZ })}`, 14, 26)
        autoTable(doc, {
            startY: 32,
            head: [['#', 'Name', 'Role', 'Team', 'Date', 'Time In', 'Time Out', 'Status']],
            body: filteredStaff.map((r, i) => [
                i + 1,
                r.students?.full_name || '',
                r.students?.role ? r.students.role.charAt(0).toUpperCase() + r.students.role.slice(1) : '',
                r.students?.team_name || '',
                fmtDate(r.time_in),
                fmtTime(r.time_in),
                fmtTime(r.time_out),
                r.time_out ? 'Checked Out' : 'Present',
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [123, 28, 28] }, // Maroon for staff
            alternateRowStyles: { fillColor: [253, 240, 240] },
        })
        doc.setFontSize(8)
        doc.setTextColor(180)
        doc.text('Built by Lou Vincent Baroro', 14, doc.internal.pageSize.height - 8)
        doc.save(`IT-Week-Staff-${staffDayFilter}.pdf`)
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
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#6366f1', lineHeight: 1, letterSpacing: '-0.02em' }}>{scanCount}</p>
                            <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Scans</p>
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
                                            <button onClick={() => { setMenuOpen(false); }}
                                                style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: '#f8fafc', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                                Scanner & Logs
                                            </button>
                                            <button onClick={() => { setMenuOpen(false); stopScanner(); onNavigateManageData && onNavigateManageData(); }}
                                                style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                Manage Data
                                            </button>
                                            <button onClick={() => { setMenuOpen(false); stopScanner(); onNavigateAudit && onNavigateAudit(); }}
                                                style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Audit & Users
                                            </button>
                                            <button onClick={() => { setMenuOpen(false); stopScanner(); onNavigateTally && onNavigateTally(); }}
                                                style={{ width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                Point Tally
                                            </button>
                                            <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }} />
                                            <button onClick={() => { setMenuOpen(false); stopScanner(); onLogout(); }}
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
            </div>

            {/* Tab Nav Container */}
            <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '1rem 1rem 0', display: 'flex', justifyContent: 'center' }}>
                <div className="tab-nav">
                    {[
                        {
                            id: 'scanner', label: 'Scanner',
                            icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        },
                        {
                            id: 'logbook', label: 'Students',
                            icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        },
                        {
                            id: 'staff', label: 'Staff',
                            icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
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
                                <div className="mode-toggle" style={{ width: '100%', gap: '0.5rem', padding: '0.375rem' }}>
                                    <button className={`mode-toggle-btn ${mode === 'time-in' ? 'active' : ''}`} onClick={() => setMode('time-in')} style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.1rem' }}>⏰</span>
                                        <span>Time In</span>
                                    </button>
                                    <button className={`mode-toggle-btn ${mode === 'time-out' ? 'active' : ''}`} onClick={() => setMode('time-out')} style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.1rem' }}>🚪</span>
                                        <span>Time Out</span>
                                    </button>
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

                            {/* Global Dashboard Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '1rem' }}>
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <div style={{ background: '#eef2ff', width: '3rem', height: '3rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Students</p>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{users.length}</p>
                                    </div>
                                </div>
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <div style={{ background: '#dcfce7', width: '3rem', height: '3rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Checked In Today</p>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{scanCount}</p>
                                    </div>
                                </div>
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <div style={{ background: '#fef3c7', width: '3rem', height: '3rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Teams</p>
                                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{teams.length}</p>
                                    </div>
                                </div>
                            </div>

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

                    {/* ── STAFF LOGBOOK TAB ────────────────────────────────── */}
                    {activeTab === 'staff' && (
                        <motion.div key="staff" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Staff Day selector tabs */}
                            {staffEventDays.length > 0 && (
                                <div className="card" style={{ padding: '1rem' }}>
                                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>Select Day</p>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button onClick={() => setStaffDayFilter('all')}
                                            style={{
                                                padding: '0.4rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', minHeight: '36px',
                                                borderColor: staffDayFilter === 'all' ? '#7B1C1C' : '#e2e8f0',
                                                background: staffDayFilter === 'all' ? '#fdf0f0' : 'white',
                                                color: staffDayFilter === 'all' ? '#7B1C1C' : '#64748b',
                                            }}>📅 All Days</button>
                                        {staffEventDays.map((d) => (
                                            <button key={d} onClick={() => setStaffDayFilter(d)}
                                                style={{
                                                    padding: '0.4rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', minHeight: '36px',
                                                    borderColor: staffDayFilter === d ? '#7B1C1C' : '#e2e8f0',
                                                    background: staffDayFilter === d ? '#fdf0f0' : 'white',
                                                    color: staffDayFilter === d ? '#7B1C1C' : '#64748b',
                                                }}>{fmtDateFull(d + 'T00:00:00')}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
                                {[
                                    { label: 'Total', value: filteredStaff.length, color: '#7B1C1C' },
                                    { label: 'Present', value: filteredStaff.filter(r => !r.time_out).length, color: '#16a34a' },
                                    { label: 'Done', value: filteredStaff.filter(r => !!r.time_out).length, color: '#64748b' },
                                ].map((s) => (
                                    <div key={s.label} className="card" style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
                                        <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Filters */}
                            <div className="card" style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                        {[{ id: 'all', label: 'All' }, { id: 'in', label: '🟢 Present' }, { id: 'out', label: '⚪ Done' }].map((f) => (
                                            <button key={f.id} onClick={() => setStaffLogFilter(f.id)}
                                                style={{ padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', minHeight: '34px', background: staffLogFilter === f.id ? '#7B1C1C' : '#f1f5f9', color: staffLogFilter === f.id ? 'white' : '#64748b' }}>
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button onClick={fetchStaffLogbook}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Refresh
                                        </button>
                                        <button onClick={exportExcelStaff} disabled={filteredStaff.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: filteredStaff.length === 0 ? '#f1f5f9' : '#dcfce7', border: '1.5px solid', borderColor: filteredStaff.length === 0 ? '#e2e8f0' : '#86efac', color: filteredStaff.length === 0 ? '#94a3b8' : '#16a34a', fontSize: '0.75rem', fontWeight: 700, cursor: filteredStaff.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                            📊 Excel
                                        </button>
                                        <button onClick={exportPDFStaff} disabled={filteredStaff.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: filteredStaff.length === 0 ? '#f1f5f9' : '#fee2e2', border: '1.5px solid', borderColor: filteredStaff.length === 0 ? '#e2e8f0' : '#fca5a5', color: filteredStaff.length === 0 ? '#94a3b8' : '#dc2626', fontSize: '0.75rem', fontWeight: 700, cursor: filteredStaff.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                            📄 PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="card" style={{ overflow: 'hidden' }}>
                                {staffLogLoading ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <p style={{ fontSize: '0.875rem' }}>Loading staff logbook…</p>
                                    </div>
                                ) : filteredStaff.length === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>No staff records yet</p>
                                        <p style={{ fontSize: '0.8125rem' }}>Scan staff QR codes (Leader, Facilitator, Executive, Officer) to populate this log</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                    {['#', 'Name', 'Role', 'Team', 'Date', 'Time In', 'Time Out', 'Status'].map((h, hi) => (
                                                        <th key={h} style={{ padding: '0.625rem 0.875rem', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', textAlign: hi === 0 || hi === 7 ? 'center' : 'left' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStaff.map((row, i) => {
                                                    const tdBase = { padding: '0.75rem 0.875rem', borderBottom: i < filteredStaff.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa', verticalAlign: 'middle' }
                                                    const roleColor =
                                                        row.students?.role === 'leader' ? { bg: '#fdf0f0', text: '#7B1C1C' } :
                                                            row.students?.role === 'facilitator' ? { bg: '#fefce8', text: '#854d0e' } :
                                                                row.students?.role === 'executive' ? { bg: '#ecfdf5', text: '#059669' } :
                                                                    row.students?.role === 'officer' ? { bg: '#eff6ff', text: '#2563eb' } :
                                                                        { bg: '#f1f5f9', text: '#475569' }
                                                    return (
                                                        <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}>
                                                            <td style={{ ...tdBase, textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>{i + 1}</td>
                                                            <td style={{ ...tdBase, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{row.students?.full_name}</td>
                                                            <td style={tdBase}>
                                                                <span style={{ background: roleColor.bg, color: roleColor.text, fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '99px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                                                                    {row.students?.role}
                                                                </span>
                                                            </td>
                                                            <td style={tdBase}>
                                                                <span style={{ background: '#eef2ff', color: '#4f46e5', fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '99px', whiteSpace: 'nowrap' }}>
                                                                    {row.students?.team_name}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...tdBase, color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{fmtDate(row.time_in)}</td>
                                                            <td style={{ ...tdBase, color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_in)}</td>
                                                            <td style={{ ...tdBase, color: row.time_out ? '#0f172a' : '#cbd5e1', fontWeight: row.time_out ? 600 : 400, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_out)}</td>
                                                            <td style={{ ...tdBase, textAlign: 'center' }}>
                                                                <span style={{ display: 'inline-block', padding: '0.2rem 0.625rem', borderRadius: '99px', fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap', background: row.time_out ? '#f1f5f9' : '#dcfce7', color: row.time_out ? '#64748b' : '#16a34a', border: `1px solid ${row.time_out ? '#e2e8f0' : '#86efac'}` }}>
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

                    {/* Removed Teams, Scores, and Users Tabs -> relocated to AdminManageData */}
                </AnimatePresence>
            </div>
        </div>
    )
}
