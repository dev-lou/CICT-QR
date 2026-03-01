import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Register PWA service worker with forced silent reload on new deployments
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: async () => {
        await updateSW(true)
        window.location.reload()
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
