import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Register PWA service worker with forced silent reload on new deployments
import { registerSW } from 'virtual:pwa-register'
registerSW({
    immediate: true,
    onNeedRefresh() {
        // Force the browser to bypass cache and fetch the new update instantly
        window.location.reload(true)
    }
})
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)
