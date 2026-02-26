import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import LogbookPage from './components/LogbookPage'
import AdminLogin from './components/AdminLogin'
import AdminScanner from './components/AdminScanner'
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

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────
function AdminRoot() {
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
        () => sessionStorage.getItem('admin_logged_in') === 'true'
    )

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

    return (
        <AdminScanner
            onLogout={() => {
                sessionStorage.removeItem('admin_logged_in')
                setIsAdminLoggedIn(false)
            }}
        />
    )
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
