'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ACTIVITIES = [
  { id: 1, name: 'Excavatii', weight: 5 },
  { id: 2, name: 'Fundatii', weight: 15 },
  { id: 3, name: 'Structura', weight: 15 },
  { id: 4, name: 'Inchideri Perimetrale', weight: 10 },
  { id: 5, name: 'Acoperis', weight: 10 },
  { id: 6, name: 'Inst. Sanitare', weight: 15 },
  { id: 7, name: 'Inst. Electrice', weight: 15 },
  { id: 8, name: 'Sistematizare', weight: 15 },
]

export default function NewReportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [worksDone, setWorksDone] = useState('')
  const [worksPlanned, setWorksPlanned] = useState('')
  const [activities, setActivities] = useState(ACTIVITIES.map(a => ({ ...a, progress: 0 })))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
  }, [])

  const totalProgress = activities.reduce((s, a) => s + a.progress * a.weight / 100, 0)

  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/reports/parse-excel', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.ok && data.parsed) {
      const p = data.parsed
      setPeriodStart(p.period_start || '')
      setPeriodEnd(p.period_end || '')
      setWorksDone(p.works_done || '')
      setWorksPlanned(p.works_planned || '')
      setActivities(prev => prev.map((a, i) => ({ ...a, progress: p.activities?.[i]?.progress ?? a.progress })))
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!projectId) return alert('Selecteaza un proiect')
    setSaving(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, period_start: periodStart, period_end: periodEnd, works_done: worksDone, works_planned: worksPlanned, activities: activities.map(a => ({ activity_id: a.id, progress: a.progress })), payments: [], created_by: null }),
    })
    const data = await res.json()
    if (data.ok) router.push(`/reports/${data.id}`)
    else alert('Eroare: ' + data.error)
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#0C447C', color: '#fff', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>Progress Platform</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcel} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
            {uploading ? 'Se proceseaza...' : '📤 Upload Excel'}
          </button>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14 }}>← Inapoi</button>
        </div>
      </header>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 24 }}>Raport nou</h1>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Informatii generale</h2>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Proiect *</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14 }}>
              <option value="">— Selecteaza proiect —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Start</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Sfarsit</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14 }} />
            </div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500 }}>Progres activitati</h2>
            <span style={{ fontSize: 22, fontWeight: 600, color: '#185FA5' }}>{totalProgress.toFixed(2)}%</span>
          </div>
          {activities.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 180, fontSize: 13, flexShrink: 0 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', width: 28, flexShrink: 0 }}>{a.weight}%</span>
              <input type="range" min={0} max={100} value={a.progress}
                onChange={e => setActivities(prev => prev.map(x => x.id === a.id ? { ...x, progress: Number(e.target.value) } : x))}
                style={{ flex: 1, accentColor: '#185FA5' }} />
              <input type="number" min={0} max={100} value={a.progress}
                onChange={e => setActivities(prev => prev.map(x => x.id === a.id ? { ...x, progress: Math.min(100, Math.max(0, Number(e.target.value))) } : x))}
                style={{ width: 56, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, textAlign: 'center' }} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>%</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Lucrari</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Desfasurate</label>
              <textarea value={worksDone} onChange={e => setWorksDone(e.target.value)} rows={4} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Planificate</label>
              <textarea value={worksPlanned} onChange={e => setWorksPlanned(e.target.value)} rows={4} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => router.back()} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Anuleaza</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 28px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Se salveaza...' : 'Salveaza raportul'}
          </button>
        </div>
      </main>
    </div>
  )
}
