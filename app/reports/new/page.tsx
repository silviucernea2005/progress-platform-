'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const BLUE = '#185FA5'
const ORANGE = '#D46A28'

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

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState(searchParams.get('project') || '')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [worksDone, setWorksDone] = useState('')
  const [worksPlanned, setWorksPlanned] = useState('')
  const [redFlags, setRedFlags] = useState('')
  const [activities, setActivities] = useState(ACTIVITIES.map(a => ({ ...a, progress: 0 })))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
  }, [])

  // Prefill from previous report
  useEffect(() => {
    const pid = searchParams.get('project') || projectId
    if (!pid) return
    const prefill = localStorage.getItem(`prefill_report_${pid}`)
    if (prefill && searchParams.get('prefill') === '1') {
      const data = JSON.parse(prefill)
      setProjectId(data.project_id || pid)
      if (data.activities?.length) {
        setActivities(ACTIVITIES.map(a => {
          const found = data.activities.find((x: any) => x.activity_id === a.id)
          return { ...a, progress: found ? found.progress : 0 }
        }))
      }
    }
  }, [projectId])

  // Load custom weights for selected project
  useEffect(() => {
    if (!projectId) return
    const savedWeights = localStorage.getItem(`project_weights_${projectId}`)
    if (savedWeights) {
      const w = JSON.parse(savedWeights)
      setActivities(prev => prev.map(a => ({ ...a, weight: w[a.id] !== undefined ? w[a.id] : a.weight })))
    }
  }, [projectId])

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
    if (!projectId) return alert('Select a project')
    setSaving(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        period_start: periodStart,
        period_end: periodEnd,
        works_done: worksDone,
        works_planned: worksPlanned,
        red_flags: redFlags,
        activities: activities.map(a => ({ activity_id: a.id, progress: a.progress })),
        payments: [],
        created_by: null
      }),
    })
    const data = await res.json()
    if (data.ok) {
      localStorage.removeItem(`prefill_report_${projectId}`)
      router.push(`/reports/${data.id}`)
    } else alert('Error: ' + data.error)
    setSaving(false)
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box' as any, outline: 'none' }
  const lbl = { display: 'block' as any, fontSize: 13, fontWeight: 500 as any, marginBottom: 6, color: '#374151' }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: MCORE_DARK, color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: BLUE, borderRadius: 7, padding: '3px 9px', fontWeight: 900, fontSize: 15, letterSpacing: 1 }}>S7</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Square 7</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>PART OF M.CORE</div>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 8px' }} />
          <span style={{ fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>New Report</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcel} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 13px', fontSize: 12, cursor: 'pointer' }}>
            {uploading ? 'Processing...' : '📤 Upload Excel'}
          </button>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: MCORE_DARK, marginBottom: 24 }}>New Report</h1>

        {/* General info */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: MCORE_DARK }}>General Information</h2>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Project *</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inp}>
              <option value="">— Select project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Period start</label><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Period end</label><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inp} /></div>
          </div>
        </div>

        {/* Activities */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: MCORE_DARK, margin: 0 }}>Activities Progress</h2>
            <span style={{ fontSize: 22, fontWeight: 700, color: ORANGE }}>{totalProgress.toFixed(2)}%</span>
          </div>
          {activities.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 190, fontSize: 13, flexShrink: 0, color: MCORE_DARK }}>{a.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', width: 28, flexShrink: 0 }}>{a.weight}%</span>
              <input type="range" min={0} max={100} value={a.progress}
                onChange={e => setActivities(prev => prev.map(x => x.id === a.id ? { ...x, progress: Number(e.target.value) } : x))}
                style={{ flex: 1, accentColor: ORANGE }} />
              <input type="number" min={0} max={100} value={a.progress}
                onChange={e => setActivities(prev => prev.map(x => x.id === a.id ? { ...x, progress: Math.min(100, Math.max(0, Number(e.target.value))) } : x))}
                style={{ width: 56, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, textAlign: 'center' }} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>%</span>
            </div>
          ))}
        </div>

        {/* Works & Red Flags */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: MCORE_DARK }}>Works & Notes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Works completed</label>
              <textarea value={worksDone} onChange={e => setWorksDone(e.target.value)} rows={4}
                style={{ ...inp, resize: 'none' }} placeholder="- Work 1&#10;- Work 2" />
            </div>
            <div>
              <label style={lbl}>Works planned</label>
              <textarea value={worksPlanned} onChange={e => setWorksPlanned(e.target.value)} rows={4}
                style={{ ...inp, resize: 'none' }} placeholder="- Planned 1&#10;- Planned 2" />
            </div>
          </div>
          <div>
            <label style={{ ...lbl, color: '#7f1d1d' }}>🚩 Red Flags</label>
            <textarea value={redFlags} onChange={e => setRedFlags(e.target.value)} rows={3}
              style={{ ...inp, border: '1px solid #fecaca', resize: 'none' }} placeholder="Any issues or risks..." />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => router.back()} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 28px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save report'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default function NewReportPage() {
  return (
    <Suspense>
      <NewReportForm />
    </Suspense>
  )
}
