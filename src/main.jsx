import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import Swal from 'sweetalert2'

// Register PWA service worker with forced silent reload on new deployments
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: async () => {
        const result = await Swal.fire({
            icon: 'info',
            title: 'New Update Available',
            text: 'A newer version of the app is ready. Tap Update to refresh now.',
            confirmButtonText: 'Update Now',
            showCancelButton: true,
            cancelButtonText: 'Later',
            allowOutsideClick: false,
            allowEscapeKey: true,
            background: '#1e293b',
            color: '#ffffff',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#334155'
        })

        if (result.isConfirmed) {
            await updateSW(true)
        }
    },
    onRegisteredSW: (_swUrl, registration) => {
        if (!registration) return
        setInterval(() => {
            registration.update().catch(() => { })
        }, 60 * 1000)
    }
})
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)
