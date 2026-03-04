import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import { supabase } from './lib/supabase'
import Swal from 'sweetalert2'

// Lazy-load heavy components — only downloaded when the route is visited
const LogbookPage = lazy(() => import('./components/LogbookPage'))
const AdminLogin = lazy(() => import('./components/AdminLogin'))
const AdminScanner = lazy(() => import('./components/AdminScanner'))
const AdminManageData = lazy(() => import('./components/AdminManageData'))
const Scoreboard = lazy(() => import('./components/Scoreboard'))
const ScoreHistory = lazy(() => import('./components/ScoreHistory'))
const PublicScoreboard = lazy(() => import('./components/PublicScoreboard'))

// Minimal loading spinner for lazy routes
const LazyFallback = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
)

// ─── XSS-safe HTML escaping ─────────────────────────────────────────────────
const _esc = (s) => {
    if (!s) return ''
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ─── Global Student Listener ───────────────────────────────────────────────────
// Listens to a single shared broadcast channel, filters by own UUID client-side
function GlobalStudentListener({ uuid }) {
    useEffect(() => {
        if (!uuid || !supabase) return

        let globalChannel = null
        let audioContext = null
        let hasUserGesture = Boolean(document?.userActivation?.hasBeenActive)

        const ensureStudentAudioReady = async () => {
            try {
                if (!hasUserGesture) return null
                const AudioContextClass = window.AudioContext || window.webkitAudioContext
                if (!AudioContextClass) return null
                audioContext = audioContext || new AudioContextClass()
                if (audioContext.state === 'suspended') {
                    await audioContext.resume()
                }
                return audioContext
            } catch {
                return null
            }
        }

        const playStudentConfirmationSound = async (scanType = 'in') => {
            try {
                const context = await ensureStudentAudioReady()
                if (!context) return

                const now = context.currentTime + 0.005
                const notes = scanType === 'out' ? [1080, 900] : [1220, 1450]

                notes.forEach((frequency, index) => {
                    const oscillator = context.createOscillator()
                    const gainNode = context.createGain()
                    oscillator.connect(gainNode)
                    gainNode.connect(context.destination)
                    oscillator.type = 'triangle'
                    const start = now + index * 0.095
                    oscillator.frequency.setValueAtTime(frequency, start)
                    oscillator.frequency.exponentialRampToValueAtTime(Math.max(700, frequency - 190), start + 0.06)
                    gainNode.gain.setValueAtTime(0.0001, start)
                    gainNode.gain.exponentialRampToValueAtTime(0.18, start + 0.012)
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.085)
                    oscillator.start(start)
                    oscillator.stop(start + 0.085)
                })
            } catch (e) { }
        }

        const unlockAudio = () => {
            hasUserGesture = true
            ensureStudentAudioReady()
                .then((ctx) => {
                    if (!ctx) return
                    window.removeEventListener('click', unlockAudio)
                    window.removeEventListener('pointerdown', unlockAudio)
                    window.removeEventListener('touchstart', unlockAudio)
                    window.removeEventListener('keydown', unlockAudio)
                })
                .catch(() => { })
        }
        window.addEventListener('click', unlockAudio, { once: true })
        window.addEventListener('pointerdown', unlockAudio, { once: true })
        window.addEventListener('touchstart', unlockAudio, { once: true })
        window.addEventListener('keydown', unlockAudio, { once: true })

        // First resolve the student's DB record to get their generated ID to match the scanner's payload
        const setupListener = async () => {
            const { data: student } = await supabase.from('students').select('id, full_name, team_name, role').eq('uuid', uuid).single()
            if (!student) return

            globalChannel = supabase.channel('scan-notifications')
                .on('broadcast', { event: 'scan-detected' }, (payload) => {
                    // Filter: only react to broadcasts for THIS student
                    if (payload.payload?.uuid !== uuid) return
                    const scanType = payload.payload?.type === 'out' ? 'out' : 'in'
                    const normalizedRole = String(student.role || 'student').trim().toLowerCase()
                    const action = scanType === 'in' ? 'Checked in' : 'Checked out'
                    const roleLabel = normalizedRole
                        ? `${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}`
                        : 'Student'
                    const teamLabel = student.team_name?.trim() || 'Unassigned Team'
                    const statusColor = scanType === 'in' ? '#10b981' : '#60a5fa'
                    const iconMarkup = scanType === 'in'
                        ? '<svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#ffffff" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>'
                        : '<svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#ffffff" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>'
                    const eventTime = new Date().toLocaleTimeString('en-PH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Manila'
                    })

                    Swal.fire({
                        title: `<span style="color: #ffffff; font-weight: 900; font-size: 1.2rem; letter-spacing: 0.02em;">${scanType === 'in' ? 'Check-in Confirmed' : 'Check-out Confirmed'}</span>`,
                        html: `<style>
                            .student-confirm-card { color: rgba(255,255,255,0.92); text-align: left; }
                            .student-confirm-icon-wrap { width: 76px; height: 76px; margin: 0 auto 0.9rem; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #7B1C1C, #C9A84C); box-shadow: 0 0 0 6px rgba(201,168,76,0.12), 0 12px 28px rgba(0,0,0,0.35); animation: studentPulse 1.3s ease-out; }
                            .student-confirm-name { font-size: 1.08rem; font-weight: 900; color: #ffffff; margin-bottom: 0.2rem; letter-spacing: 0.01em; }
                            .student-confirm-sub { font-size: 0.82rem; color: rgba(255,255,255,0.58); margin-bottom: 0.75rem; }
                            .student-confirm-status { display: inline-flex; align-items: center; gap: 0.45rem; border-radius: 999px; padding: 0.36rem 0.72rem; font-size: 0.74rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.8rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); }
                            .student-confirm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
                            .student-confirm-cell { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.85rem; padding: 0.6rem 0.65rem; }
                            .student-confirm-k { color: rgba(255,255,255,0.52); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 0.2rem; }
                            .student-confirm-v { color: #ffffff; font-size: 0.84rem; font-weight: 800; line-height: 1.25; }
                            @keyframes studentPulse {
                                0% { transform: scale(0.86); opacity: 0.85; }
                                55% { transform: scale(1.03); opacity: 1; }
                                100% { transform: scale(1); opacity: 1; }
                            }
                        </style>
                        <div class="student-confirm-card">
                            <div class="student-confirm-icon-wrap">${iconMarkup}</div>
                            <div class="student-confirm-name">${_esc(student.full_name)}</div>
                            <div class="student-confirm-sub">Attendance recorded successfully</div>
                            <div class="student-confirm-status" style="color: ${statusColor};">
                                <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:${statusColor};"></span>
                                ${action}
                            </div>
                            <div class="student-confirm-grid">
                                <div class="student-confirm-cell">
                                    <div class="student-confirm-k">Team</div>
                                    <div class="student-confirm-v">${_esc(teamLabel)}</div>
                                </div>
                                <div class="student-confirm-cell">
                                    <div class="student-confirm-k">Role</div>
                                    <div class="student-confirm-v">${_esc(roleLabel)}</div>
                                </div>
                                <div class="student-confirm-cell">
                                    <div class="student-confirm-k">Time</div>
                                    <div class="student-confirm-v">${eventTime}</div>
                                </div>
                                <div class="student-confirm-cell">
                                    <div class="student-confirm-k">Source</div>
                                    <div class="student-confirm-v">Admin Scanner</div>
                                </div>
                            </div>
                        </div>`,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#C9A84C',
                        background: 'linear-gradient(160deg, #111827 0%, #1e1b4b 35%, #3f1d1d 100%)',
                        color: '#ffffff',
                        backdrop: `rgba(15,23,42,0.88)`,
                        width: 'min(92vw, 28rem)',
                        padding: '1.35rem',
                        allowOutsideClick: false,
                        allowEscapeKey: true,
                        customClass: {
                            popup: 'luxury-swal-popup',
                            confirmButton: 'luxury-swal-btn'
                        },
                        didOpen: () => {
                            playStudentConfirmationSound(scanType).catch(() => { })
                        }
                    })
                })
                .subscribe()
        }

        setupListener()

        return () => {
            window.removeEventListener('click', unlockAudio)
            window.removeEventListener('pointerdown', unlockAudio)
            window.removeEventListener('touchstart', unlockAudio)
            window.removeEventListener('keydown', unlockAudio)
            if (globalChannel) supabase.removeChannel(globalChannel)
            if (audioContext && typeof audioContext.close === 'function') {
                audioContext.close().catch(() => { })
            }
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

const AdminAuditLog = lazy(() => import('./components/AdminAuditLog'))
const AdminPointTally = lazy(() => import('./components/AdminPointTally'))
const AdminTeamExport = lazy(() => import('./components/AdminTeamExport'))
const AdminAttendanceFix = lazy(() => import('./components/AdminAttendanceFix'))

function ExecutiveFixRoute() {
    const gatewayUuid = (() => {
        try {
            return String(localStorage.getItem('student_uuid') || '').trim()
        } catch {
            return ''
        }
    })()

    const [roleChecked, setRoleChecked] = useState(false)
    const [isExecutive, setIsExecutive] = useState(false)

    useEffect(() => {
        let active = true
        const run = async () => {
            try {
                if (!gatewayUuid || !supabase) {
                    if (active) {
                        setIsExecutive(false)
                        setRoleChecked(true)
                    }
                    return
                }

                const { data } = await supabase
                    .from('students')
                    .select('role')
                    .eq('uuid', gatewayUuid)
                    .maybeSingle()

                if (!active) return
                const role = String(data?.role || localStorage.getItem('student_role') || '').trim().toLowerCase()
                setIsExecutive(role === 'executive')
                setRoleChecked(true)
            } catch {
                if (active) {
                    setIsExecutive(false)
                    setRoleChecked(true)
                }
            }
        }

        run()
        return () => { active = false }
    }, [gatewayUuid])

    if (!roleChecked) {
        return <div style={{ minHeight: '100vh', background: '#0f172a' }} />
    }

    const isAdminSession = sessionStorage.getItem('admin_logged_in') === 'true'
    if (!isExecutive || !isAdminSession) {
        return <Navigate to="/" replace />
    }

    return <AdminAttendanceFix />
}

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────
function AdminRoot() {
    const gatewayUuid = (() => {
        try {
            return String(localStorage.getItem('student_uuid') || '').trim()
        } catch {
            return ''
        }
    })()
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
        () => sessionStorage.getItem('admin_logged_in') === 'true'
    )
    const [view, setView] = useState('scanner') // 'scanner' | 'manage' | 'audit' | 'tally' | 'history' | 'team-export'
    const [gatewayRole, setGatewayRole] = useState(() => {
        try {
            return String(localStorage.getItem('student_role') || '').trim().toLowerCase()
        } catch {
            return ''
        }
    })
    const [gatewayRoleChecked, setGatewayRoleChecked] = useState(false)
    const adminRole = (() => {
        try {
            const raw = localStorage.getItem('admin_session')
            if (!raw) return 'admin'
            return String(JSON.parse(raw)?.role || 'admin').trim().toLowerCase()
        } catch {
            return 'admin'
        }
    })()
    useEffect(() => {
        let active = true
        const resolveGatewayRole = async () => {
            try {
                if (!gatewayUuid) {
                    if (active) setGatewayRoleChecked(true)
                    return
                }

                if (!supabase) {
                    if (active) setGatewayRoleChecked(true)
                    return
                }

                const { data } = await supabase
                    .from('students')
                    .select('role')
                    .eq('uuid', gatewayUuid)
                    .maybeSingle()

                if (!active) return
                const normalized = String(data?.role || localStorage.getItem('student_role') || '').trim().toLowerCase()
                if (normalized) {
                    setGatewayRole(normalized)
                    localStorage.setItem('student_role', normalized)
                }
                setGatewayRoleChecked(true)
            } catch {
                // Keep cached role if lookup fails
                if (active) setGatewayRoleChecked(true)
            }
        }

        resolveGatewayRole()
        return () => { active = false }
    }, [isAdminLoggedIn, gatewayUuid])

    if (!gatewayUuid) {
        return <Navigate to="/" replace />
    }

    if (!gatewayRoleChecked) {
        return <div style={{ minHeight: '100vh', background: '#0f172a' }} />
    }

    const isGatewayAllowed = gatewayRole === 'executive' || gatewayRole === 'officer'
    if (!isGatewayAllowed) {
        return <Navigate to="/" replace />
    }

    const isOfficerView = gatewayRole === 'officer' || adminRole === 'officer'

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
        localStorage.removeItem('admin_session')
        sessionStorage.removeItem('admin_logged_in')
        setIsAdminLoggedIn(false)
    }

    if (isOfficerView || view === 'scanner') {
        return (
            <AdminScanner
                onLogout={logout}
                onNavigateManageData={() => setView('manage')}
                onNavigateAudit={() => setView('audit')}
                onNavigateTally={() => setView('tally')}
                onNavigateHistory={() => setView('history')}
                onNavigateTeamExport={() => setView('team-export')}
                isOfficerView={isOfficerView}
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
                onNavigateTeamExport={() => setView('team-export')}
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
                onNavigateTeamExport={() => setView('team-export')}
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
                onNavigateTeamExport={() => setView('team-export')}
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
                onNavigateTeamExport={() => setView('team-export')}
                onLogout={logout}
            />
        )
    }

    if (view === 'team-export') {
        return (
            <AdminTeamExport
                onLogout={logout}
                onNavigateScanner={() => setView('scanner')}
                onNavigateManageData={() => setView('manage')}
                onNavigateAudit={() => setView('audit')}
                onNavigateTally={() => setView('tally')}
                onNavigateHistory={() => setView('history')}
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
        <Suspense fallback={<LazyFallback />}>
            <Routes>
                <Route path="/" element={<StudentRoot />} />
                <Route path="/logbook" element={<LogbookRoute />} />
                <Route path="/admin" element={<AdminRoot />} />
                <Route path="/admin-attendance-fix-2026-hidden" element={<ExecutiveFixRoute />} />
                <Route path="/scoreboard" element={<PublicScoreboard />} />
                <Route path="/scoreboard-itweek2026" element={<Scoreboard />} />
                <Route path="/score-history" element={<ScoreHistory />} />
                <Route path="/official-standings-2026-secure" element={<AdminPointTally isPublic={true} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    )
}
