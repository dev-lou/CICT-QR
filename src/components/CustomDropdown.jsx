import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CustomDropdown({ value, options, onChange, placeholder = 'Select an option', label }) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find(opt => opt.name === value || opt.id === value)

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.875rem',
                    border: isOpen ? '1.5px solid #7B1C1C' : '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isOpen ? '0 0 0 3px rgba(123, 28, 28, 0.1)' : 'none',
                    textAlign: 'left'
                }}
            >
                <span style={{
                    fontSize: '0.9375rem',
                    color: selectedOption ? '#0f172a' : '#94a3b8',
                    fontWeight: selectedOption ? 600 : 400
                }}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <motion.svg
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                >
                    <path d="M6 9l6 6 6-6" />
                </motion.svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                            background: '#ffffff',
                            borderRadius: '1rem',
                            border: '1.5px solid #e2e8f0',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            overflow: 'hidden',
                            padding: '0.375rem'
                        }}
                    >
                        <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'none' }}>
                            {options.map((option) => (
                                <button
                                    key={option.id || option.name}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.name)
                                        setIsOpen(false)
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem 0.875rem',
                                        borderRadius: '0.625rem',
                                        border: 'none',
                                        background: (value === option.name || value === option.id) ? '#fdf0f0' : 'transparent',
                                        color: (value === option.name || value === option.id) ? '#7B1C1C' : '#475569',
                                        fontSize: '0.875rem',
                                        fontWeight: (value === option.name || value === option.id) ? 700 : 500,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (value !== option.name && value !== option.id) {
                                            e.currentTarget.style.background = '#f8fafc'
                                            e.currentTarget.style.color = '#0f172a'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (value !== option.name && value !== option.id) {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.color = '#475569'
                                        }
                                    }}
                                >
                                    {option.name}
                                    {(value === option.name || value === option.id) && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
