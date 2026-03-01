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

        const playStudentConfirmationSound = (scanType = 'in') => {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext
                if (!AudioContextClass) return
                audioContext = audioContext || new AudioContextClass()
                if (audioContext.state === 'suspended') {
                    audioContext.resume().catch(() => { })
                }

                const now = audioContext.currentTime
                const notes = scanType === 'out' ? [780, 980] : [980, 1240]

                notes.forEach((frequency, index) => {
                    const oscillator = audioContext.createOscillator()
                    const gainNode = audioContext.createGain()
                    oscillator.connect(gainNode)
                    gainNode.connect(audioContext.destination)
                    oscillator.type = 'sine'
                    const start = now + index * 0.11
                    oscillator.frequency.setValueAtTime(frequency, start)
                    gainNode.gain.setValueAtTime(0.0001, start)
                    gainNode.gain.exponentialRampToValueAtTime(0.09, start + 0.02)
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
                    oscillator.start(start)
                    oscillator.stop(start + 0.16)
                })
            } catch (e) { }
        }

        const unlockAudio = () => {
            playStudentConfirmationSound()
            window.removeEventListener('click', unlockAudio)
            window.removeEventListener('touchstart', unlockAudio)
            window.removeEventListener('keydown', unlockAudio)
        }
        window.addEventListener('click', unlockAudio, { once: true })
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
                    playStudentConfirmationSound(scanType)
                    const isStaff = ['leader', 'facilitator', 'executive', 'officer'].includes(student.role)
                    const action = scanType === 'in' ? 'Checked in' : 'Checked out'
                    const roleLabel = isStaff ? 'Staff' : 'Student'
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
                        icon: 'success',
                        title: `<span style="color: #ffffff; font-weight: 900; font-size: 1.2rem; letter-spacing: 0.02em;">Scan Confirmed</span>`,
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
                        }
                    })
                })
                .subscribe()
        }

        setupListener()

        return () => {
            window.removeEventListener('click', unlockAudio)
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
        localStorage.removeItem('admin_session')
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
