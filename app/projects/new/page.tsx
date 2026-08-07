'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BLUE = '#185FA5'
const MCORE_RED = '#A70202'
const NAV_BG = '#22304A'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [client, setClient] = useState('')
  const [saving, setSaving] = useState(false)

  const [projectId, setProjectId] = useState<string | null>(null)
  const [step, setStep] = useState<'info' | 'dates' | 'weights'>('info')
  const [activities, setActivities] = useState<any[]>([])
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatWeight, setNewCatWeight] = useState<number>(0)
  const [addingCat, setAddingCat] = useState(false)
  const [savingWeights, setSavingWeights] = useState(false)
  const [existingProjects, setExistingProjects] = useState<any[]>([])
  const [similarWarning, setSimilarWarning] = useState<string | null>(null)

  // Project Dates (Tender / Contracting / Construction / Contract) — same fields used
  // on the report page, but this is the important place to set them: right when the
  // project is created.
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
  const [savingDates, setSavingDates] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setExistingProjects(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Escape discards and goes back, same as the New Report page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirm('Discard and go back?')) router.back()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
    return dp[m][n]
  }

  function findSimilarProject(candidateName: string): string | null {
    const norm = candidateName.trim().toLowerCase()
    if (!norm) return null
    for (const p of existingProjects) {
      const pNorm = (p.name || '').trim().toLowerCase()
      if (!pNorm) continue
      if (pNorm === norm) return p.name
      if (pNorm.includes(norm) || norm.includes(pNorm)) return p.name
      const dist = levenshtein(norm, pNorm)
      const maxLen = Math.max(norm.length, pNorm.length)
      if (maxLen > 0 && dist / maxLen < 0.25) return p.name
    }
    return null
  }

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/activities?project_id=${projectId}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setActivities(data)
        setWeights(prev => {
          const next = { ...prev }
          data.forEach((a: any) => { if (next[a.id] === undefined) next[a.id] = a.default_weight })
          return next
        })
      }
    })
  }, [projectId])

  async function handleCreateProject(skipCheck = false) {
    if (!name) return alert('Project name is required')
    if (!skipCheck) {
      const similar = findSimilarProject(name)
      if (similar) {
        setSimilarWarning(similar)
        return
      }
    }
    setSimilarWarning(null)
    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location, client, status: 'active' }),
    })
    const data = await res.json()
    if (data.ok) { setProjectId(data.id); setStep('dates') }
    else alert('Error: ' + data.error)
    setSaving(false)
  }

  async function handleSaveDates(skip = false) {
    if (!projectId) return
    if (!skip) {
      setSavingDates(true)
      const dates = {
        tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish,
        contractingStart, contractingReviewLegal, contractingFinish,
        constructionProceedNotice, constructionStart, constructionFinishEstimated,
        contractStart, contractFinish
      }
      try {
        await fetch(`/api/projects/${projectId}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dates }) })
      } catch {
        alert('Network error saving the dates. You can still set them later from the report page.')
      }
      setSavingDates(false)
    }
    setStep('weights')
  }

  async function handleAddCategory() {
    if (!newCatName.trim() || !projectId) return
    setAddingCat(true)
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), default_weight: newCatWeight, project_id: projectId }),
    })
    const data = await res.json()
    if (data.ok) {
      setActivities(prev => [...prev, data.activity])
      setWeights(prev => ({ ...prev, [data.activity.id]: newCatWeight }))
      setNewCatName('')
      setNewCatWeight(0)
    } else alert('Error: ' + data.error)
    setAddingCat(false)
  }

  async function handleFinish() {
    setSavingWeights(true)
    await fetch(`/api/projects/${projectId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weights }),
    })
    setSavingWeights(false)
    router.push('/dashboard')
  }

  const totalWeight = activities.reduce((s, a) => s + (weights[a.id] ?? a.default_weight ?? 0), 0)

  const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' as any }

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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.15)' }} />
          <button className="s7-btn" onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 13, padding: '6px 14px' }}>← Inapoi</button>
        </div>
      </header>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 8 }}>New Project</h1>
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, fontSize: 12, color: '#9ca3af' }}>
          <span style={{ fontWeight: step === 'info' ? 700 : 400, color: step === 'info' ? BLUE : '#9ca3af' }}>1. Basic Info</span>
          <span>→</span>
          <span style={{ fontWeight: step === 'dates' ? 700 : 400, color: step === 'dates' ? BLUE : '#9ca3af' }}>2. Project Dates</span>
          <span>→</span>
          <span style={{ fontWeight: step === 'weights' ? 700 : 400, color: step === 'weights' ? BLUE : '#9ca3af' }}>3. Activity Weights</span>
        </div>

        <div className="s7-card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20, opacity: step !== 'info' ? 0.6 : 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Project Name *</label>
            <input value={name} onChange={e => { setName(e.target.value); setSimilarWarning(null) }} disabled={step !== 'info'} style={inputStyle} placeholder="e.g. Bocsa Retail Park" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} disabled={step !== 'info'} style={inputStyle} placeholder="e.g. Bocsa, Caras-Severin" />
          </div>
          <div style={{ marginBottom: step !== 'info' ? 0 : 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Client</label>
            <input value={client} onChange={e => setClient(e.target.value)} disabled={step !== 'info'} style={inputStyle} placeholder="e.g. Lidl Romania" />
          </div>

          {similarWarning && step === 'info' && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠️ A project with an identical or similar name already exists: <strong>"{similarWarning}"</strong>. Are you sure you want to create a new, separate project?
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button onClick={() => { setSimilarWarning(null); handleCreateProject(true) }}
                  style={{ padding: '6px 14px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Continue anyway</button>
                <button onClick={() => setSimilarWarning(null)}
                  style={{ padding: '6px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'info' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="s7-btn" onClick={() => router.back()} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button className="s7-btn" onClick={() => handleCreateProject()} disabled={saving} style={{ padding: '10px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          )}
        </div>

        {step === 'dates' && (
          <div className="s7-card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Project Dates</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>These drive the "Contract Plan" line and delay tracking on the report page. You can still adjust them later from the report if needed.</p>
            <div className="s7-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
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
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{label}</label>
                      <input type="date" value={value} onChange={e => setter(e.target.value)} style={inputStyle} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="s7-btn" onClick={() => handleSaveDates(true)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Skip for now</button>
              <button className="s7-btn" onClick={() => handleSaveDates(false)} disabled={savingDates} style={{ padding: '10px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {savingDates ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {step === 'weights' && (
          <div className="s7-card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>Activity Weights</h2>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: totalWeight === 100 ? '#ecfdf5' : '#fef2f2', color: totalWeight === 100 ? '#065f46' : '#dc2626' }}>
                Total: {totalWeight}%
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {activities.map(a => (
                <div key={a.id} style={{ background: '#f9fafb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', marginBottom: 6 }}>{a.name}{a.project_id && <span style={{ color: BLUE, marginLeft: 6, fontSize: 10 }}>(custom)</span>}</div>
                  <input type="number" min={0} max={100} value={weights[a.id] ?? a.default_weight}
                    onChange={e => setWeights(prev => ({ ...prev, [a.id]: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                    onFocus={e => e.target.select()}
                    style={{ ...inputStyle, textAlign: 'center', fontWeight: 600 }} />
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>+ Add new category</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name (e.g. Glass facades)" style={{ ...inputStyle, flex: 2 }} />
                <input type="number" min={0} max={100} value={newCatWeight}
                  onChange={e => setNewCatWeight(Math.min(100, Math.max(0, Number(e.target.value))))}
                  onFocus={e => e.target.select()} placeholder="%" style={{ ...inputStyle, flex: 1, textAlign: 'center' }} />
                <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()} style={{ padding: '9px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {addingCat ? '...' : '+ Add'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="s7-btn" onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Skip</button>
              <button className="s7-btn" onClick={handleFinish} disabled={savingWeights} style={{ padding: '10px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {savingWeights ? 'Saving...' : 'Save weights & Finish'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


