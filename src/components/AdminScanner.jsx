import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function AdminScanner({ onLogout, onNavigateManageData, onNavigateAudit, onNavigateTally, onNavigateHistory }) {
    const navigate = useNavigate()
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
    const [currentPage, setCurrentPage] = useState(1)
    const [initialLogJump, setInitialLogJump] = useState(true)
    const pageSize = 30

    // Staff Logbook state (leaders + facilitators)
    const [staffLogbook, setStaffLogbook] = useState([])
    const [staffLogLoading, setStaffLogLoading] = useState(false)
    const [staffLogFilter, setStaffLogFilter] = useState('all')
    const [staffDayFilter, setStaffDayFilter] = useState('all')
    const [staffPage, setStaffPage] = useState(1)
    const [initialStaffJump, setInitialStaffJump] = useState(true)

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
                .order('time_in', { ascending: true })
            if (error) throw error
            setLogbook(data || [])
            if (initialLogJump && data && data.length > pageSize) {
                const lp = Math.ceil(data.length / pageSize)
                setCurrentPage(lp)
                setInitialLogJump(false)
            }
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

    useEffect(() => { setCurrentPage(1) }, [logFilter, dayFilter, activeTab])
    useEffect(() => { setStaffPage(1) }, [staffLogFilter, staffDayFilter, activeTab])

    // ─── Staff Logbook ───────────────────────────────────────────────────────────
    const fetchStaffLogbook = useCallback(async () => {
        if (!supabase) return
        setStaffLogLoading(true)
        try {
            const { data, error } = await supabase
                .from('staff_logbook')
                .select('id, time_in, time_out, students(id, full_name, team_name, uuid, role)')
                .order('time_in', { ascending: true })
            if (error) throw error
            setStaffLogbook(data || [])
            if (initialStaffJump && data && data.length > pageSize) {
                const lp = Math.ceil(data.length / pageSize)
                setStaffPage(lp)
                setInitialStaffJump(false)
            }
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

    const totalPages = Math.ceil(filteredLog.length / pageSize)
    const paginatedLog = filteredLog.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const staffTotalPages = Math.ceil(filteredStaff.length / pageSize)
    const paginatedStaff = filteredStaff.slice((staffPage - 1) * pageSize, staffPage * pageSize)

    // ─── Export helpers ─────────────────────────────────────────────────────────
    const exportLabel = dayFilter === 'all' ? 'All Days' : fmtDateFull(dayFilter + 'T00:00:00')

    const exportExcel = () => {
        const chunkSize = 40
        const numChunks = Math.ceil(filteredLog.length / chunkSize)
        for (let i = 0; i < numChunks; i++) {
            const chunk = filteredLog.slice(i * chunkSize, (i + 1) * chunkSize)
            const rows = chunk.map((r, idx) => ({
                '#': (i * chunkSize) + idx + 1,
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
            const suffix = numChunks > 1 ? `_Part${i + 1}` : ''
            XLSX.writeFile(wb, `IT-Week-Attendance-${dayFilter}${suffix}.xlsx`)
        }
    }

    const exportPDF = () => {
        const chunkSize = 40
        const numChunks = Math.ceil(filteredLog.length / chunkSize)
        for (let i = 0; i < numChunks; i++) {
            const chunk = filteredLog.slice(i * chunkSize, (i + 1) * chunkSize)
            const doc = new jsPDF()
            doc.setFontSize(16)
            doc.text('IT Week Event Attendance', 14, 18)
            doc.setFontSize(10)
            doc.setTextColor(100)
            const suffix = numChunks > 1 ? ` (Part ${i + 1} of ${numChunks})` : ''
            doc.text(`${exportLabel}${suffix} · Exported ${new Date().toLocaleString('en-PH', { timeZone: TZ })}`, 14, 26)
            autoTable(doc, {
                startY: 32,
                head: [['#', 'Name', 'Team', 'Date', 'Time In', 'Time Out', 'Status']],
                body: chunk.map((r, idx) => [
                    (i * chunkSize) + idx + 1,
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
            const fileSuffix = numChunks > 1 ? `_Part${i + 1}` : ''
            doc.save(`IT-Week-Attendance-${dayFilter}${fileSuffix}.pdf`)
        }
    }

    const exportStaffLabel = staffDayFilter === 'all' ? 'All Days' : fmtDateFull(staffDayFilter + 'T00:00:00')

    const exportExcelStaff = () => {
        const chunkSize = 40
        const numChunks = Math.ceil(filteredStaff.length / chunkSize)
        for (let i = 0; i < numChunks; i++) {
            const chunk = filteredStaff.slice(i * chunkSize, (i + 1) * chunkSize)
            const rows = chunk.map((r, idx) => ({
                '#': (i * chunkSize) + idx + 1,
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
            const suffix = numChunks > 1 ? `_Part${i + 1}` : ''
            XLSX.writeFile(wb, `IT-Week-Staff-${staffDayFilter}${suffix}.xlsx`)
        }
    }

    const exportPDFStaff = () => {
        const chunkSize = 40
        const numChunks = Math.ceil(filteredStaff.length / chunkSize)
        for (let i = 0; i < numChunks; i++) {
            const chunk = filteredStaff.slice(i * chunkSize, (i + 1) * chunkSize)
            const doc = new jsPDF()
            doc.setFontSize(16)
            doc.text('IT Week Staff Event Attendance', 14, 18)
            doc.setFontSize(10)
            doc.setTextColor(100)
            const suffix = numChunks > 1 ? ` (Part ${i + 1} of ${numChunks})` : ''
            doc.text(`${exportStaffLabel}${suffix} · Exported ${new Date().toLocaleString('en-PH', { timeZone: TZ })}`, 14, 26)
            autoTable(doc, {
                startY: 32,
                head: [['#', 'Name', 'Role', 'Team', 'Date', 'Time In', 'Time Out', 'Status']],
                body: chunk.map((r, idx) => [
                    (i * chunkSize) + idx + 1,
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
            const fileSuffix = numChunks > 1 ? `_Part${i + 1}` : ''
            doc.save(`IT-Week-Staff-${staffDayFilter}${fileSuffix}.pdf`)
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
                .tab-nav-luxury { display: flex; background: rgba(0,0,0,0.3); padding: 0.375rem; border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.05); gap: 0.5rem; overflow-x: auto; scrollbar-width: none; }
                .tab-btn-luxury { padding: 0.625rem 1.25rem; border-radius: 0.875rem; border: none; background: transparent; color: rgba(255,255,255,0.4); font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
                .tab-btn-luxury.active { background: rgba(201,168,76,0.1); color: #C9A84C; border: 1px solid rgba(201,168,76,0.25); box-shadow: 0 4px 15px rgba(201,168,76,0.1); }
                .luxury-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; }
                .luxury-table-row { transition: all 0.3s ease; border-bottom: 1px solid rgba(255,255,255,0.03); }
                .luxury-table-row:hover { background: rgba(255,255,255,0.02); }
                
                @media (max-width: 768px) {
                    .desktop-table { display: none; }
                    .mobile-cards { display: block; }
                    .mobile-hide { display: none !important; }
                    .tab-nav-luxury { 
                        display: grid !important; 
                        grid-template-columns: repeat(3, 1fr) !important; 
                        width: 100% !important; 
                        gap: 0.25rem !important; 
                        overflow: hidden !important; 
                    }
                    .tab-btn-luxury { 
                        padding: 0.625rem 0.25rem !important; 
                        font-size: 0.75rem !important; 
                        justify-content: center !important; 
                        gap: 0.25rem !important;
                    }
                }
                @media (min-width: 769px) {
                    .desktop-table { display: table; }
                    .mobile-cards { display: none; }
                }

                @keyframes pulse-gold {
                    0% { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(201, 168, 76, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0); }
                }
                .live-indicator { animation: pulse-gold 2s infinite; }
            `}</style>

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

            {/* Premium Header */}
            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{
                            width: '3.25rem', height: '3.25rem', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(201,168,76,0.3)',
                            border: '2px solid rgba(201,168,76,0.5)',
                            flexShrink: 0,
                            overflow: 'hidden'
                        }}>
                            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1, margin: 0 }}>ATTENDANCE SCANNER</p>
                                <div className="mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                    <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                    <span style={{ color: '#10b981', fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.05em' }}>ACTIVE</span>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.625rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.125rem 0 0' }}>Manage Student & Staff Attendance</p>
                        </div>
                    </div>
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

                                        <button onClick={() => { setMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'rgba(201,168,76,0.1)', fontSize: '0.8125rem', fontWeight: 700, color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

            {/* Tab Nav Container */}
            <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem 0', display: 'flex', justifyContent: 'center', width: '100%' }}>
                <div className="tab-nav-luxury">
                    {[
                        {
                            id: 'scanner', label: 'Scanner',
                            icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        },
                        {
                            id: 'logbook', label: 'Students',
                            icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        },
                        {
                            id: 'staff', label: 'Staff',
                            icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                        },
                    ].map((tab) => (
                        <button key={tab.id} className={`tab-btn-luxury ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.icon}
                            {tab.label}
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
                            <div className="luxury-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <p style={{ fontWeight: 800, color: 'white', fontSize: '1rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                            <div style={{ width: '4px', height: '1.125rem', background: '#C9A84C', borderRadius: '2px' }} />
                                            SELECT ACTION
                                        </p>
                                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem', fontWeight: 600 }}>{mode === 'time-in' ? 'Ready to Check Students In' : 'Ready to Check Students Out'}</p>
                                    </div>
                                </div>
                                <div className="mode-toggle" style={{ width: '100%', gap: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem' }}>
                                    <button className={`mode-toggle-btn ${mode === 'time-in' ? 'active' : ''}`} onClick={() => setMode('time-in')}
                                        style={{
                                            minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                                            background: mode === 'time-in' ? 'rgba(201,168,76,0.1)' : 'transparent',
                                            color: mode === 'time-in' ? '#C9A84C' : 'rgba(255,255,255,0.3)',
                                            border: mode === 'time-in' ? '1px solid rgba(201,168,76,0.2)' : 'none'
                                        }}>
                                        <span style={{ fontSize: '1.1rem' }}>📥</span>
                                        <span style={{ fontWeight: 800, letterSpacing: '0.02em' }}>CHECK-IN MODE</span>
                                    </button>
                                    <button className={`mode-toggle-btn ${mode === 'time-out' ? 'active' : ''}`} onClick={() => setMode('time-out')}
                                        style={{
                                            minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                                            background: mode === 'time-out' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: mode === 'time-out' ? 'white' : 'rgba(255,255,255,0.3)',
                                            border: mode === 'time-out' ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                        }}>
                                        <span style={{ fontSize: '1.1rem' }}>📤</span>
                                        <span style={{ fontWeight: 800, letterSpacing: '0.02em' }}>CHECK-OUT MODE</span>
                                    </button>
                                </div>
                            </div>

                            {/* Camera */}
                            <div className="luxury-card" style={{ overflow: 'hidden' }}>
                                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div className={scanning ? "live-indicator" : ""} style={{ width: 10, height: 10, borderRadius: '50%', background: scanning ? '#C9A84C' : 'rgba(255,255,255,0.1)' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: scanning ? '#C9A84C' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {scanning ? 'Scanner Active' : 'Scanner Idle'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={scanning ? stopScanner : startScanner}
                                        style={{
                                            padding: '0.625rem 1.5rem', borderRadius: '0.875rem', fontWeight: 900, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
                                            background: scanning ? 'rgba(239, 68, 68, 0.1)' : 'linear-gradient(135deg, #7B1C1C, #C9A84C)',
                                            color: scanning ? '#ef4444' : 'white',
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                            border: scanning ? '1px solid rgba(239, 68, 68, 0.2)' : 'none'
                                        }}
                                    >{scanning ? 'Stop Scanner' : 'Open Scanner'}</button>
                                </div>
                                <div style={{ background: '#000', position: 'relative', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div id="qr-reader" style={{ width: '100%', maxWidth: '500px' }} />
                                    {!scanning && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}>
                                            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <circle cx="12" cy="13" r="3" />
                                                </svg>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.02em' }}>Waiting for a scan...</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mini logbook preview (last 5) */}
                            {logbook.length > 0 && (
                                <div className="luxury-card" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                        <p style={{ fontWeight: 900, color: 'white', fontSize: '0.8125rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>RECENT SCANS</p>
                                        <button onClick={() => setActiveTab('logbook')} style={{ fontSize: '0.75rem', color: '#C9A84C', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            VIEW ALL LOGS →
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {logbook.slice(0, 3).map((row) => (
                                            <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                                    <div style={{
                                                        width: '2.5rem', height: '1.25rem', borderRadius: '4px', background: row.time_out ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                        border: `1px solid ${row.time_out ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 900, color: row.time_out ? '#ef4444' : '#10b981'
                                                    }}>
                                                        {row.time_out ? 'OUT' : 'IN'}
                                                    </div>
                                                    <div>
                                                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'white', lineHeight: 1.2 }}>{row.students?.full_name}</p>
                                                        <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{row.students?.team_name}</p>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Global Dashboard Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '1.25rem' }}>
                                {[
                                    { label: 'Total Students', value: users.length, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: '#C9A84C' },
                                    { label: 'Check-ins Today', value: scanCount, icon: 'M5 13l4 4L19 7', color: '#10b981' },
                                    { label: 'Total Teams', value: teams.length, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', color: '#6366f1' },
                                ].map((s, idx) => (
                                    <div key={idx} className="luxury-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                        <div style={{ background: `${s.color}10`, width: '3.5rem', height: '3.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, border: `1px solid ${s.color}20` }}>
                                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={s.icon} /></svg>
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.6875rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
                                            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{s.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Day selector tabs */}
                            {eventDays.length > 0 && (
                                <div className="luxury-card" style={{ padding: '1.25rem' }}>
                                    <p style={{ fontSize: '0.6875rem', fontWeight: 900, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.875rem' }}>FILTER BY DATE</p>
                                    <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                                        <button onClick={() => setDayFilter('all')}
                                            style={{
                                                padding: '0.5rem 1.25rem', borderRadius: '0.875rem', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                                                borderColor: dayFilter === 'all' ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                                                background: dayFilter === 'all' ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                                                color: dayFilter === 'all' ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                                                transition: 'all 0.3s ease'
                                            }}>ALL RECORDS</button>
                                        {eventDays.map((d) => (
                                            <button key={d} onClick={() => setDayFilter(d)}
                                                style={{
                                                    padding: '0.5rem 1.25rem', borderRadius: '0.875rem', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                                                    borderColor: dayFilter === d ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                                                    background: dayFilter === d ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                                                    color: dayFilter === d ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                                                    transition: 'all 0.3s ease'
                                                }}>{fmtDateFull(d + 'T00:00:00').toUpperCase()}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Filter + Refresh + Export */}
                            <div className="luxury-card pattern-circuits" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.375rem', borderRadius: '1rem', gap: '0.375rem' }}>
                                        {[{ id: 'all', label: 'All' }, { id: 'in', label: 'Present' }, { id: 'out', label: 'Completed' }].map((f) => (
                                            <button key={f.id} onClick={() => setLogFilter(f.id)}
                                                style={{
                                                    padding: '0.5rem 1.125rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                                    background: logFilter === f.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                    color: logFilter === f.id ? 'white' : 'rgba(255,255,255,0.3)',
                                                    transition: 'all 0.2s'
                                                }}>{f.label.toUpperCase()}</button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button onClick={fetchLogbook}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Refresh
                                        </button>
                                        <button onClick={exportExcel} disabled={filteredLog.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.875rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.75rem', fontWeight: 800, cursor: filteredLog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: filteredLog.length === 0 ? 0.4 : 1 }}>
                                            EXCEL
                                        </button>
                                        <button onClick={exportPDF} disabled={filteredLog.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: filteredLog.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: filteredLog.length === 0 ? 0.4 : 1 }}>
                                            PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Logbook entries */}
                            <div className="luxury-card">
                                {logLoading ? (
                                    <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                        <div className="skeleton-gold" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto 1.5rem' }} />
                                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em' }}>LOADING RECORDS...</p>
                                    </div>
                                ) : filteredLog.length === 0 ? (
                                    <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>NO RECORDS FOUND</p>
                                        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>No entry records detected for this day.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table */}
                                        <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {['#', 'NAME', 'DESIGNATION', 'TIME IN', 'TIME OUT', 'STATUS'].map((h, hi) => (
                                                        <th key={h} style={{
                                                            padding: '1.25rem 1.5rem',
                                                            fontSize: '0.6875rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)',
                                                            textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: hi === 5 ? 'center' : 'left',
                                                            width: hi === 0 ? '50px' : 'auto'
                                                        }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedLog.map((row, i) => {
                                                    const globalIndex = (currentPage - 1) * pageSize + i + 1
                                                    return (
                                                        <motion.tr key={row.id || `empty-std-${i}`} className="luxury-table-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>{globalIndex}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                                <p style={{ fontWeight: 800, color: 'white', fontSize: '0.9375rem' }}>{row.students?.full_name}</p>
                                                                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{fmtDate(row.time_in)}</p>
                                                            </td>
                                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                                <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontSize: '0.6875rem', fontWeight: 900, padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.15)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    {row.students?.team_name}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_in)}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, color: row.time_out ? 'white' : 'rgba(255,255,255,0.1)', fontVariantNumeric: 'tabular-nums' }}>{row.time_out ? fmtTime(row.time_out) : '--:--'}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                                                <div style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.875rem', borderRadius: '99px',
                                                                    fontSize: '0.6875rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                                    background: row.time_out ? 'rgba(255,255,255,0.03)' : 'rgba(16, 185, 129, 0.1)',
                                                                    color: row.time_out ? 'rgba(255,255,255,0.4)' : '#10b981',
                                                                    border: `1px solid ${row.time_out ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.2)'}`
                                                                }}>
                                                                    {!row.time_out && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />}
                                                                    {row.time_out ? 'LOGGED' : 'SESSION'}
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    )
                                                })}
                                                {/* Placeholders */}
                                                {Array.from({ length: pageSize - paginatedLog.length }).map((_, pi) => (
                                                    <tr key={`filler-std-p-${pi}`} style={{ height: '3.75rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                        <td colSpan={6} style={{ padding: '0 1.5rem', opacity: 0.03 }}>
                                                            <div style={{ height: '0.4rem', background: 'white', borderRadius: '4px', width: '100%' }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Mobile Cards */}
                                        <div className="mobile-cards" style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {paginatedLog.map((row, i) => (
                                                    <motion.div key={row.id || `mob-std-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                            <div>
                                                                <p style={{ fontWeight: 900, color: 'white', fontSize: '1rem', letterSpacing: '-0.01em' }}>{row.students?.full_name}</p>
                                                                <p style={{ fontSize: '0.75rem', color: '#C9A84C', fontWeight: 800 }}>{row.students?.team_name?.toUpperCase()}</p>
                                                            </div>
                                                            <div style={{
                                                                padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase',
                                                                background: row.time_out ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.1)',
                                                                color: row.time_out ? 'rgba(255,255,255,0.4)' : '#10b981',
                                                                border: `1px solid ${row.time_out ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.2)'}`
                                                            }}>
                                                                {row.time_out ? 'LOGGED' : 'ACTIVE'}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.875rem' }}>
                                                            <div>
                                                                <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>ACCESS TIME</p>
                                                                <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'white' }}>{fmtTime(row.time_in)}</p>
                                                            </div>
                                                            <div>
                                                                <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>EXIT TIME</p>
                                                                <p style={{ fontSize: '0.875rem', fontWeight: 800, color: row.time_out ? 'white' : 'rgba(255,255,255,0.1)' }}>{row.time_out ? fmtTime(row.time_out) : '--:--'}</p>
                                                            </div>
                                                        </div>
                                                        <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginTop: '0.875rem', textAlign: 'right' }}>{fmtDateFull(row.time_in)}</p>
                                                    </motion.div>
                                                ))}
                                                {/* Placeholders */}
                                                {Array.from({ length: pageSize - paginatedLog.length }).map((_, pi) => (
                                                    <div key={`filler-mob-std-${pi}`}
                                                        style={{ height: '8rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ width: '30%', height: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 0 && (
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
                                                    PAGE <span style={{ color: '#C9A84C' }}>{currentPage}</span> / {totalPages}
                                                </span>
                                                <button
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === totalPages ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
                    )}

                    {/* ── STAFF LOGBOOK TAB ────────────────────────────────── */}
                    {activeTab === 'staff' && (
                        <motion.div key="staff" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Staff Day selector tabs */}
                            {staffEventDays.length > 0 && (
                                <div className="luxury-card pattern-circuits" style={{ padding: '1.25rem' }}>
                                    <p style={{ fontSize: '0.6875rem', fontWeight: 900, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.875rem' }}>FILTER BY DATE</p>
                                    <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                                        <button onClick={() => setStaffDayFilter('all')}
                                            style={{
                                                padding: '0.5rem 1.25rem', borderRadius: '0.875rem', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                                                borderColor: staffDayFilter === 'all' ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                                                background: staffDayFilter === 'all' ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                                                color: staffDayFilter === 'all' ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                                                transition: 'all 0.3s ease'
                                            }}>ALL RECORDS</button>
                                        {staffEventDays.map((d) => (
                                            <button key={d} onClick={() => setStaffDayFilter(d)}
                                                style={{
                                                    padding: '0.5rem 1.25rem', borderRadius: '0.875rem', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                                                    borderColor: staffDayFilter === d ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                                                    background: staffDayFilter === d ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                                                    color: staffDayFilter === d ? '#C9A84C' : 'rgba(255,255,255,0.4)',
                                                    transition: 'all 0.3s ease'
                                                }}>{fmtDateFull(d + 'T00:00:00').toUpperCase()}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Filters */}
                            <div className="luxury-card" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.375rem', borderRadius: '1rem', gap: '0.375rem' }}>
                                        {[{ id: 'all', label: 'All' }, { id: 'in', label: 'Present' }, { id: 'out', label: 'Completed' }].map((f) => (
                                            <button key={f.id} onClick={() => setStaffLogFilter(f.id)}
                                                style={{ padding: '0.5rem 1.125rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: staffLogFilter === f.id ? 'rgba(255,255,255,0.08)' : 'transparent', color: staffLogFilter === f.id ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s' }}>
                                                {f.label.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button onClick={fetchStaffLogbook}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            REFRESH
                                        </button>
                                        <button onClick={exportExcelStaff} disabled={filteredStaff.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.875rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.75rem', fontWeight: 800, cursor: filteredStaff.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: filteredStaff.length === 0 ? 0.4 : 1 }}>
                                            EXCEL
                                        </button>
                                        <button onClick={exportPDFStaff} disabled={filteredStaff.length === 0}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 800, cursor: filteredStaff.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: filteredStaff.length === 0 ? 0.4 : 1 }}>
                                            PDF
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="luxury-card">
                                {staffLogLoading ? (
                                    <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em' }}>DECRYPTING STAFF ARCHIVE...</p>
                                    </div>
                                ) : filteredStaff.length === 0 ? (
                                    <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '1.125rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>NO RECORDS FOUND</p>
                                        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>No staff activity detected for this day.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table */}
                                        <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {['#', 'NAME', 'ROLE', 'TEAM', 'TIME IN', 'TIME OUT', 'STATUS'].map((h, hi) => (
                                                        <th key={h} style={{ padding: '1.25rem 1.5rem', fontSize: '0.6875rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: hi === 6 ? 'center' : 'left', width: hi === 0 ? '50px' : 'auto' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedStaff.map((row, i) => {
                                                    const globalIndex = (staffPage - 1) * pageSize + i + 1
                                                    const roleColor =
                                                        row.students?.role === 'leader' ? '#ef4444' :
                                                            row.students?.role === 'facilitator' ? '#f59e0b' :
                                                                row.students?.role === 'executive' ? '#10b981' :
                                                                    row.students?.role === 'officer' ? '#6366f1' :
                                                                        '#94a3b8'
                                                    return (
                                                        <motion.tr key={row.id || `empty-stf-${i}`} className="luxury-table-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>{globalIndex}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                                <p style={{ fontWeight: 800, color: 'white', fontSize: '0.9375rem' }}>{row.students?.full_name}</p>
                                                                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{fmtDate(row.time_in)}</p>
                                                            </td>
                                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                                <span style={{ background: `${roleColor}10`, color: roleColor, fontSize: '0.6875rem', fontWeight: 900, padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${roleColor}20`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    {row.students?.role}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>{row.students?.team_name}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.time_in)}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, color: row.time_out ? 'white' : 'rgba(255,255,255,0.1)', fontVariantNumeric: 'tabular-nums' }}>{row.time_out ? fmtTime(row.time_out) : '--:--'}</td>
                                                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                                                                <div style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.875rem', borderRadius: '99px',
                                                                    fontSize: '0.6875rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                                    background: row.time_out ? 'rgba(255,255,255,0.03)' : 'rgba(16, 185, 129, 0.1)',
                                                                    color: row.time_out ? 'rgba(255,255,255,0.4)' : '#10b981',
                                                                    border: `1px solid ${row.time_out ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.2)'}`
                                                                }}>
                                                                    {row.time_out ? 'LOGGED' : 'SESSION'}
                                                                </div>
                                                            </td>
                                                        </motion.tr>
                                                    )
                                                })}
                                                {/* Placeholders */}
                                                {Array.from({ length: pageSize - paginatedStaff.length }).map((_, pi) => (
                                                    <tr key={`filler-stf-p-${pi}`} style={{ height: '3.75rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                        <td colSpan={7} style={{ padding: '0 1.5rem', opacity: 0.03 }}>
                                                            <div style={{ height: '0.4rem', background: 'white', borderRadius: '4px', width: '100%' }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Mobile Cards */}
                                        <div className="mobile-cards" style={{ padding: '1.25rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {paginatedStaff.map((row, i) => {
                                                    const roleColor =
                                                        row.students?.role === 'leader' ? '#ef4444' :
                                                            row.students?.role === 'facilitator' ? '#f59e0b' :
                                                                row.students?.role === 'executive' ? '#10b981' :
                                                                    row.students?.role === 'officer' ? '#6366f1' :
                                                                        '#94a3b8'
                                                    return (
                                                        <motion.div key={row.id || `mob-stf-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1.25rem', padding: '1.25rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                                <div>
                                                                    <p style={{ fontWeight: 900, color: 'white', fontSize: '1rem', letterSpacing: '-0.01em' }}>{row.students?.full_name}</p>
                                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                                        <span style={{ color: roleColor, fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase' }}>{row.students?.role}</span>
                                                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.625rem', fontWeight: 800 }}>•</span>
                                                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.625rem', fontWeight: 800 }}>{row.students?.team_name.toUpperCase()}</span>
                                                                    </div>
                                                                </div>
                                                                <div style={{
                                                                    padding: '0.35rem 0.75rem', borderRadius: '99px', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase',
                                                                    background: row.time_out ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.1)',
                                                                    color: row.time_out ? 'rgba(255,255,255,0.4)' : '#10b981',
                                                                    border: `1px solid ${row.time_out ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.2)'}`
                                                                }}>
                                                                    {row.time_out ? 'LOGGED' : 'ACTIVE'}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.875rem' }}>
                                                                <div>
                                                                    <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>ACCESS TIME</p>
                                                                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'white' }}>{fmtTime(row.time_in)}</p>
                                                                </div>
                                                                <div>
                                                                    <p style={{ fontSize: '0.625rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>EXIT TIME</p>
                                                                    <p style={{ fontSize: '0.875rem', fontWeight: 800, color: row.time_out ? 'white' : 'rgba(255,255,255,0.1)' }}>{row.time_out ? fmtTime(row.time_out) : '--:--'}</p>
                                                                </div>
                                                            </div>
                                                            <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginTop: '0.875rem', textAlign: 'right' }}>{fmtDateFull(row.time_in)}</p>
                                                        </motion.div>
                                                    )
                                                })}
                                                {/* Placeholders */}
                                                {Array.from({ length: pageSize - paginatedStaff.length }).map((_, pi) => (
                                                    <div key={`filler-mob-stf-${pi}`}
                                                        style={{ height: '8rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ width: '30%', height: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Pagination Controls */}
                                        {staffTotalPages > 0 && (
                                            <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                                                <button
                                                    disabled={staffPage === 1}
                                                    onClick={() => setStaffPage(prev => Math.max(1, prev - 1))}
                                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: staffPage === 1 ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: staffPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                                                    PREV
                                                </button>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white', letterSpacing: '0.1em' }}>
                                                    PAGE <span style={{ color: '#C9A84C' }}>{staffPage}</span> / {staffTotalPages}
                                                </span>
                                                <button
                                                    disabled={staffPage === staffTotalPages}
                                                    onClick={() => setStaffPage(prev => Math.min(staffTotalPages, prev + 1))}
                                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: staffPage === staffTotalPages ? 'rgba(255,255,255,0.1)' : '#C9A84C', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: staffPage === staffTotalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
                    )}

                    {/* Removed Teams, Scores, and Users Tabs -> relocated to AdminManageData */}
                </AnimatePresence>
            </div>
        </div >
    )
}
