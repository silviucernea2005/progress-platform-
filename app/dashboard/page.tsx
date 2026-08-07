'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const MCORE_RED = '#A70202'
const NAV_BG = '#22304A'
const BLUE = '#185FA5'
const BLUE_DARK = '#0C447C'
const ORANGE = '#D46A28'
const GREEN = '#3B9E4A'

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [filterResponsible, setFilterResponsible] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAccessPanel, setShowAccessPanel] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [projectEditorIds, setProjectEditorIds] = useState<Set<string>>(new Set())
  const [loadingAccess, setLoadingAccess] = useState(false)

  const [pendingEditorIds, setPendingEditorIds] = useState<Set<string>>(new Set())
  const [savingAccess, setSavingAccess] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [activityLog, setActivityLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)

  async function openActivityLog() {
    setShowActivityLog(true)
    setLoadingLog(true)
    try {
      const res = await fetch('/api/activity-log')
      const data = await res.json()
      setActivityLog(Array.isArray(data) ? data : [])
    } catch {
      alert('Could not load the activity log.')
    }
    setLoadingLog(false)
  }

  async function openAccessPanel() {
    setShowAccessPanel(true)
    setLoadingAccess(true)
    try {
      const [usersRes, editorsRes] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch(`/api/projects/${selectedProject}/editors`).then(r => r.json()),
      ])
      setAllUsers(Array.isArray(usersRes) ? usersRes : [])
      const ids = new Set<string>(Array.isArray(editorsRes) ? editorsRes.map((e: any) => e.user_id) : [])
      setProjectEditorIds(ids)
      setPendingEditorIds(new Set(ids))
    } catch {
      alert('Could not load the access list.')
    }
    setLoadingAccess(false)
  }

  function togglePendingEditor(userId: string) {
    setPendingEditorIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  async function saveAccessChanges() {
    setSavingAccess(true)
    const toAdd = Array.from(pendingEditorIds).filter(id => !projectEditorIds.has(id))
    const toRemove = Array.from(projectEditorIds).filter(id => !pendingEditorIds.has(id))
    try {
      await Promise.all([
        ...toAdd.map(userId => fetch(`/api/projects/${selectedProject}/editors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })),
        ...toRemove.map(userId => fetch(`/api/projects/${selectedProject}/editors`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) })),
      ])
      setProjectEditorIds(new Set(pendingEditorIds))
      setShowAccessPanel(false)
    } catch {
      alert('Error saving access changes.')
    }
    setSavingAccess(false)
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUser(d.user)).catch(() => {})
  }, [])

  const [canEditMap, setCanEditMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!currentUser || !reports.length) return
    const uniqueProjectIds = Array.from(new Set(reports.map((r: any) => r.project_id).filter(Boolean)))
    Promise.all(uniqueProjectIds.map(pid =>
      fetch(`/api/projects/${pid}/can-edit`).then(r => r.json()).then(d => [pid, !!d.allowed] as [string, boolean]).catch(() => [pid, false] as [string, boolean])
    )).then(entries => setCanEditMap(Object.fromEntries(entries)))
  }, [currentUser, reports])

  function requireLogin(): boolean {
    if (currentUser) return true
    if (confirm('You need to log in to edit or delete reports. Go to the login page?')) {
      router.push('/login?returnTo=/dashboard')
    }
    return false
  }

  function requireEditRights(projectId: string): boolean {
    if (!requireLogin()) return false
    if (currentUser?.role === 'admin') return true
    if (!canEditMap[projectId]) {
      alert("You don't have edit rights on this project. Only the project's creator, an assigned editor, or an admin can edit.")
      return false
    }
    return true
  }


  // Remember which project was last being worked on, so "back to dashboard" from a
  // report shows that project instead of resetting to "All Projects"
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_selected_project')
    if (saved) setSelectedProject(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('dashboard_selected_project', selectedProject)
  }, [selectedProject])

  async function loadDashboard() {
    try {
      const [p, r] = await Promise.all([
        fetch('/api/projects').then(res => res.json()),
        fetch('/api/reports').then(res => res.json()),
      ])
      setProjects(Array.isArray(p) ? p : [])
      setReports(Array.isArray(r) ? r : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  // Admins always have edit rights (handled directly in requireEditRights), so this
  // is only needed to check per-project rights for non-admin colleagues.
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin' || !projects.length) return
    Promise.all(projects.map((p: any) =>
      fetch(`/api/projects/${p.id}/can-edit`).then(r => r.json()).then(d => [p.id, !!d.allowed]).catch(() => [p.id, false])
    )).then(pairs => setCanEditMap(Object.fromEntries(pairs)))
  }, [currentUser, projects.length])

  // Selecting a specific project and filtering by Responsible/Client are mutually
  // exclusive views — combining them (e.g. project = Adjud RP + responsible = Ovidiu,
  // who isn't on Adjud RP) silently produces zero results, which looks like a bug.
  // These helpers keep only one active at a time.
  function selectProject(id: string) {
    setSelectedProject(id)
    setFilterResponsible('all')
    setFilterClient('all')
  }
  function setResponsibleFilter(value: string) {
    setFilterResponsible(value)
    setSelectedProject('all')
  }
  function setClientFilter(value: string) {
    setFilterClient(value)
    setSelectedProject('all')
  }

  const filteredReports = reports.filter((r: any) => {
    if (selectedProject !== 'all' && r.project_id !== selectedProject) return false
    if (filterResponsible !== 'all' || filterClient !== 'all') {
      const proj = projects.find((p: any) => p.id === r.project_id)
      if (filterResponsible !== 'all' && getProjectResponsible(proj) !== filterResponsible) return false
      if (filterClient !== 'all' && proj?.client !== filterClient) return false
    }
    return true
  })

  function getProgress(projectId: string) {
    const rep = reports.find((r: any) => r.project_id === projectId)
    if (!rep || !rep.activities?.length) return null
    return rep.activities.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0)
  }

  // Project-level "Responsible" (set via Manage Access) is the default shown everywhere.
  // A report can still override it individually if one was set on that specific report.
  function getProjectResponsible(p: any): string | null {
    const settings = Array.isArray(p?.project_settings) ? p.project_settings[0] : p?.project_settings
    return settings?.responsible || null
  }
  function getResponsible(projectId: string): string | null {
    const rep = reports.find((r: any) => r.project_id === projectId)
    if (rep?.responsible) return rep.responsible
    const project = projects.find((p: any) => p.id === projectId)
    return getProjectResponsible(project)
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
    <div style={{ minHeight: '100vh', background: '#FAF9F6', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header className="s7-header-row" style={{ position: 'sticky', top: 0, zIndex: 100, background: NAV_BG, color: '#fff', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div onClick={loadDashboard} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div style={{ background: MCORE_RED, borderRadius: 6, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, color: '#fff', flexShrink: 0 }}>M</div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: 0.2 }}>M°Core</span>
            <div style={{ width: 42, height: 2, background: MCORE_RED, margin: '3px 0 3px' }} />
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.4 }}>SQUARE 7</div>
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)', margin: '0 10px' }} />
          <span style={{ fontWeight: 500, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>Progress Platform</span>
        </div>
        <button className="s7-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ display: 'none', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', width: 36, height: 32, fontSize: 16, cursor: 'pointer' }}>☰</button>
        <nav className={`s7-header-actions${mobileMenuOpen ? ' s7-mobile-open' : ''}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', marginRight: 4 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '5px 8px' }}>
            <Link className="s7-btn" href="/projects/new" onClick={e => { if (!requireLogin()) e.preventDefault() }} style={{ ...btn(GREEN), fontWeight: 600 }}>+ New Project</Link>
            {currentUser?.role === 'admin' && (
              <Link className="s7-btn" href={selectedProject !== 'all' ? `/projects/${selectedProject}/edit` : '#'}
                onClick={e => { if (selectedProject === 'all') { e.preventDefault(); alert('Select a specific project in the sidebar first.') } }}
                style={{ ...btn('#f3f4f6', '#374151'), fontWeight: 600, opacity: selectedProject === 'all' ? 0.5 : 1 }}>✏️ Edit Project</Link>
            )}
            <Link className="s7-btn" href="/reports/new" onClick={e => { if (!requireLogin()) e.preventDefault() }} style={{ ...btn(BLUE), fontWeight: 600 }}>+ New Report</Link>
            {currentUser?.role === 'admin' && (
              <button className="s7-btn" onClick={openActivityLog} style={btn('#5C6AC4')}>📋 Activity Log</button>
            )}
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
          {currentUser ? (
            <button className="s7-btn" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setCurrentUser(null) }}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, color: '#fff', cursor: 'pointer', fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              👤 {currentUser.name} <span style={{ opacity: 0.6 }}>· Logout</span>
            </button>
          ) : (
            <button className="s7-btn" onClick={() => router.push('/login?returnTo=/dashboard')}
              style={{ background: BLUE, border: 'none', borderRadius: 20, color: '#fff', cursor: 'pointer', fontSize: 12, padding: '6px 14px', fontWeight: 600 }}>👤 Login</button>
          )}
        </nav>
      </header>

      <div className="s7-dash-body" style={{ display: 'flex', flex: 1 }}>
        {/* SIDEBAR */}
        <aside className="s7-dash-sidebar" style={{ width: 230, background: '#fff', borderRight: '1px solid #e5e7eb', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: '16px 16px 8px', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 1.2 }}>PROJECTS</div>

          <div style={{ padding: '0 12px 12px' }}>
            <Link className="s7-btn" href="/projects/new" onClick={e => { if (!requireLogin()) e.preventDefault() }}
              style={{ ...btn(GREEN), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontWeight: 600, fontSize: 12, padding: '8px 0', boxSizing: 'border-box' }}>
              + New Project
            </Link>
          </div>

          {/* Dropdown for mobile / quick select */}
          <div style={{ padding: '0 12px 12px' }}>
            <select value={selectedProject} onChange={e => selectProject(e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: MCORE_DARK, background: '#f9fafb' }}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="s7-dash-projectlist">
          <div onClick={() => selectProject('all')}
            style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: selectedProject === 'all' ? 600 : 400, color: selectedProject === 'all' ? MCORE_DARK : '#374151', background: selectedProject === 'all' ? '#f5f5f3' : 'transparent', borderLeft: selectedProject === 'all' ? `3px solid ${MCORE_DARK}` : '3px solid transparent' }}>
            All Projects
          </div>

          {loading ? (
            <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} className="s7-skeleton" style={{ height: 34, borderRadius: 6 }} />)}
            </div>
          )
            : projects
              .filter((p: any) => (filterResponsible === 'all' || getProjectResponsible(p) === filterResponsible) && (filterClient === 'all' || p.client === filterClient))
              .map(p => {
              const prog = getProgress(p.id)
              const isSelected = selectedProject === p.id
              const canDelete = currentUser && (currentUser.role === 'admin' || p.created_by === currentUser.id)
              return (
                <div key={p.id} onClick={() => selectProject(p.id)}
                  style={{ padding: '10px 16px', cursor: 'pointer', borderLeft: isSelected ? `3px solid ${ORANGE}` : '3px solid transparent', background: isSelected ? '#fef9f5' : 'transparent', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? ORANGE : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    {canDelete && (
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm(`Delete project "${p.name}"? All its reports will be deleted too. This cannot be undone.`)) return
                        const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
                        if (res.ok) { setProjects(prev => prev.filter(x => x.id !== p.id)); if (selectedProject === p.id) setSelectedProject('all') }
                        else { const err = await res.json().catch(() => ({})); alert(err.error || 'Could not delete the project.') }
                      }}
                        style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>🗑</button>
                    )}
                  </div>
                  {prog !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: '#f3f4f6', borderRadius: 99 }}>
                        <div className="s7-progress-fill" style={{ height: '100%', background: ORANGE, borderRadius: 99, width: `${Math.min(prog, 100)}%` }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{prog.toFixed(0)}%</span>
                    </div>
                  )}
                  {p.location && <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 1 }}>{p.location}</div>}
                  {getResponsible(p.id) && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>👤 {getResponsible(p.id)}</div>}
                </div>
              )
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {/* KPIs */}
          <div className="s7-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Active Projects', value: loading ? '—' : projects.filter(p => p.status === 'active').length, color: BLUE_DARK },
              { label: 'Total Reports', value: loading ? '—' : filteredReports.length, color: '#374151' },
              { label: 'Completed Projects', value: loading ? '—' : projects.filter(p => p.status === 'completed').length, color: '#3B6D11' },
            ].map(k => (
              <div key={k.label} className="s7-card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* REPORTS TABLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: MCORE_DARK, margin: 0 }}>
              {selectedProject === 'all' ? 'All Reports' : `Reports — ${projects.find(p => p.id === selectedProject)?.name || ''}`}
              {(filterResponsible !== 'all' || filterClient !== 'all') && (
                <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af' }}>
                  {' '}({[filterResponsible !== 'all' ? filterResponsible : null, filterClient !== 'all' ? filterClient : null].filter(Boolean).join(' · ')})
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {projects.length > 0 && (
                <>
                  <select value={filterResponsible} onChange={e => setResponsibleFilter(e.target.value)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#6b7280', background: '#fff' }}>
                    <option value="all">👤 All responsibles</option>
                    {Array.from(new Set(projects.map((p: any) => getProjectResponsible(p)).filter(Boolean))).sort().map((name: any) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <select value={filterClient} onChange={e => setClientFilter(e.target.value)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#6b7280', background: '#fff' }}>
                    <option value="all">🏢 All clients</option>
                    {Array.from(new Set(projects.map((p: any) => p.client).filter(Boolean))).sort().map((client: any) => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                  {(filterResponsible !== 'all' || filterClient !== 'all') && (
                    <button onClick={() => { setFilterResponsible('all'); setFilterClient('all') }}
                      style={{ fontSize: 12, color: BLUE, background: 'none', border: 'none', cursor: 'pointer' }}>✕ Clear</button>
                  )}
                </>
              )}
              {currentUser?.role === 'admin' && selectedProject !== 'all' && (
                <button className="s7-btn" onClick={openAccessPanel} style={{ ...btn('#f3f4f6', '#374151'), fontWeight: 600 }}>👥 Manage Access</button>
              )}
              <Link className="s7-btn" href={selectedProject !== 'all' ? `/reports/new?project=${selectedProject}` : '/reports/new'} onClick={e => { if (selectedProject !== 'all' ? !requireEditRights(selectedProject) : !requireLogin()) e.preventDefault() }} style={{ ...btn(BLUE), fontWeight: 600 }}>+ New Report</Link>
            </div>
          </div>

          {showAccessPanel && (
            <div onClick={() => setShowAccessPanel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: MCORE_DARK }}>Manage Access — {projects.find(p => p.id === selectedProject)?.name}</h3>
                  <button onClick={() => setShowAccessPanel(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>×</button>
                </div>
                {loadingAccess ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2, 3].map(i => <div key={i} className="s7-skeleton" style={{ height: 20 }} />)}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Check the users who can edit this project. The project's creator and admins have automatic access.</p>
                      <button onClick={() => setPendingEditorIds(new Set(allUsers.map((u: any) => u.id)))}
                        style={{ fontSize: 11, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 10 }}>Grant all ✓</button>
                    </div>
                    {allUsers.map(u => {
                      const isChecked = pendingEditorIds.has(u.id)
                      return (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                          <input type="checkbox" checked={isChecked} onChange={() => togglePendingEditor(u.id)} />
                          <div>
                            <div style={{ fontSize: 13, color: MCORE_DARK }}>{u.name} {u.role === 'admin' && <span style={{ color: ORANGE, fontSize: 11 }}>(admin)</span>}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.email}</div>
                          </div>
                        </label>
                      )
                    })}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                      <button onClick={() => setShowAccessPanel(false)} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      <button className="s7-btn" onClick={saveAccessChanges} disabled={savingAccess} style={{ ...btn(BLUE), padding: '8px 20px', fontSize: 13 }}>{savingAccess ? 'Saving...' : 'OK'}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {showActivityLog && (
            <div onClick={() => setShowActivityLog(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#f3f4f6', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: MCORE_DARK }}>📋 Activity Log</h3>
                  <button onClick={() => setShowActivityLog(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>×</button>
                </div>
                {loadingLog ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2, 3, 4].map(i => <div key={i} className="s7-skeleton" style={{ height: 32 }} />)}
                  </div>
                ) : activityLog.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>No events logged yet.</div>
                ) : (
                  activityLog.map((entry: any) => (
                    <div key={entry.id} style={{ padding: '10px 4px', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 13, color: MCORE_DARK }}>{entry.details}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {new Date(entry.created_at).toLocaleString('en-US')} {entry.project?.name && `· ${entry.project.name}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="s7-table-wrap s7-desktop-table s7-card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
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
                {loading ? [1, 2, 3, 4].map(i => (
                  <tr key={i}><td colSpan={4} style={{ padding: '10px 14px' }}><div className="s7-skeleton" style={{ height: 20 }} /></td></tr>
                ))
                  : filteredReports.length === 0 ? <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No reports yet. <Link href="/reports/new" style={{ color: ORANGE }}>Create first report</Link></td></tr>
                    : filteredReports.slice(0, 30).map((r: any) => {
                      const prog = getReportProgress(r)
                      return (
                        <tr key={r.id} onClick={() => router.push(`/reports/${r.id}`)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                          <td style={{ padding: '11px 16px', fontWeight: 500, color: MCORE_DARK }}>
                            {r.project?.name || '—'}
                            {(r.responsible || getProjectResponsible(projects.find((p: any) => p.id === r.project_id))) && <div style={{ fontSize: 10.5, fontWeight: 400, color: '#9ca3af', marginTop: 1 }}>👤 {r.responsible || getProjectResponsible(projects.find((p: any) => p.id === r.project_id))}</div>}
                          </td>
                          <td style={{ padding: '11px 16px', color: '#6b7280' }}>{r.period_start} – {r.period_end}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ height: 5, width: 80, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                                <div className="s7-progress-fill" style={{ height: '100%', background: ORANGE, borderRadius: 99, width: `${Math.min(prog, 100)}%` }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: MCORE_DARK }}>{prog.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {(() => {
                                const { hasAny, thumb } = getPhotoInfo(r)
                                if (!hasAny) return null
                                return thumb
                                  ? <img src={thumb} title="Has photos" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                                  : <span title="Has attachments" style={{ fontSize: 14 }}>📎</span>
                              })()}
                              <Link className="s7-btn" href={`/reports/${r.id}`} style={{ ...btn(BLUE), padding: '5px 12px', fontSize: 12 }}>View</Link>
                              <Link className="s7-btn" href={`/reports/${r.id}?edit=1`} onClick={e => { if (!requireEditRights(r.project_id)) e.preventDefault() }} style={{ ...btn('#f3f4f6', '#374151'), padding: '5px 12px', fontSize: 12 }}>Edit</Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST — no horizontal scroll, tap anywhere on the card to open the report */}
          <div className="s7-mobile-cards">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} className="s7-skeleton" style={{ height: 64, borderRadius: 12 }} />)}
              </div>
            )
              : filteredReports.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', background: '#fff', borderRadius: 12 }}>No reports yet. <Link href="/reports/new" style={{ color: ORANGE }}>Create first report</Link></div>
                : filteredReports.slice(0, 30).map((r: any) => {
                  const prog = getReportProgress(r)
                  const { hasAny, thumb } = getPhotoInfo(r)
                  return (
                    <div key={r.id} className="s7-card" onClick={() => router.push(`/reports/${r.id}`)}
                      style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 14, marginBottom: 10, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: MCORE_DARK, fontSize: 14 }}>{r.project?.name || '—'}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.period_start} – {r.period_end}</div>
                          {(r.responsible || getProjectResponsible(projects.find((p: any) => p.id === r.project_id))) && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>👤 {r.responsible || getProjectResponsible(projects.find((p: any) => p.id === r.project_id))}</div>}
                        </div>
                        {hasAny && (thumb
                          ? <img src={thumb} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />
                          : <span style={{ fontSize: 16, flexShrink: 0 }}>📎</span>)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                          <div className="s7-progress-fill" style={{ height: '100%', background: ORANGE, borderRadius: 99, width: `${Math.min(prog, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: MCORE_DARK }}>{prog.toFixed(1)}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                        <Link className="s7-btn" href={`/reports/${r.id}?edit=1`} onClick={e => { if (!requireEditRights(r.project_id)) e.preventDefault() }} style={{ ...btn('#f3f4f6', '#374151'), padding: '6px 14px', fontSize: 12, flex: 1, justifyContent: 'center' }}>Edit</Link>
                      </div>
                    </div>
                  )
                })}
          </div>
        </main>
      </div>
    </div>
  )
}



