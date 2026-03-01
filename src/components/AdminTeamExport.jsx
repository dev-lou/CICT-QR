import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function AdminTeamExport({ onLogout, onNavigateScanner, onNavigateManageData, onNavigateAudit, onNavigateTally, onNavigateHistory }) {
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)
    const [teams, setTeams] = useState([])
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedTeam, setSelectedTeam] = useState('')

    const fetchData = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        try {
            const [{ data: teamsData, error: teamsError }, { data: studentsData, error: studentsError }] = await Promise.all([
                supabase.from('teams').select('id, name').order('name'),
                supabase.from('students').select('id, full_name, team_name, role').order('full_name')
            ])

            if (teamsError) throw teamsError
            if (studentsError) throw studentsError

            setTeams(teamsData || [])
            setStudents(studentsData || [])
        } catch (err) {
            console.error('Failed to fetch export data:', err)
            Swal.fire({
                icon: 'error',
                title: 'Load Failed',
                text: err.message || 'Unable to load teams and members.',
                background: '#1e293b',
                color: '#fff'
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const filteredMembers = useMemo(() => {
        if (!selectedTeam) return []
        return students.filter((member) => member.team_name === selectedTeam)
    }, [students, selectedTeam])

    const exportTeamPDF = () => {
        if (!selectedTeam) {
            Swal.fire({
                icon: 'warning',
                title: 'Select Team First',
                text: 'Choose a team before exporting PDF.',
                background: '#1e293b',
                color: '#fff'
            })
            return
        }

        if (filteredMembers.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'No Members Found',
                text: `No members found for ${selectedTeam}.`,
                background: '#1e293b',
                color: '#fff'
            })
            return
        }

        const doc = new jsPDF()
        const exportedAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })

        doc.setFontSize(16)
        doc.text('IT Week Team Members', 14, 18)
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text(`Team: ${selectedTeam} · Members: ${filteredMembers.length} · Exported ${exportedAt}`, 14, 26)

        autoTable(doc, {
            startY: 32,
            head: [['#', 'Full Name', 'Role', 'Team']],
            body: filteredMembers.map((member, index) => [
                index + 1,
                member.full_name || '',
                member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : '',
                member.team_name || ''
            ]),
            styles: { fontSize: 9 },
            headStyles: { fillColor: [123, 28, 28] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        })

        doc.setFontSize(8)
        doc.setTextColor(180)
        doc.text('DESIGNED & DEVELOPED BY LOU VINCENT BARORO', 14, doc.internal.pageSize.height - 8)

        const safeTeam = selectedTeam.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'team'
        doc.save(`IT-Week-Team-Members-${safeTeam}.pdf`)
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .luxury-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; }
                .holographic-gold { background: linear-gradient(90deg, #7B1C1C, #C9A84C, #7B1C1C); background-size: 200% 100%; animation: shimmer 3s infinite linear; }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                .luxury-table-row { transition: all 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .luxury-table-row:hover { background: rgba(255,255,255,0.02); }
                .team-select-label { display: block; font-size: 0.75rem; font-weight: 700; color: #C9A84C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
                .team-select-input { width: 100%; padding: 0.8125rem 1rem; border-radius: 1rem; border: 1.5px solid rgba(201,168,76,0.4); background: rgba(123,28,28,0.3); color: white; font-size: 0.9375rem; font-weight: 600; outline: none; transition: all 0.25s ease; }
                .team-select-input:focus { border-color: #C9A84C; box-shadow: 0 0 20px rgba(201,168,76,0.15); }
            `}</style>

            <div style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="holographic-gold" style={{ height: '3px', width: '100%' }} />
                <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #7B1C1C, #C9A84C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(123,28,28,0.3)' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, margin: 0 }}>TEAM PDF EXPORT</p>
                            <p style={{ fontSize: '0.625rem', color: '#C9A84C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.125rem 0 0' }}>Generate Team Member List as PDF</p>
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '0.625rem', borderRadius: '0.75rem', background: menuOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <AnimatePresence>
                            {menuOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        style={{ position: 'absolute', right: 0, top: 'calc(100% + 0.75rem)', background: '#1e293b', borderRadius: '1.25rem', padding: '0.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '220px', zIndex: 50, overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />

                                        <button onClick={() => { setMenuOpen(false); onNavigateScanner && onNavigateScanner(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                            Attendance Scanner
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateManageData && onNavigateManageData(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                            Manage Teams & Scores
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateAudit && onNavigateAudit(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Personnel & Audit Logs
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateTally && onNavigateTally(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                            Point Standings
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); onNavigateHistory && onNavigateHistory(); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Activity History
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'rgba(201,168,76,0.1)', fontSize: '0.8125rem', fontWeight: 700, color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V4H2v16h5m10 0v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5m10 0H7" /></svg>
                                            Team PDF Export
                                        </button>
                                        <button onClick={() => { setMenuOpen(false); navigate('/'); }} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Profile Dashboard
                                        </button>
                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.5rem 0.75rem' }} />
                                        <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', background: 'transparent', fontSize: '0.8125rem', fontWeight: 700, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                            Logout
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem 3rem' }}>
                <div className="luxury-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'end' }}>
                        <div>
                            <label className="team-select-label">Team</label>
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="team-select-input"
                                disabled={loading}
                            >
                                <option value="" style={{ color: '#0f172a' }}>{loading ? 'Loading teams...' : 'Select a team'}</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.name} style={{ color: '#0f172a' }}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchData}
                            style={{ padding: '0.8125rem 1rem', borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Refresh
                        </button>
                        <button
                            onClick={exportTeamPDF}
                            disabled={!selectedTeam || filteredMembers.length === 0}
                            style={{ padding: '0.8125rem 1rem', borderRadius: '0.875rem', border: 'none', background: (!selectedTeam || filteredMembers.length === 0) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#7B1C1C,#C9A84C)', color: 'white', fontWeight: 800, cursor: (!selectedTeam || filteredMembers.length === 0) ? 'not-allowed' : 'pointer' }}
                        >
                            Export PDF
                        </button>
                    </div>
                    <div style={{ marginTop: '0.875rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
                        {selectedTeam ? `Selected Team: ${selectedTeam} · Members: ${filteredMembers.length}` : 'Choose a team, then press Export PDF.'}
                    </div>
                </div>

                <div className="luxury-card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#C9A84C', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Member Preview</p>
                    </div>
                    {!selectedTeam ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Select a team to preview members.</div>
                    ) : filteredMembers.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>No members found for this team.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>#</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>FULL NAME</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>ROLE</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>TEAM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMembers.map((member, index) => (
                                        <tr key={member.id} className="luxury-table-row">
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#C9A84C' }}>{index + 1}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'white' }}>{member.full_name}</td>
                                            <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>{member.role || '—'}</td>
                                            <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.75)' }}>{member.team_name || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
