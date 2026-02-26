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

    return <Dashboard uuid={uuid} />
}

import AdminAuditLog from './components/AdminAuditLog'
import AdminPointTally from './components/AdminPointTally'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────
function AdminRoot() {
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
        () => sessionStorage.getItem('admin_logged_in') === 'true'
    )
    const [view, setView] = useState('scanner') // 'scanner' | 'manage' | 'audit' | 'tally'

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
            />
        )
    }

    if (view === 'manage') {
        return (
            <AdminManageData
                onLogout={logout}
                onNavigateScanner={() => setView('scanner')}
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
                onNavigateManageData={() => setView('manage')}
                onNavigateAudit={() => setView('audit')}
            />
        )
    }

    return null
}

// ─── Logbook Page Guard ───────────────────────────────────────────────────────
function LogbookRoute() {
    const uuid = localStorage.getItem('student_uuid')
    if (!uuid) return <Navigate to="/" replace />
    return <LogbookPage uuid={uuid} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
