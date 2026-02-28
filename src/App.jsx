import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import LogbookPage from './components/LogbookPage'
import AdminLogin from './components/AdminLogin'
import AdminScanner from './components/AdminScanner'
import AdminManageData from './components/AdminManageData'
import Scoreboard from './components/Scoreboard'
import ScoreHistory from './components/ScoreHistory'
import PublicScoreboard from './components/PublicScoreboard'
import { supabase } from './lib/supabase'
import Swal from 'sweetalert2'

// ─── Global Student Listener ───────────────────────────────────────────────────
// Listens to the scanning broadcast on ANY page (Dashboard, Logbook, etc.)
function GlobalStudentListener({ uuid }) {
    useEffect(() => {
        if (!uuid || !supabase) return

        let globalChannel = null

        // First resolve the student's DB record to get their generated ID to match the scanner's payload
        const setupListener = async () => {
            const { data: student } = await supabase.from('students').select('id, full_name, role').eq('uuid', uuid).single()
            if (!student) return

            globalChannel = supabase.channel(`scans-${uuid}`)
                .on('broadcast', { event: 'scan-detected' }, (payload) => {
                    const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(student.role)
                    const action = payload.payload?.type === 'in' ? 'Checked In' : 'Checked Out'

                    Swal.fire({
                        icon: 'success',
                        title: `<span style="color: white; font-weight: 800; font-size: 1.25rem;">ADMINISTRATOR SCANNED YOU!</span>`,
                        html: `<div style="color: rgba(255,255,255,0.7); font-size: 0.9375rem; font-weight: 600; margin-top: 0.5rem;">You have been <b style="color: ${isStaff ? '#C9A84C' : '#10b981'}; text-transform: uppercase;">${action}</b>. Check the logbook below.</div>`,
                        confirmButtonText: 'AWESOME',
                        confirmButtonColor: '#C9A84C',
                        background: '#1e293b', // Match luxury card background
                        color: '#ffffff',
                        backdrop: `rgba(15,23,42,0.85)`, // Darker, blurry backdrop
                        padding: '2rem',
                        customClass: {
                            popup: 'luxury-swal-popup',
                            confirmButton: 'luxury-swal-btn'
                        }
                    })
                })
                .subscribe()
        }

        setupListener()

        return () => {
            if (globalChannel) supabase.removeChannel(globalChannel)
        }
    }, [uuid])

    return null
}

// ─── Student Auth Guard ───────────────────────────────────────────────────────
function StudentRoot() {
    const [uuid, setUuid] = useState(() => localStorage.getItem('student_uuid'))
    const [showRegister, setShowRegister] = useState(false)

    if (!uuid) {
        if (showRegister) {
            return (
                <Register
                    onRegistered={(newUuid, action) => {
                        if (action === 'login') { setShowRegister(false); return }
                        setUuid(newUuid)
                    }}
                />
            )
        }
        return (
            <Login
                onLogin={(newUuid) => setUuid(newUuid)}
                onGoRegister={() => setShowRegister(true)}
            />
        )
    }

    return (
        <>
            <GlobalStudentListener uuid={uuid} />
            <Dashboard uuid={uuid} />
        </>
    )
}

import AdminAuditLog from './components/AdminAuditLog'
import AdminPointTally from './components/AdminPointTally'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────
function AdminRoot() {
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
        () => sessionStorage.getItem('admin_logged_in') === 'true'
    )
    const [view, setView] = useState('scanner') // 'scanner' | 'manage' | 'audit' | 'tally' | 'history'

    if (!isAdminLoggedIn) {
        return (
            <AdminLogin
                onLogin={() => {
                    sessionStorage.setItem('admin_logged_in', 'true')
                    setIsAdminLoggedIn(true)
                }}
            />
        )
    }

    const logout = () => {
        sessionStorage.removeItem('admin_logged_in')
        setIsAdminLoggedIn(false)
    }

    if (view === 'scanner') {
        return (
            <AdminScanner
                onLogout={logout}
                onNavigateManageData={() => setView('manage')}
                onNavigateAudit={() => setView('audit')}
                onNavigateTally={() => setView('tally')}
                onNavigateHistory={() => setView('history')}
            />
        )
    }

    if (view === 'manage') {
        return (
            <AdminManageData
                onLogout={logout}
                onNavigateScanner={() => setView('scanner')}
                onNavigateHistory={() => setView('history')}
                onNavigateAudit={() => setView('audit')}
                onNavigateTally={() => setView('tally')}
            />
        )
    }

    if (view === 'audit') {
        return (
            <AdminAuditLog
                onLogout={logout}
                onNavigateScanner={() => setView('scanner')}
                onNavigateHistory={() => setView('history')}
                onNavigateManageData={() => setView('manage')}
                onNavigateTally={() => setView('tally')}
            />
        )
    }

    if (view === 'tally') {
        return (
            <AdminPointTally
                onLogout={logout}
                onNavigateScanner={() => setView('scanner')}
                onNavigateHistory={() => setView('history')}
                onNavigateManageData={() => setView('manage')}
                onNavigateAudit={() => setView('audit')}
            />
        )
    }

    if (view === 'history') {
        return (
            <ScoreHistory
                isAdmin={true}
                onBack={() => setView('tally')} // Or whichever sector they came from
                onNavigateScanner={() => setView('scanner')}
                onNavigateManageData={() => setView('manage')}
                onNavigateAudit={() => setView('audit')}
                onNavigateTally={() => setView('tally')}
                onLogout={logout}
            />
        )
    }

    return null
}

// ─── Logbook Page Guard ───────────────────────────────────────────────────────
function LogbookRoute() {
    const uuid = localStorage.getItem('student_uuid')
    if (!uuid) return <Navigate to="/" replace />
    return (
        <>
            <GlobalStudentListener uuid={uuid} />
            <LogbookPage uuid={uuid} />
        </>
    )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    return (
        <Routes>
            <Route path="/" element={<StudentRoot />} />
            <Route path="/logbook" element={<LogbookRoute />} />
            <Route path="/admin" element={<AdminRoot />} />
            <Route path="/scoreboard" element={<PublicScoreboard />} />
            <Route path="/scoreboard-itweek2026" element={<Scoreboard />} />
            <Route path="/score-history" element={<ScoreHistory />} />
            <Route path="/official-standings-2026-secure" element={<AdminPointTally isPublic={true} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
