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
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if ((window as any).pdfjsLib) return
    const pdfScript = document.createElement('script')
    pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    pdfScript.onload = () => {
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
    document.head.appendChild(pdfScript)
  }, [])

  // Resize/compress images before staging — keeps things fast and avoids huge uploads
  function compressImage(dataUrl: string, maxWidth = 1400, quality = 0.72): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(dataUrl); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }

  // Extract embedded images from Office Open XML files (xlsx/docx are ZIP archives)
  async function extractOfficeImages(file: File): Promise<string[]> {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    const mediaPrefix = /\.xlsx$/i.test(file.name) ? 'xl/media/' : 'word/media/'
    const mediaEntries = Object.keys(zip.files)
      .filter(name => name.startsWith(mediaPrefix) && !zip.files[name].dir)
      .filter(name => /\.(png|jpe?g|gif|bmp)$/i.test(name))
      .sort()
    const images: string[] = []
    for (const name of mediaEntries) {
      const ext = name.split('.').pop()!.toLowerCase()
      const mime = ext === 'jpg' ? 'jpeg' : ext
      const base64 = await zip.files[name].async('base64')
      images.push(`data:image/${mime};base64,${base64}`)
    }
    return images
  }

  async function handlePhotoDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    setUploadingPhoto(true)
    const newPhotos: string[] = []
    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((res, rej) => {
            reader.onload = () => res(reader.result as string)
            reader.onerror = () => rej(new Error('read failed'))
            reader.readAsDataURL(file)
          })
          newPhotos.push(await compressImage(dataUrl))
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const reader = new FileReader()
          await new Promise<void>(res => {
            reader.onload = async () => {
              try {
                const pdfjsLib = (window as any).pdfjsLib
                if (pdfjsLib) {
                  const pdf = await pdfjsLib.getDocument({ data: reader.result }).promise
                  const numPages = pdf.numPages
                  for (let p = 1; p <= Math.min(numPages, 10); p++) {
                    const page = await pdf.getPage(p)
                    const viewport = page.getViewport({ scale: 1.5 })
                    const canvas = document.createElement('canvas')
                    canvas.width = viewport.width
                    canvas.height = viewport.height
                    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
                    newPhotos.push(await compressImage(canvas.toDataURL('image/jpeg', 0.85)))
                  }
                }
              } catch {}
              res()
            }
            reader.readAsArrayBuffer(file)
          })
        } else if (file.name.match(/\.(xlsx|docx)$/i)) {
          try {
            const images = await extractOfficeImages(file)
            for (const img of images) newPhotos.push(await compressImage(img))
          } catch {}
        }
      }
    } catch {}
    setPhotos(prev => [...prev, ...newPhotos])
    setUploadingPhoto(false)
  }

  function removeStagedPhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push(`/login?returnTo=${encodeURIComponent('/reports/new' + (projectId ? `?project=${projectId}` : ''))}`)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
  }, [])

  // Prefill activity progress from the project's most recent report — always, whenever a
  // project is selected (not just when arriving from a specific "New Report" button/flow).
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/reports?project_id=${projectId}`)
      .then(r => r.json())
      .then(list => {
        if (!Array.isArray(list) || !list.length) return
        const latest = list[0] // /api/reports already sorts by period_start descending
        if (latest?.activities?.length) {
          setActivities(prev => prev.map(a => {
            const found = latest.activities.find((x: any) => x.activity_id === a.id)
            return { ...a, progress: found ? found.progress : a.progress }
          }))
        }
      })
      .catch(() => {})
  }, [projectId])

  // Load the project's saved activity weights from the server (same weights used by the last edited report)
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/settings`)
      .then(r => r.json())
      .then(data => {
        const w = data?.weights || {}
        if (Object.keys(w).length) {
          setActivities(prev => prev.map(a => ({ ...a, weight: w[a.id] !== undefined ? w[a.id] : a.weight })))
        }
      })
      .catch(() => {})
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
      if (photos.length) {
        await fetch(`/api/reports/${data.id}/photos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos })
        }).catch(() => {})
      }
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

        {/* Photos */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: MCORE_DARK }}>Site Photos & Attachments</h2>
          {photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: '#f3f4f6' }}>
                  <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removeStagedPhoto(i)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 99, width: 22, height: 22, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handlePhotoDrop}
            style={{ border: `2px dashed ${dragOver ? BLUE : '#d1d5db'}`, borderRadius: 10, padding: 24, textAlign: 'center', background: dragOver ? '#eff6ff' : '#f9fafb', transition: 'all 0.2s', cursor: 'pointer' }}>
            {uploadingPhoto ? (
              <div style={{ color: BLUE, fontSize: 13 }}>Processing files...</div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Drag & drop photos, PDF, Excel or Word here</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Photos added directly · PDF pages & Excel/Word images extracted automatically</div>
              </>
            )}
          </div>
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

