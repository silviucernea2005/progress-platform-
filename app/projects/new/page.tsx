'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BLUE = '#185FA5'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [client, setClient] = useState('')
  const [saving, setSaving] = useState(false)

  const [projectId, setProjectId] = useState<string | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatWeight, setNewCatWeight] = useState<number>(0)
  const [addingCat, setAddingCat] = useState(false)
  const [savingWeights, setSavingWeights] = useState(false)
  const [existingProjects, setExistingProjects] = useState<any[]>([])
  const [similarWarning, setSimilarWarning] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setExistingProjects(Array.isArray(d) ? d : [])).catch(() => {})
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
    if (!name) return alert('Numele proiectului este obligatoriu')
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
    if (data.ok) setProjectId(data.id)
    else alert('Eroare: ' + data.error)
    setSaving(false)
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
    } else alert('Eroare: ' + data.error)
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
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#0C447C', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>Progress Platform</span>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14 }}>← Inapoi</button>
      </header>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 24 }}>Proiect nou</h1>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20, opacity: projectId ? 0.6 : 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Nume proiect *</label>
            <input value={name} onChange={e => { setName(e.target.value); setSimilarWarning(null) }} disabled={!!projectId} style={inputStyle} placeholder="Ex: Bocsa Retail Park" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Locatie</label>
            <input value={location} onChange={e => setLocation(e.target.value)} disabled={!!projectId} style={inputStyle} placeholder="Ex: Bocsa, Caras-Severin" />
          </div>
          <div style={{ marginBottom: projectId ? 0 : 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Client</label>
            <input value={client} onChange={e => setClient(e.target.value)} disabled={!!projectId} style={inputStyle} placeholder="Ex: Lidl Romania" />
          </div>

          {similarWarning && !projectId && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠️ Există deja un proiect cu un nume identic sau similar: <strong>"{similarWarning}"</strong>. Sigur vrei să creezi un proiect nou, separat?
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button onClick={() => { setSimilarWarning(null); handleCreateProject(true) }}
                  style={{ padding: '6px 14px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Continuă totuși</button>
                <button onClick={() => setSimilarWarning(null)}
                  style={{ padding: '6px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Anulează</button>
              </div>
            </div>
          )}

          {!projectId && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => router.back()} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Anuleaza</button>
              <button onClick={() => handleCreateProject()} disabled={saving} style={{ padding: '10px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {saving ? 'Se salveaza...' : 'Continua →'}
              </button>
            </div>
          )}
        </div>

        {projectId && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>Ponderi activitati</h2>
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>+ Adauga categorie noua</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nume categorie (ex: Fatade sticla)" style={{ ...inputStyle, flex: 2 }} />
                <input type="number" min={0} max={100} value={newCatWeight}
                  onChange={e => setNewCatWeight(Math.min(100, Math.max(0, Number(e.target.value))))}
                  onFocus={e => e.target.select()} placeholder="%" style={{ ...inputStyle, flex: 1, textAlign: 'center' }} />
                <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()} style={{ padding: '9px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {addingCat ? '...' : '+ Adauga'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Sari peste</button>
              <button onClick={handleFinish} disabled={savingWeights} style={{ padding: '10px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {savingWeights ? 'Se salveaza...' : 'Salveaza ponderi & Termina'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

