'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const MCORE_RED = '#A70202'
const NAV_BG = '#22304A'
const BLUE = '#185FA5'
const ORANGE = '#D46A28'
const DELETE_RED = '#B3261E'

const inputStyle: any = { width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const lbl: any = { display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }

function btn(bg: string, color = '#fff') {
  return { background: bg, color, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [client, setClient] = useState('')
  const [responsible, setResponsible] = useState('')
  const [allUsers, setAllUsers] = useState<any[]>([])

  const [tenderStart, setTenderStart] = useState('')
  const [tenderOffersReceived, setTenderOffersReceived] = useState('')
  const [tenderOffersReview, setTenderOffersReview] = useState('')
  const [tenderFinish, setTenderFinish] = useState('')
  const [contractingStart, setContractingStart] = useState('')
  const [contractingReviewLegal, setContractingReviewLegal] = useState('')
  const [contractingFinish, setContractingFinish] = useState('')
  const [constructionProceedNotice, setConstructionProceedNotice] = useState('')
  const [constructionStart, setConstructionStart] = useState('')
  const [constructionFinishEstimated, setConstructionFinishEstimated] = useState('')
  const [contractStart, setContractStart] = useState('')
  const [contractFinish, setContractFinish] = useState('')

  const [activities, setActivities] = useState<any[]>([])
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [overrides, setOverrides] = useState<Record<string, { name?: string; excluded?: boolean }>>({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatWeight, setNewCatWeight] = useState<number>(0)
  const [addingCat, setAddingCat] = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({}))
      setCurrentUser(me.user || null)
      if (!me.user || me.user.role !== 'admin') { setForbidden(true); setLoading(false); return }

      try {
        const [project, settings, users, acts] = await Promise.all([
          fetch(`/api/projects/${projectId}`).then(r => r.json()),
          fetch(`/api/projects/${projectId}/settings`).then(r => r.json()),
          fetch('/api/users').then(r => r.json()),
          fetch(`/api/activities?project_id=${projectId}`).then(r => r.json()),
        ])
        setName(project.name || ''); setLocation(project.location || ''); setClient(project.client || '')
        setResponsible(settings?.responsible || '')
        setAllUsers(Array.isArray(users) ? users : [])
        setActivities(Array.isArray(acts) ? acts : [])
        setWeights(settings?.weights || {})
        setOverrides(settings?.activity_overrides || {})

        const d = settings?.dates || {}
        setTenderStart(d.tenderStart || ''); setTenderOffersReceived(d.tenderOffersReceived || '')
        setTenderOffersReview(d.tenderOffersReview || ''); setTenderFinish(d.tenderFinish || '')
        setContractingStart(d.contractingStart || ''); setContractingReviewLegal(d.contractingReviewLegal || '')
        setContractingFinish(d.contractingFinish || ''); setConstructionProceedNotice(d.constructionProceedNotice || '')
        setConstructionStart(d.constructionStart || ''); setConstructionFinishEstimated(d.constructionFinishEstimated || '')
        setContractStart(d.contractStart || ''); setContractFinish(d.contractFinish || '')
      } catch {
        alert('Could not load the project.')
      }
      setLoading(false)
    })()
  }, [projectId])

  // Escape discards and goes back, same as New Report / New Project.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirm('Discard and go back?')) router.back()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function activityName(a: any) {
    return overrides[a.id]?.name || a.name
  }
  function isExcluded(a: any) {
    return !!overrides[a.id]?.excluded
  }

  function setOverride(id: number, patch: { name?: string; excluded?: boolean }) {
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleRenameSave(a: any) {
    const value = renameValue.trim()
    if (!value) { setRenamingId(null); return }
    if (a.project_id) {
      try {
        await fetch(`/api/activities/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: value }) })
        setActivities(prev => prev.map(x => x.id === a.id ? { ...x, name: value } : x))
      } catch {
        alert('Could not rename the activity.')
      }
    } else {
      setOverride(a.id, { name: value })
    }
    setRenamingId(null)
  }

  async function handleDeleteActivity(a: any) {
    if (a.project_id) {
      if (!confirm(`Delete "${activityName(a)}"? This category was created only for this project.`)) return
      try {
        await fetch(`/api/activities/${a.id}`, { method: 'DELETE' })
        setActivities(prev => prev.filter(x => x.id !== a.id))
      } catch {
        alert('Could not delete the activity.')
      }
    } else {
      if (!confirm(`Hide "${activityName(a)}" from this project? It stays available for other projects. You can bring it back later.`)) return
      setOverride(a.id, { excluded: true })
    }
  }

  function restoreActivity(a: any) {
    setOverride(a.id, { excluded: false })
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    setAddingCat(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), default_weight: newCatWeight, project_id: projectId })
      })
      const data = await res.json()
      if (data.activity) {
        setActivities(prev => [...prev, data.activity])
        setWeights(prev => ({ ...prev, [data.activity.id]: newCatWeight }))
        setNewCatName(''); setNewCatWeight(0)
      } else {
        alert(data.error || 'Could not add the category.')
      }
    } catch {
      alert('Network error adding the category.')
    }
    setAddingCat(false)
  }

  const visibleActivities = activities.filter(a => !isExcluded(a))
  const hiddenActivities = activities.filter(a => isExcluded(a))
  const totalWeight = visibleActivities.reduce((s, a) => s + (weights[a.id] ?? a.default_weight ?? 0), 0)

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, location, client }) }),
        fetch(`/api/projects/${projectId}/settings`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responsible: responsible || null,
            weights,
            activity_overrides: overrides,
            dates: {
              tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish,
              contractingStart, contractingReviewLegal, contractingFinish,
              constructionProceedNotice, constructionStart, constructionFinishEstimated,
              contractStart, contractFinish
            }
          })
        }),
      ])
      router.push('/dashboard')
    } catch {
      alert('Network error saving the project.')
    }
    setSaving(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#FAF9F6' }} />
  if (forbidden) return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#374151', marginBottom: 12 }}>Only an admin can edit a project.</p>
        <button onClick={() => router.push('/dashboard')} style={btn(BLUE)}>← Back to Dashboard</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: NAV_BG, color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ background: MCORE_RED, borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0 }}>M</div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: 0.2 }}>M°Core</span>
            <div style={{ width: 36, height: 2, background: MCORE_RED, margin: '2px 0 2px' }} />
            <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.2 }}>SQUARE 7</div>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 8px' }} />
          <span style={{ fontWeight: 500, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Edit Project</span>
        </div>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 13, padding: '6px 14px' }}>← Cancel</button>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 80px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: MCORE_DARK, marginBottom: 20 }}>Edit — {name}</h1>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: MCORE_DARK, margin: '0 0 16px' }}>Project Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div><label style={lbl}>Name</label><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></div>
            <div><label style={lbl}>Location</label><input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Client</label><input value={client} onChange={e => setClient(e.target.value)} style={inputStyle} /></div>
            <div>
              <label style={lbl}>Responsible</label>
              <select value={responsible} onChange={e => setResponsible(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">— None —</option>
                {allUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: MCORE_DARK, margin: '0 0 16px' }}>Project Dates</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { title: 'TENDER', fields: [['Start', tenderStart, setTenderStart], ['Offers Received', tenderOffersReceived, setTenderOffersReceived], ['Offers Review', tenderOffersReview, setTenderOffersReview], ['Finish', tenderFinish, setTenderFinish]] },
              { title: 'CONTRACTING', fields: [['Start', contractingStart, setContractingStart], ['Review Legal', contractingReviewLegal, setContractingReviewLegal], ['Finish', contractingFinish, setContractingFinish]] },
              { title: 'CONSTRUCTION', fields: [['Proceed Notice', constructionProceedNotice, setConstructionProceedNotice], ['Start', constructionStart, setConstructionStart], ['Finish Estimated', constructionFinishEstimated, setConstructionFinishEstimated]] },
              { title: 'CONTRACT', fields: [['Contract Start', contractStart, setContractStart], ['Contract Finish', contractFinish, setContractFinish]] },
            ].map(section => (
              <div key={section.title} style={{ background: '#f9fafb', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: '#0C447C', marginBottom: 10, letterSpacing: 0.5 }}>{section.title}</div>
                {section.fields.map(([label, value, setter]: any) => (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <label style={lbl}>{label}</label>
                    <input type="date" value={value} onChange={e => setter(e.target.value)} style={inputStyle} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: MCORE_DARK, margin: 0 }}>Activities & Weights</h2>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: totalWeight === 100 ? '#ecfdf5' : '#fef2f2', color: totalWeight === 100 ? '#065f46' : '#dc2626' }}>
              Total: {totalWeight}%
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: -8, marginBottom: 16 }}>
            Renaming or hiding a default category only affects this project — other projects keep it as-is. Custom categories created for this project only can be renamed or deleted for real.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {visibleActivities.map(a => (
              <div key={a.id} style={{ background: a.project_id ? '#eff6ff' : '#f9fafb', borderRadius: 8, padding: 10 }}>
                {renamingId === a.id ? (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(a); if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) } }}
                      style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, flex: 1 }} />
                    <button onClick={() => handleRenameSave(a)} style={{ ...btn(BLUE), padding: '4px 8px', fontSize: 11 }}>✓</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: MCORE_DARK }}>
                      {activityName(a)} {a.project_id && <span style={{ color: BLUE, fontSize: 10 }}>(custom)</span>}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setRenamingId(a.id); setRenameValue(activityName(a)) }}
                        title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, color: '#9ca3af' }}>✎</button>
                      <button onClick={() => handleDeleteActivity(a)}
                        title={a.project_id ? 'Delete' : 'Hide for this project'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, color: DELETE_RED }}>🗑</button>
                    </div>
                  </div>
                )}
                <input type="number" min={0} max={100} value={weights[a.id] ?? a.default_weight ?? 0}
                  onChange={e => setWeights(prev => ({ ...prev, [a.id]: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  onFocus={e => e.target.select()}
                  style={{ ...inputStyle, textAlign: 'center', fontWeight: 600, fontSize: 14 }} />
              </div>
            ))}
          </div>

          {hiddenActivities.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Hidden for this project:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hiddenActivities.map(a => (
                  <button key={a.id} onClick={() => restoreActivity(a)}
                    style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 99, padding: '4px 10px', cursor: 'pointer' }}>
                    ↺ {activityName(a)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 8 }}>+ Add new category</label>
            <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" style={{ ...inputStyle, flex: 2 }} />
              <input type="number" min={0} max={100} value={newCatWeight}
                onChange={e => setNewCatWeight(Math.min(100, Math.max(0, Number(e.target.value))))}
                onFocus={e => e.target.select()} placeholder="%" style={{ ...inputStyle, width: 70, textAlign: 'center' }} />
              <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {addingCat ? '...' : '+ Add'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={btn(BLUE)}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

