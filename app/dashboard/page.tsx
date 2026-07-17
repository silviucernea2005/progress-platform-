'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const BLUE = '#185FA5'
const BLUE_DARK = '#0C447C'
const ORANGE = '#D46A28'

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('all')

  // Remember which project was last being worked on, so "back to dashboard" from a
  // report shows that project instead of resetting to "All Projects"
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_selected_project')
    if (saved) setSelectedProject(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('dashboard_selected_project', selectedProject)
  }, [selectedProject])

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
    ]).then(([p, r]) => {
      setProjects(Array.isArray(p) ? p : [])
      setReports(Array.isArray(r) ? r : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filteredReports = selectedProject === 'all' ? reports : reports.filter(r => r.project_id === selectedProject)

  function getProgress(projectId: string) {
    const rep = reports.find((r: any) => r.project_id === projectId)
    if (!rep || !rep.activities?.length) return null
    return rep.activities.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0)
  }

  function getReportProgress(r: any) {
    const acts = r.activities || []
    return acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0)
  }

  // Photos now live on the server — the reports list already includes them (see /api/reports)
  function getPhotoInfo(r: any): { hasAny: boolean; thumb: string | null } {
    const list = r.photos
    if (!Array.isArray(list) || !list.length) return { hasAny: false, thumb: null }
    const firstImage = list.find((p: any) => typeof p.url === 'string' && !p.url.startsWith('data:text/plain'))
    return { hasAny: true, thumb: firstImage?.url || null }
  }

  const btn = (bg: string, color = '#fff') => ({ background: bg, color, border: 'none', borderRadius: 7, padding: '7px 15px', fontSize: 13, cursor: 'pointer', fontWeight: 500, textDecoration: 'none', display: 'inline-block' } as any)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      {/* HEADER */}
      <header style={{ background: MCORE_DARK, color: '#fff', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: BLUE, borderRadius: 8, padding: '4px 10px', fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>S7</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>Square 7</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>PART OF M.CORE</div>
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)', margin: '0 10px' }} />
          <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Progress Platform</span>
        </div>
        <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/projects/new" style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontSize: 13 }}>+ New Project</Link>
          <Link href="/reports/new" style={{ ...btn(ORANGE), fontWeight: 600 }}>+ New Report</Link>
        </nav>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* SIDEBAR */}
        <aside style={{ width: 230, background: '#fff', borderRight: '1px solid #e5e7eb', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: '16px 16px 8px', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 1.2 }}>PROJECTS</div>

          {/* Dropdown for mobile / quick select */}
          <div style={{ padding: '0 12px 12px' }}>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: MCORE_DARK, background: '#f9fafb' }}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div onClick={() => setSelectedProject('all')}
            style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: selectedProject === 'all' ? 600 : 400, color: selectedProject === 'all' ? MCORE_DARK : '#374151', background: selectedProject === 'all' ? '#f5f5f3' : 'transparent', borderLeft: selectedProject === 'all' ? `3px solid ${MCORE_DARK}` : '3px solid transparent' }}>
            All Projects
          </div>

          {loading ? <div style={{ padding: '10px 16px', fontSize: 12, color: '#9ca3af' }}>Loading...</div>
            : projects.map(p => {
              const prog = getProgress(p.id)
              const isSelected = selectedProject === p.id
              return (
                <div key={p.id} onClick={() => setSelectedProject(p.id)}
                  style={{ padding: '10px 16px', cursor: 'pointer', borderLeft: isSelected ? `3px solid ${ORANGE}` : '3px solid transparent', background: isSelected ? '#fef9f5' : 'transparent' }}>
                  <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? ORANGE : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  {prog !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: '#f3f4f6', borderRadius: 99 }}>
                        <div style={{ height: '100%', background: ORANGE, borderRadius: 99, width: `${Math.min(prog, 100)}%` }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{prog.toFixed(0)}%</span>
                    </div>
                  )}
                  {p.location && <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 1 }}>{p.location}</div>}
                </div>
              )
            })}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Active Projects', value: loading ? '—' : projects.filter(p => p.status === 'active').length, color: BLUE_DARK },
              { label: 'Total Reports', value: loading ? '—' : filteredReports.length, color: '#374151' },
              { label: 'Completed Projects', value: loading ? '—' : projects.filter(p => p.status === 'completed').length, color: '#3B6D11' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* REPORTS TABLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: MCORE_DARK, margin: 0 }}>
              {selectedProject === 'all' ? 'All Reports' : `Reports — ${projects.find(p => p.id === selectedProject)?.name || ''}`}
            </h2>
            <Link href={selectedProject !== 'all' ? `/reports/new?project=${selectedProject}` : '/reports/new'} style={{ ...btn(ORANGE), fontWeight: 600 }}>+ New Report</Link>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '11px 16px', fontWeight: 600, color: '#374151' }}>Project</th>
                  <th style={{ textAlign: 'left', padding: '11px 16px', fontWeight: 600, color: '#374151' }}>Period</th>
                  <th style={{ textAlign: 'left', padding: '11px 16px', fontWeight: 600, color: '#374151' }}>Progress</th>
                  <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Loading...</td></tr>
                  : filteredReports.length === 0 ? <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No reports yet. <Link href="/reports/new" style={{ color: ORANGE }}>Create first report</Link></td></tr>
                    : filteredReports.slice(0, 30).map((r: any) => {
                      const prog = getReportProgress(r)
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '11px 16px', fontWeight: 500, color: MCORE_DARK }}>{r.project?.name || '—'}</td>
                          <td style={{ padding: '11px 16px', color: '#6b7280' }}>{r.period_start} – {r.period_end}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ height: 5, width: 80, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: ORANGE, borderRadius: 99, width: `${Math.min(prog, 100)}%` }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: MCORE_DARK }}>{prog.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {(() => {
                                const { hasAny, thumb } = getPhotoInfo(r)
                                if (!hasAny) return null
                                return thumb
                                  ? <img src={thumb} title="Has photos" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                                  : <span title="Has attachments" style={{ fontSize: 14 }}>📎</span>
                              })()}
                              <Link href={`/reports/${r.id}`} style={{ ...btn(BLUE), padding: '5px 12px', fontSize: 12 }}>View</Link>
                              <Link href={`/reports/${r.id}/edit`} style={{ ...btn('#f3f4f6', '#374151'), padding: '5px 12px', fontSize: 12 }}>Edit</Link>
                              <button onClick={async () => { if(confirm('Delete this report?')) { await fetch(`/api/reports/${r.id}`, {method:'DELETE'}); setReports(prev => prev.filter(x => x.id !== r.id)) } }}
                                style={{ ...btn('#fef2f2', '#dc2626'), padding: '5px 12px', fontSize: 12 }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
