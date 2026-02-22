import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Registration from './components/Registration'
import Dashboard from './components/Dashboard'
import AdminLogin from './components/AdminLogin'
import AdminScanner from './components/AdminScanner'

function StudentView() {
    const [uuid, setUuid] = useState(() => localStorage.getItem('student_uuid') || null)

    const handleRegistered = (newUuid) => {
        setUuid(newUuid)
    }

    return (
        <AnimatePresence mode="wait">
            {uuid ? (
                <motion.div
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Dashboard uuid={uuid} />
                </motion.div>
            ) : (
                <motion.div
                    key="registration"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Registration onRegistered={handleRegistered} />
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function AdminView() {
    const [admin, setAdmin] = useState(() => {
        try {
            const stored = localStorage.getItem('admin_session')
            return stored ? JSON.parse(stored) : null
        } catch {
            return null
        }
    })

    const handleLogin = (adminData) => {
        setAdmin(adminData)
    }

    const handleLogout = () => {
        setAdmin(null)
    }

    return (
        <AnimatePresence mode="wait">
            {admin ? (
                <motion.div
                    key="admin-dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <AdminScanner onLogout={handleLogout} />
                </motion.div>
            ) : (
                <motion.div
                    key="admin-login"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <AdminLogin onLogin={handleLogin} />
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<StudentView />} />
            <Route path="/admin" element={<AdminView />} />
        </Routes>
    )
}
