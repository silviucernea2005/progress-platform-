'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const MCORE_RED = '#A70202'
const NAV_BG = '#22304A'
const BLUE = '#185FA5'
const GREEN = '#3B9E4A'
const DELETE_RED = '#B3261E'

type Photo = { id: string; folder_date: string; folder_name: string; url: string; created_at: string }
type Folder = { key: string; date: string; name: string; photos: Photo[] }
type Pending = { id: string; file: File; preview: string }   // chosen but NOT saved yet
type Notice = { kind: 'ok' | 'warn' | 'error'; text: string }

const inputStyle: any = { border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 11px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }
const smallBtn = (bg: string, color = '#fff'): any => ({ background: bg, color, border: 'none', borderRadius: 7, padding: '6px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer' })

const cleanName = (n: string) => n.trim().replace(/\s+/g, ' ').slice(0, 80)
const saneDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000 && Number(d.slice(0, 4)) <= 2100
const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const folderLabel = (f: { date: string; name: string }) => (f.name ? `${f.date} · ${f.name}` : f.date)

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('could not read the file'))
    r.readAsDataURL(file)
  })
}

// Photos are shrunk in the browser before upload (like report photos), a bit larger here since
// this is an archive: max 2000 px wide, JPEG quality 0.82.
function compress(dataUrl: string, maxWidth = 2000, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height) // transparent PNGs would turn black as JPEG
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function ProjectPhotosPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [me, setMe] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const isAdmin = me?.role === 'admin'

  // The selected day drives everything: the folder(s) shown on top, and where new photos go.
  const [selectedDate, setSelectedDate] = useState(todayLocal())
  // Where new photos go. By default: the folder that already exists for the selected day.
  // Only when asked ('new') is a separate folder created — and then folderName is its name.
  const [targetChoice, setTargetChoice] = useState<{ date: string; key: string } | null>(null)
  const [folderName, setFolderName] = useState('')
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [notice, setNotice] = useState<Notice | null>(null)

  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<{ key: string; date: string; name: string } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  // ---- lightbox (same behaviour as the report photo viewer: wheel zoom, drag, swipe, Back closes it)
  const [lb, setLb] = useState<{ key: string; i: number } | null>(null)
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 })
  const zoomRef = useRef({ scale: 1, x: 0, y: 0 })
  const lbEl = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const dragMoved = useRef(false)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    (async () => {
      const m = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({}))
      setMe(m.user || null)
      setAuthChecked(true)
      if (!m.user) { setLoading(false); return }
      try {
        const [project, list] = await Promise.all([
          fetch(`/api/projects/${projectId}`).then(r => r.json()),
          fetch(`/api/projects/${projectId}/photos`).then(async r => ({ ok: r.ok, body: await r.json().catch(() => null) })),
        ])
        setProjectName(project?.name || '')
        if (!list.ok) setLoadError(list.body?.error || 'Could not load the photos.')
        else {
          const rows: Photo[] = Array.isArray(list.body) ? list.body : []
          setPhotos(rows)
          // Admins start on today (that's where they upload); viewers start on the newest day that has photos
          if (m.user.role !== 'admin' && rows.length) setSelectedDate(rows.map(r => r.folder_date).sort().pop()!)
        }
      } catch {
        setLoadError('Could not load the photos.')
      }
      setLoading(false)
    })()
  }, [projectId])

  const folders: Folder[] = useMemo(() => {
    const map = new Map<string, Folder>()
    for (const p of photos) {
      const key = `${p.folder_date}|${p.folder_name}`
      if (!map.has(key)) map.set(key, { key, date: p.folder_date, name: p.folder_name, photos: [] })
      map.get(key)!.photos.push(p)
    }
    const list = Array.from(map.values())
    list.forEach(f => f.photos.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')))
    return list.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
  }, [photos])


  const latestIn = (f: Folder) => f.photos.reduce((m, p) => ((p.created_at || '') > m ? (p.created_at || '') : m), '')
  const dayFoldersAll = folders.filter(f => f.date === selectedDate)
  const defaultTarget = dayFoldersAll.length ? [...dayFoldersAll].sort((a, b) => latestIn(b).localeCompare(latestIn(a)))[0] : null   // the folder used most recently that day
  const effTargetKey: string =
    targetChoice && targetChoice.date === selectedDate && (targetChoice.key === 'new' || dayFoldersAll.some(f => f.key === targetChoice.key))
      ? targetChoice.key
      : (defaultTarget?.key ?? 'new')
  const targetFolder = effTargetKey === 'new' ? null : (dayFoldersAll.find(f => f.key === effTargetKey) || null)
  const destination = targetFolder ? { date: targetFolder.date, name: targetFolder.name } : { date: selectedDate, name: cleanName(folderName) }

  // ---------------- upload: choose photos -> press Save -> verified against the server ----------------
  const makePreview = (f: File) => { try { return URL.createObjectURL(f) } catch { return '' } }
  const dropPreview = (u: string) => { try { if (u) URL.revokeObjectURL(u) } catch {} }

  function stageFiles(files: File[]) {
    if (!isAdmin || uploading || !files.length) return
    const images = files.filter(f => f.type.startsWith('image/'))
    const skipped = files.length - images.length
    setNotice(skipped ? { kind: 'warn', text: `${skipped} file${skipped === 1 ? ' was' : 's were'} skipped — only images can be added here.` } : null)
    if (!images.length) return
    setPending(prev => [...prev, ...images.map(f => ({ id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`, file: f, preview: makePreview(f) }))])
  }

  function removePending(id: string) {
    setPending(prev => { prev.filter(p => p.id === id).forEach(p => dropPreview(p.preview)); return prev.filter(p => p.id !== id) })
  }
  function clearPending() {
    setPending(prev => { prev.forEach(p => dropPreview(p.preview)); return [] })
  }

  async function savePending() {
    if (!isAdmin || uploading || !pending.length) return
    if (!saneDate(selectedDate)) { alert('Pick a valid date (year 2000–2100).'); return }
    if (!targetFolder && dayFoldersAll.some(f => f.name === destination.name)) {
      alert(destination.name
        ? `A folder named "${destination.name}" already exists for ${selectedDate}. Choose it in the "Save into" list, or type a different name for the new folder.`
        : `This day already has a folder without a name. Choose it in the "Save into" list, or give the new folder a name.`)
      return
    }
    const date = destination.date, name = destination.name, label = folderLabel({ date, name })
    const batch = pending
    const failed: { p: Pending; msg: string }[] = []
    const savedIds: string[] = []
    setNotice(null)
    setUploading({ done: 0, total: batch.length })
    for (let i = 0; i < batch.length; i++) {
      const p = batch[i]
      try {
        const small = await compress(await readAsDataUrl(p.file))
        if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(small)) throw new Error('unsupported image format')
        const res = await fetch(`/api/projects/${projectId}/photos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: small, folder_date: date, folder_name: name }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `error ${res.status}`)
        savedIds.push(data.id)
      } catch (e: any) {
        failed.push({ p, msg: e.message })
      }
      setUploading({ done: i + 1, total: batch.length })
    }
    setUploading(null)

    // saved photos leave the "not saved yet" list; failed ones stay so Save can simply be pressed again
    const failedIds = new Set(failed.map(f => f.p.id))
    batch.forEach(p => { if (!failedIds.has(p.id)) dropPreview(p.preview) })
    setPending(prev => prev.filter(p => failedIds.has(p.id) || !batch.some(b => b.id === p.id)))

    // don't just trust the uploads: read the folder back from the server and count what is really there
    let fresh: Photo[] | null = null
    try {
      const r = await fetch(`/api/projects/${projectId}/photos`)
      if (r.ok) { const rows = await r.json(); if (Array.isArray(rows)) fresh = rows }
    } catch {}
    if (fresh) setPhotos(fresh)
    const confirmed = fresh ? savedIds.filter(id => fresh!.some(x => x.id === id)).length : savedIds.length
    const inFolder = fresh ? fresh.filter(x => x.folder_date === date && x.folder_name === name).length : null
    const plural = (n: number) => `${n} photo${n === 1 ? '' : 's'}`

    if (!savedIds.length) {
      setNotice({ kind: 'error', text: `Nothing was saved. ${failed.slice(0, 3).map(f => `${f.p.file.name}: ${f.msg}`).join(' · ')}` })
    } else if (failed.length || confirmed < savedIds.length) {
      const parts = [`${plural(confirmed)} saved in folder "${label}".`]
      if (failed.length) parts.push(`${plural(failed.length)} NOT saved (still in the list above — press Save to try again): ${failed.slice(0, 3).map(f => `${f.p.file.name}: ${f.msg}`).join(' · ')}`)
      if (confirmed < savedIds.length) parts.push(`${plural(savedIds.length - confirmed)} reported as saved but not found on the server — please check.`)
      setNotice({ kind: 'warn', text: parts.join(' ') })
    } else {
      setNotice({ kind: 'ok', text: `✓ Saved: ${plural(confirmed)} in folder "${label}".${inFolder !== null ? ` The folder now has ${plural(inFolder)}.` : ''}` })
    }
    // next photos continue in the folder that now exists, instead of making another one
    setTargetChoice(null)
    setFolderName('')
  }

  // ---------------- folder / photo actions (admin) ----------------
  async function saveFolderEdit() {
    if (!editing) return
    const f = folders.find(x => x.key === editing.key)
    if (!f) { setEditing(null); return }
    if (!saneDate(editing.date)) { alert('Pick a valid folder date (year 2000–2100).'); return }
    const name = cleanName(editing.name)
    const clash = folders.find(x => x.key !== f.key && x.date === editing!.date && x.name === name)
    if (clash && !confirm(`A folder "${folderLabel({ date: editing.date, name })}" already exists (${clash.photos.length} photo${clash.photos.length === 1 ? '' : 's'}). Merge these ${f.photos.length} photo${f.photos.length === 1 ? '' : 's'} into it?`)) return
    setBusyKey(f.key)
    try {
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: f.photos.map(p => p.id), folder_date: editing.date, folder_name: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `error ${res.status}`)
      const ids = new Set(f.photos.map(p => p.id))
      setPhotos(prev => prev.map(p => ids.has(p.id) ? { ...p, folder_date: editing.date, folder_name: name } : p))
      // carry over only an explicit open/closed choice made by the user; never force a folder open
      setOpen(o => { const { [f.key]: wasOpen, ...rest } = o; return wasOpen === undefined ? rest : { ...rest, [`${editing.date}|${name}`]: wasOpen } })
      setSelectedDate(editing.date)   // follow the folder to its new day
      setNotice({ kind: 'ok', text: `✓ Folder saved: ${folderLabel({ date: editing.date, name })} (${f.photos.length} photo${f.photos.length === 1 ? '' : 's'}).` })
      setEditing(null)
    } catch (e: any) {
      alert(`Could not change the folder: ${e.message}`)
    }
    setBusyKey(null)
  }

  async function deletePhotos(ids: string[], label: string, key: string) {
    if (!ids.length || !confirm(`Delete ${label}? This cannot be undone.`)) return
    setBusyKey(key)
    try {
      const res = await fetch(`/api/projects/${projectId}/photos`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `error ${res.status}`)
      const gone = new Set(ids)
      setPhotos(prev => prev.filter(p => !gone.has(p.id)))
      setNotice({ kind: 'ok', text: `✓ Deleted ${ids.length} photo${ids.length === 1 ? '' : 's'}.` })
    } catch (e: any) {
      alert(`Could not delete: ${e.message}`)
    }
    setBusyKey(null)
  }

  async function downloadBlob(url: string, filename: string) {
    try {
      const blob = await (await fetch(url)).blob()
      const a = document.createElement('a')
      const objUrl = URL.createObjectURL(blob)
      a.href = objUrl; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
  async function downloadFolderZip(f: Folder) {
    setBusyKey(f.key)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const base = [safe(projectName) || 'project', f.date, safe(f.name)].filter(Boolean).join('_')
      let added = 0
      for (let i = 0; i < f.photos.length; i++) {
        try {
          const res = await fetch(f.photos[i].url)
          if (!res.ok) continue
          const blob = await res.blob()
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
          zip.file(`${base}_${String(i + 1).padStart(2, '0')}.${ext}`, blob)
          added++
        } catch {}
      }
      if (!added) { alert('Could not download the photos. Check your connection and try again.'); setBusyKey(null); return }
      const content = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      const objUrl = URL.createObjectURL(content)
      a.href = objUrl; a.download = `${base}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(objUrl)
      if (added < f.photos.length) alert(`Downloaded ${added} of ${f.photos.length} photos.`)
    } catch {
      alert('Could not create the ZIP file.')
    }
    setBusyKey(null)
  }

  // warn before closing/reloading the tab with photos that were chosen but not saved
  useEffect(() => {
    if (!pending.length && !uploading) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending.length, !!uploading])
  const leave = (go: () => void) => {
    if ((pending.length || uploading) && !confirm('You have photos that are not saved yet. Leave without saving them?')) return
    go()
  }

  // ---------------- lightbox mechanics ----------------
  const lbFolder = lb ? folders.find(f => f.key === lb.key) : undefined
  const lbPhotos = lbFolder?.photos || []
  const lbIdx = lb && lbPhotos.length ? ((lb.i % lbPhotos.length) + lbPhotos.length) % lbPhotos.length : 0

  function setZoomBoth(z: { scale: number; x: number; y: number }) { zoomRef.current = z; setZoom(z) }
  function clampPan(scale: number, x: number, y: number) {
    const maxX = window.innerWidth * 0.45 * scale, maxY = window.innerHeight * 0.44 * scale
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) }
  }
  function zoomAt(factor: number, clientX?: number, clientY?: number) {
    const { scale, x, y } = zoomRef.current
    const next = Math.min(8, Math.max(1, scale * factor))
    if (next === scale) return
    if (next <= 1.001) { setZoomBoth({ scale: 1, x: 0, y: 0 }); return }
    const cx = (clientX ?? window.innerWidth / 2) - window.innerWidth / 2
    const cy = (clientY ?? window.innerHeight / 2) - window.innerHeight / 2
    const k = next / scale
    setZoomBoth({ scale: next, ...clampPan(next, cx - (cx - x) * k, cy - (cy - y) * k) })
  }
  function closeLightbox() {
    if (window.history.state?.s7ProjLightbox) window.history.back()
    else setLb(null)
  }
  function step(delta: number) {
    setLb(cur => cur ? { key: cur.key, i: cur.i + delta } : cur)
  }

  // Back button closes the viewer (instead of leaving the page)
  useEffect(() => {
    if (!lb) return
    window.history.pushState({ s7ProjLightbox: true }, '')
    const onPop = () => setLb(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lb !== null])

  // wheel zoom (needs a non-passive listener so the page behind doesn't scroll)
  useEffect(() => {
    if (!lb) return
    const el = lbEl.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      zoomAt(Math.exp(-dy * 0.0015), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lb !== null])

  useEffect(() => { setZoomBoth({ scale: 1, x: 0, y: 0 }) }, [lb?.key, lb?.i])  // each photo starts at normal size

  useEffect(() => {
    if (!lb) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === '+' || e.key === '=') zoomAt(1.3)
      if (e.key === '-') zoomAt(1 / 1.3)
      if (e.key === '0') setZoomBoth({ scale: 1, x: 0, y: 0 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lb !== null])

  // ---------------- render ----------------
  const header = (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: NAV_BG, color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div onClick={() => leave(() => router.push('/dashboard'))} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ background: MCORE_RED, borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0 }}>M</div>
        <div>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: 0.2 }}>M°Core</span>
          <div style={{ width: 36, height: 2, background: MCORE_RED, margin: '2px 0 2px' }} />
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.2 }}>SQUARE 7</div>
        </div>
        <span className="s7-header-subtitle" style={{ fontWeight: 500, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginLeft: 8 }}>Project photos</span>
      </div>
      <button onClick={() => leave(() => router.back())} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 20, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 13, padding: '6px 14px' }}>← Back</button>
    </header>
  )

  if (!authChecked || loading) return <div style={{ minHeight: '100vh', background: '#FAF9F6' }}>{header}</div>

  if (!me) return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6' }}>
      {header}
      <div style={{ maxWidth: 520, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#374151', margin: '0 0 14px' }}>Project photos are visible to logged-in users only.</p>
        <button onClick={() => router.push('/login')} style={{ ...smallBtn(BLUE), padding: '9px 18px', fontSize: 13 }}>Go to login</button>
      </div>
    </div>
  )

  const current = lbPhotos[lbIdx]
  const dateOk = saneDate(selectedDate)
  const dayFolders = dayFoldersAll
  const otherFolders = folders.filter(f => f.date !== selectedDate)
  // one chip per day that has photos (folders are already sorted newest first)
  const daysWithPhotos = Array.from(folders.reduce((m, f) => m.set(f.date, (m.get(f.date) || 0) + f.photos.length), new Map<string, number>()).entries())

  const renderFolder = (f: Folder, pinned: boolean) => {
    const expanded = pinned || (open[f.key] ?? false)
    const busy = busyKey === f.key
    const isEditing = editing?.key === f.key
    return (
      <div key={f.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 12, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
          <div onClick={() => { if (!pinned) setOpen(o => ({ ...o, [f.key]: !expanded })) }} style={{ flex: '1 1 200px', cursor: pinned ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {!pinned && <span style={{ color: '#9ca3af', fontSize: 12, width: 12 }}>{expanded ? '▼' : '▶'}</span>}
            <span style={{ fontSize: 15, fontWeight: 600, color: MCORE_DARK, overflow: 'hidden', textOverflow: 'ellipsis' }}>📁 {folderLabel(f)}</span>
            <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{f.photos.length} photo{f.photos.length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isAdmin && <button disabled={busy || !!uploading} onClick={() => { setSelectedDate(f.date); setTargetChoice({ date: f.date, key: f.key }); fileInput.current?.click() }} style={smallBtn(BLUE)}>＋ Add photos</button>}
            <button disabled={busy} onClick={() => downloadFolderZip(f)} style={smallBtn('#f3f4f6', '#374151')}>⬇ ZIP</button>
            {isAdmin && <button disabled={busy} onClick={() => setEditing({ key: f.key, date: f.date, name: f.name })} style={smallBtn('#f3f4f6', '#374151')}>✏️ Rename</button>}
            {isAdmin && <button disabled={busy} onClick={() => deletePhotos(f.photos.map(p => p.id), `the folder "${folderLabel(f)}" with ${f.photos.length} photo(s)`, f.key)} style={smallBtn('#fef2f2', DELETE_RED)}>🗑 Delete folder</button>}
          </div>
        </div>

        {isEditing && editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '0 16px 12px' }}>
            <input type="date" min="2000-01-01" max="2100-12-31" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} style={inputStyle} />
            <input value={editing.name} maxLength={80} placeholder="Folder name" onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ ...inputStyle, flex: '1 1 200px' }} />
            <button onClick={saveFolderEdit} style={{ ...smallBtn(BLUE), padding: '9px 14px' }}>Save</button>
            <button onClick={() => setEditing(null)} style={{ ...smallBtn('#f3f4f6', '#374151'), padding: '9px 14px' }}>Cancel</button>
          </div>
        )}

        {expanded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, padding: '0 16px 16px' }}>
            {f.photos.map((p, i) => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', cursor: 'pointer' }}
                onClick={() => setLb({ key: f.key, i })}>
                <img src={p.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {isAdmin && (
                  <button title="Delete photo" onClick={e => { e.stopPropagation(); deletePhotos([p.id], 'this photo', f.key) }}
                    style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6' }}>
      {header}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: MCORE_DARK, margin: '0 0 4px' }}>{projectName || 'Project'} — photos</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>
          Photos that belong to the project itself, not to a weekly report. Pick a day to see its folder{isAdmin ? ' and to add photos to it' : ''}.
          {!isAdmin && ' Only an admin can add or remove photos.'}
        </p>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: daysWithPhotos.length || isAdmin ? 12 : 0 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Day</label>
              <input type="date" min="2000-01-01" max="2100-12-31" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={() => setSelectedDate(todayLocal())} style={{ ...smallBtn('#f3f4f6', '#374151'), padding: '10px 12px' }}>Today</button>
            {isAdmin && (
              <>
                {dayFoldersAll.length > 0 && (
                  <div style={{ flex: '1 1 260px' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Save into</label>
                    <select value={effTargetKey} onChange={e => setTargetChoice({ date: selectedDate, key: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                      {dayFoldersAll.map(f => <option key={f.key} value={f.key}>📁 {f.name || '(no name)'} — {f.photos.length} photo{f.photos.length === 1 ? '' : 's'}</option>)}
                      <option value="new">＋ A new, separate folder for {selectedDate || 'this day'}…</option>
                    </select>
                  </div>
                )}
                {effTargetKey === 'new' && (
                  <div style={{ flex: '1 1 260px' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>{dayFoldersAll.length ? 'Name of the new folder' : 'Folder name'} <span style={{ color: '#9ca3af' }}>{dayFoldersAll.length ? '' : '(optional)'}</span></label>
                    <input value={folderName} onChange={e => setFolderName(e.target.value)} maxLength={80} placeholder="e.g. Site visit, Drone flight" style={{ ...inputStyle, width: '100%' }} />
                  </div>
                )}
              </>
            )}
          </div>

          {daysWithPhotos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: isAdmin ? 14 : 0 }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Days with photos:</span>
              {daysWithPhotos.map(([d, n]) => (
                <button key={d} onClick={() => setSelectedDate(d)}
                  style={{ border: d === selectedDate ? `1px solid ${BLUE}` : '1px solid #e5e7eb', background: d === selectedDate ? '#eff6ff' : '#f9fafb', color: d === selectedDate ? BLUE : '#374151', fontWeight: d === selectedDate ? 700 : 500, borderRadius: 99, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                  {d} <span style={{ opacity: 0.6 }}>· {n}</span>
                </button>
              ))}
            </div>
          )}

          {isAdmin && (
            <>
              <div
                onClick={() => !uploading && fileInput.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); stageFiles(Array.from(e.dataTransfer.files)) }}
                style={{ border: `2px dashed ${dragOver ? BLUE : '#d1d5db'}`, background: dragOver ? '#eff6ff' : '#f9fafb', borderRadius: 10, padding: '22px 12px', textAlign: 'center', cursor: uploading ? 'default' : 'pointer', color: '#6b7280', fontSize: 14 }}>
                {uploading
                  ? `Uploading ${uploading.done} / ${uploading.total}…`
                  : <>📷 Drop photos here, or tap to choose them<div style={{ fontSize: 12, marginTop: 4 }}>They will be saved in {targetFolder ? <>the existing folder <strong style={{ color: '#374151' }}>{folderLabel(targetFolder)}</strong> ({targetFolder.photos.length} photo{targetFolder.photos.length === 1 ? '' : 's'} so far)</> : <>a new folder <strong style={{ color: '#374151' }}>{folderLabel({ date: selectedDate || '—', name: destination.name })}</strong></>} when you press Save</div></>}
              </div>
              <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; stageFiles(fs) }} />

              {pending.length > 0 && (
                <div style={{ marginTop: 12, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                    Not saved yet — {pending.length} photo{pending.length === 1 ? '' : 's'} waiting for Save
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {pending.map(p => (
                      <div key={p.id} title={p.file.name} style={{ position: 'relative', width: 64, height: 64, borderRadius: 6, overflow: 'hidden', background: '#e5e7eb' }}>
                        {p.preview && <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        {!uploading && <button title="Remove from the list" onClick={() => removePending(p.id)}
                          style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: 1 }}>✕</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                <button onClick={savePending} disabled={!pending.length || !!uploading}
                  style={{ ...smallBtn(pending.length && !uploading ? GREEN : '#d1d5db', pending.length && !uploading ? '#fff' : '#6b7280'), padding: '10px 20px', fontSize: 14, cursor: pending.length && !uploading ? 'pointer' : 'default' }}>
                  {uploading ? `Saving ${uploading.done} / ${uploading.total}…` : pending.length ? `💾 Save ${pending.length} photo${pending.length === 1 ? '' : 's'}` : '💾 Save'}
                </button>
                {pending.length > 0 && !uploading && <button onClick={clearPending} style={{ ...smallBtn('#f3f4f6', '#374151'), padding: '10px 14px', fontSize: 13 }}>Clear list</button>}
                {!pending.length && !uploading && <span style={{ fontSize: 12, color: '#9ca3af' }}>Choose photos first — nothing is saved until you press Save.</span>}
              </div>
            </>
          )}
        </div>

        {notice && (
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 10, padding: '11px 14px', fontSize: 13, marginBottom: 14, border: '1px solid',
            background: notice.kind === 'ok' ? '#ecfdf5' : notice.kind === 'warn' ? '#fffbeb' : '#fef2f2',
            borderColor: notice.kind === 'ok' ? '#a7f3d0' : notice.kind === 'warn' ? '#fde68a' : '#fecaca',
            color: notice.kind === 'ok' ? '#065f46' : notice.kind === 'warn' ? '#92400e' : '#991b1b' }}>
            <span style={{ flex: 1 }}>{notice.text}</span>
            <button onClick={() => setNotice(null)} title="Dismiss" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
          </div>
        )}

        {loadError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{loadError}</div>}

        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5, margin: '0 0 8px' }}>{dateOk ? selectedDate : 'NO DATE SELECTED'}</h2>
        {!dateOk && <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 14 }}>Pick a valid date (year 2000–2100).</div>}
        {dateOk && dayFolders.map(f => renderFolder(f, true))}
        {dateOk && dayFolders.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px dashed #d1d5db', padding: '16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: MCORE_DARK }}>📁 {selectedDate}</span>
            <span style={{ fontSize: 13, color: '#9ca3af', flex: '1 1 200px' }}>Empty — no photos for this day.</span>
            {isAdmin && <button disabled={!!uploading} onClick={() => fileInput.current?.click()} style={smallBtn(BLUE)}>＋ Add photos</button>}
          </div>
        )}

        {otherFolders.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '22px 0 8px' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5, margin: 0 }}>{dayFolders.length || dateOk ? 'OTHER DAYS' : 'ALL FOLDERS'}</h2>
              <span style={{ fontSize: 12 }}>
                <button onClick={() => setOpen(Object.fromEntries(otherFolders.map(f => [f.key, true])))} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', padding: 0 }}>Expand all</button>
                {' · '}
                <button onClick={() => setOpen(Object.fromEntries(otherFolders.map(f => [f.key, false])))} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', padding: 0 }}>Collapse all</button>
              </span>
            </div>
            {otherFolders.map(f => renderFolder(f, false))}
          </>
        )}
      </div>

      {lb && lbFolder && current && (
        <div ref={lbEl}
          onClick={() => { if (dragMoved.current) { dragMoved.current = false; return } closeLightbox() }}
          onTouchStart={e => { touchStartX.current = zoomRef.current.scale > 1.01 ? null : e.touches[0].clientX }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return
            const dx = e.changedTouches[0].clientX - touchStartX.current
            touchStartX.current = null
            if (dx > 50) step(-1); else if (dx < -50) step(1)
          }}
          onMouseMove={e => {
            const d = dragRef.current
            if (!d) return
            const dx = e.clientX - d.sx, dy = e.clientY - d.sy
            if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved.current = true
            setZoomBoth({ scale: zoomRef.current.scale, ...clampPan(zoomRef.current.scale, d.ox + dx, d.oy + dy) })
          }}
          onMouseUp={() => { dragRef.current = null }}
          onMouseLeave={() => { dragRef.current = null }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y' }}>
          <div style={{ position: 'absolute', top: 18, left: 20, color: 'rgba(255,255,255,0.75)', fontSize: 13, maxWidth: '55vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {folderLabel(lbFolder)}</div>
          <button onClick={e => { e.stopPropagation(); downloadBlob(current.url, `${safe(projectName) || 'photo'}_${lbFolder.date}_${String(lbIdx + 1).padStart(2, '0')}.jpg`) }} title="Download"
            style={{ position: 'absolute', top: 18, right: 76, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 40, height: 40, fontSize: 17, cursor: 'pointer' }}>⬇</button>
          <button onClick={e => { e.stopPropagation(); closeLightbox() }}
            style={{ position: 'absolute', top: 18, right: 24, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>×</button>
          {lbPhotos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); step(-1) }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>‹</button>
          )}
          <img src={current.url} alt="" draggable={false} onClick={e => e.stopPropagation()}
            onMouseDown={e => {
              if (zoomRef.current.scale <= 1.01) return
              e.preventDefault()
              dragMoved.current = false
              dragRef.current = { sx: e.clientX, sy: e.clientY, ox: zoomRef.current.x, oy: zoomRef.current.y }
            }}
            onDoubleClick={e => {
              e.stopPropagation()
              if (zoomRef.current.scale > 1.01) setZoomBoth({ scale: 1, x: 0, y: 0 })
              else zoomAt(2.5, e.clientX, e.clientY)
            }}
            style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 6, userSelect: 'none',
              transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
              cursor: zoom.scale > 1.01 ? 'grab' : 'zoom-in', transition: dragRef.current ? 'none' : 'transform 0.08s ease-out' }} />
          {lbPhotos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); step(1) }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>›</button>
          )}
          <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>
            {lbIdx + 1} / {lbPhotos.length}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{zoom.scale > 1.01 ? `${Math.round(zoom.scale * 100)}% · drag to move · double-click to reset` : 'scroll to zoom'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

