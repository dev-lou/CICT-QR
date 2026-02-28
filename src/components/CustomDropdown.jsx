import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CustomDropdown({ value, options, onChange, placeholder = 'Select an option', label, dark = false, fontSize = '0.9375rem' }) {
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
                <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: dark ? '#C9A84C' : '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem'
                }}>
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '0.8125rem 1rem',
                    borderRadius: '1rem',
                    border: '1.5px solid',
                    borderColor: isOpen
                        ? (dark ? '#C9A84C' : '#7B1C1C')
                        : (dark ? 'rgba(201,168,76,0.4)' : '#e2e8f0'),
                    background: dark ? 'rgba(123,28,28,0.3)' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isOpen
                        ? (dark ? '0 0 20px rgba(201,168,76,0.15)' : '0 0 0 3px rgba(123, 28, 28, 0.1)')
                        : 'none',
                    textAlign: 'left',
                    color: dark ? 'white' : '#0f172a'
                }}
            >
                <span style={{
                    fontSize: fontSize,
                    color: selectedOption
                        ? (dark ? 'white' : '#0f172a')
                        : (dark ? 'rgba(255,255,255,0.5)' : '#94a3b8'),
                    fontWeight: selectedOption ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <motion.svg
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={dark ? '#C9A84C' : '#94a3b8'}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.8, flexShrink: 0 }}
                >
                    <path d="M6 9l6 6 6-6" />
                </motion.svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                            background: dark ? '#591212' : '#ffffff',
                            borderRadius: '1.25rem',
                            border: '1px solid',
                            borderColor: dark ? 'rgba(201,168,76,0.2)' : '#e2e8f0',
                            boxShadow: dark
                                ? '0 -10px 40px -10px rgba(0,0,0,0.5)'
                                : '0 -10px 25px -5px rgba(0, 0, 0, 0.1)',
                            overflow: 'hidden',
                            padding: '0.5rem',
                            backdropFilter: dark ? 'blur(16px)' : 'none'
                        }}
                    >
                        <div style={{ maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none' }}>
                            {options.map((option) => {
                                const isSelected = value === option.name || value === option.id
                                return (
                                    <button
                                        key={option.id || option.name}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.name)
                                            setIsOpen(false)
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.875rem',
                                            border: 'none',
                                            background: isSelected
                                                ? (dark ? 'rgba(201,168,76,0.15)' : '#fdf0f0')
                                                : 'transparent',
                                            color: isSelected
                                                ? (dark ? '#C9A84C' : '#7B1C1C')
                                                : (dark ? 'rgba(255,255,255,0.8)' : '#475569'),
                                            fontSize: fontSize,
                                            fontWeight: isSelected ? 700 : 500,
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.25rem'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#f8fafc'
                                                e.currentTarget.style.color = dark ? 'white' : '#0f172a'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = 'transparent'
                                                e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.6)' : '#475569'
                                            }
                                        }}
                                    >
                                        {option.name}
                                        {isSelected && (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
