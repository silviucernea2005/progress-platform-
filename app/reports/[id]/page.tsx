'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const BLUE = '#185FA5'
const BLUE_DARK = '#0C447C'
const ORANGE = '#D46A28'
const GRAY_CHART = '#2C2C2C'
const HEADER_BG = '#1e3a5f'  // pleasant dark blue instead of black

export default function ReportPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [allReports, setAllReports] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [worksDone, setWorksDone] = useState('')
  const [worksPlanned, setWorksPlanned] = useState('')
  const [redFlags, setRedFlags] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDates, setShowDates] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [editingWeights, setEditingWeights] = useState(false)
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [photosJustSaved, setPhotosJustSaved] = useState(false)
  const [settingsLoadError, setSettingsLoadError] = useState('')
  const [editingPeriod, setEditingPeriod] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [periodError, setPeriodError] = useState('')
  const [activityProgress, setActivityProgress] = useState<Record<number, number>>({})
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showMiniCharts, setShowMiniCharts] = useState(true)
  const [deletePhotoMode, setDeletePhotoMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [rearrangeMode, setRearrangeMode] = useState(false)
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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

  const mainChartRef = useRef<HTMLCanvasElement>(null)
  const tenderChartRef = useRef<HTMLCanvasElement>(null)
  const contractingChartRef = useRef<HTMLCanvasElement>(null)
  const constructionChartRef = useRef<HTMLCanvasElement>(null)
  const chartInstances = useRef<any[]>([])

  useEffect(() => {
    fetch(`/api/reports/${id}`).then(r => r.json()).then(async data => {
      setReport(data)
      setWorksDone(data.works_done || '')
      setWorksPlanned(data.works_planned || '')
      setRedFlags(data.red_flags || '')
      setPeriodStart(data.period_start || '')
      setPeriodEnd(data.period_end || '')
      setActivityProgress(Object.fromEntries((data.activities || []).map((a: any) => [a.activity_id, a.progress])))
      setLoading(false)
      if (searchParams.get('edit') === '1') setEditing(true)
      if (data.project_id) {
        localStorage.setItem('dashboard_selected_project', data.project_id)
        fetch(`/api/reports?project_id=${data.project_id}`)
          .then(r => r.json())
          .then(reports => setAllReports(Array.isArray(reports) ? reports.reverse() : []))

        // Dates & weights now live on the server (visible from any computer).
        // If this browser has older data saved locally and the server has none yet,
        // push it up automatically so nothing gets lost in the switch.
        const legacyDates = localStorage.getItem(`project_dates_${data.project_id}`)
        const legacyWeights = localStorage.getItem(`project_weights_${data.project_id}`)
        try {
          const settingsFetch = await fetch(`/api/projects/${data.project_id}/settings`)
          if (!settingsFetch.ok) {
            const err = await settingsFetch.json().catch(() => ({}))
            console.error('Failed to load project settings:', err)
            setSettingsLoadError(`Nu s-au putut încărca datele de proiect de pe server (${err.error || settingsFetch.status}). Datele afișate pot fi incomplete.`)
          }
          const settingsRes = await settingsFetch.json()
          let d = settingsRes?.dates || {}
          let w = settingsRes?.weights || {}
          const isEmpty = (o: any) => !o || Object.keys(o).length === 0

          if (isEmpty(d) && legacyDates) {
            d = JSON.parse(legacyDates)
            fetch(`/api/projects/${data.project_id}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dates: d }) }).catch(() => {})
          }
          if (isEmpty(w) && legacyWeights) {
            w = JSON.parse(legacyWeights)
            fetch(`/api/projects/${data.project_id}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weights: w }) }).catch(() => {})
          }

          setTenderStart(d.tenderStart || ''); setTenderOffersReceived(d.tenderOffersReceived || '')
          setTenderOffersReview(d.tenderOffersReview || ''); setTenderFinish(d.tenderFinish || '')
          setContractingStart(d.contractingStart || ''); setContractingReviewLegal(d.contractingReviewLegal || '')
          setContractingFinish(d.contractingFinish || ''); setConstructionProceedNotice(d.constructionProceedNotice || '')
          setConstructionStart(d.constructionStart || ''); setConstructionFinishEstimated(d.constructionFinishEstimated || '')
          setContractStart(d.contractStart || ''); setContractFinish(d.contractFinish || '')
          setWeights(w)
        } catch (e) {
          console.error('Error loading project settings:', e)
          setSettingsLoadError('Eroare neașteptată la încărcarea datelor de proiect de pe server.')
        }

        // Photos now live on the server too. Migrate any left over from this browser's
        // localStorage (from before the switch) the first time this report is opened.
        try {
          const serverPhotos = await fetch(`/api/reports/${id}/photos`).then(r => r.json())
          if (Array.isArray(serverPhotos) && serverPhotos.length) {
            setPhotos(serverPhotos.map((p: any) => ({ id: p.id, url: p.url })))
          } else {
            const legacyPhotos = localStorage.getItem(`report_photos_${id}`)
            if (legacyPhotos) {
              const parsed = JSON.parse(legacyPhotos)
              if (Array.isArray(parsed) && parsed.length) {
                const uploaded = await fetch(`/api/reports/${id}/photos`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos: parsed })
                }).then(r => r.json())
                if (Array.isArray(uploaded)) {
                  setPhotos(uploaded.map((p: any) => ({ id: p.id, url: p.url })))
                  localStorage.removeItem(`report_photos_${id}`)
                }
              }
            }
          }
        } catch {}
      }
    })
  }, [id])

  async function saveDates() {
    if (!report?.project_id) return
    const dates = {
      tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish,
      contractingStart, contractingReviewLegal, contractingFinish,
      constructionProceedNotice, constructionStart, constructionFinishEstimated,
      contractStart, contractFinish
    }
    try {
      const res = await fetch(`/api/projects/${report.project_id}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dates }) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Nu s-au putut salva datele pe server: ${err.error || res.status}. Datele NU sunt vizibile pe alte computere până nu se rezolvă.`)
        return
      }
    } catch {
      alert('Eroare de rețea la salvarea datelor. Verifică conexiunea și încearcă din nou.')
      return
    }
    setShowDates(false)
  }

  function getWeight(activityId: number, defaultWeight: number) {
    return weights[activityId] !== undefined ? weights[activityId] : defaultWeight
  }

  function toggleFullEdit() {
    const turningOn = !editing
    if (turningOn) {
      setPeriodStart(report.period_start || '')
      setPeriodEnd(report.period_end || '')
      setActivityProgress(Object.fromEntries(acts.map((a: any) => [a.activity_id, a.progress])))
      setPeriodError('')
    }
    setEditing(turningOn)
    setEditingWeights(turningOn)
    setEditingPeriod(turningOn)
  }

  async function saveAllEdits() {
    setPeriodError('')
    if (periodStart && periodEnd && periodStart > periodEnd) {
      setPeriodError('Data de start nu poate fi după data de final.')
      return
    }
    setSaving(true)
    setSavingPeriod(true)
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: periodStart, period_end: periodEnd,
          works_done: worksDone, works_planned: worksPlanned, red_flags: redFlags,
          activities: acts.map((a: any) => ({ activity_id: a.activity_id, progress: activityProgress[a.activity_id] ?? a.progress }))
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setPeriodError(`Nu s-a putut salva: ${err.error || res.status}`)
        setSaving(false); setSavingPeriod(false)
        return
      }
      if (report?.project_id) {
        await fetch(`/api/projects/${report.project_id}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weights }) }).catch(() => {})
      }
      setReport((r: any) => ({
        ...r, period_start: periodStart, period_end: periodEnd,
        works_done: worksDone, works_planned: worksPlanned, red_flags: redFlags,
        activities: (r.activities || []).map((a: any) => ({ ...a, progress: activityProgress[a.activity_id] ?? a.progress }))
      }))
      setEditing(false); setEditingWeights(false); setEditingPeriod(false)
    } catch {
      setPeriodError('Eroare de rețea. Verifică conexiunea și încearcă din nou.')
    }
    setSaving(false)
    setSavingPeriod(false)
  }

  async function deleteReport() {
    if (!confirm('Delete this report? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  function daysBetween(a: string, b: string) {
    if (!a || !b) return 0
    return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
  }

  const today = new Date().toISOString().split('T')[0]

  function computeProgress(rep: any) {
    const acts = rep.activities || []
    return parseFloat(acts.reduce((s: number, a: any) => {
      const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
      return s + a.progress * w / 100
    }, 0).toFixed(2))
  }

  const tenderTotal = daysBetween(tenderStart, tenderFinish)
  const contractingTotal = daysBetween(contractingStart, contractingFinish)
  const constructionTotal = daysBetween(constructionStart, constructionFinishEstimated)

  // Estimated at contract finish & trend finish date
  let estimatedAtContractFinish: number | null = null
  let trendFinishDate: string | null = null

  // Only use reports up through the one currently being viewed — an older report
  // shouldn't show progress from weeks that come after it.
  const currentReportIdx = allReports.findIndex(r => r.id === id)
  const visibleReports = currentReportIdx >= 0 ? allReports.slice(0, currentReportIdx + 1) : allReports

  const cumulatedData = visibleReports.map(r => computeProgress(r))

  if (cumulatedData.length >= 2) {
    const lastProgress = cumulatedData[cumulatedData.length - 1]
    const prevProgress = cumulatedData[cumulatedData.length - 2]
    const weeklyGain = lastProgress - prevProgress
    const lastDate = visibleReports[visibleReports.length - 1]?.period_end

    if (weeklyGain > 0 && lastDate) {
      const weeksTo100 = (100 - lastProgress) / weeklyGain
      const finishMs = new Date(lastDate).getTime() + weeksTo100 * 7 * 86400000
      trendFinishDate = new Date(finishMs).toISOString().split('T')[0]
    }

    if (contractFinish) {
      const weeksToFinish = daysBetween(lastDate, contractFinish) / 7
      const weeklyGainSafe = Math.max(weeklyGain, 0)
      estimatedAtContractFinish = Math.min(100, cumulatedData[cumulatedData.length - 1] + weeklyGainSafe * weeksToFinish)
    }
  }

  function getTrendColor() {
    if (estimatedAtContractFinish === null) return '#aaaaaa'
    if (estimatedAtContractFinish >= 99) return '#86efac'
    if (estimatedAtContractFinish < 90) return '#fca5a5'
    return '#aaaaaa'
  }

  // Extract embedded images from Office Open XML files (xlsx/docx are ZIP archives —
  // images live in xl/media/ for Excel and word/media/ for Word)
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

  // Resize/compress images before storing — avoids blowing past the browser's localStorage
  // quota (~5-10MB) when someone drops several full-resolution site photos at once.
  function compressImage(dataUrl: string, maxWidth = 1400, quality = 0.72): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width))
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(dataUrl); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }

  // Photo drag & drop — supports images, PDF, Excel, Word (extract embedded images/pages automatically)
  useEffect(() => {
    if (lightboxIndex === null) return
    const imagePhotos = photos.filter(p => p.url && !p.url.startsWith('data:text/plain'))
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowRight') setLightboxIndex(i => i === null ? null : (i + 1) % imagePhotos.length)
      if (e.key === 'ArrowLeft') setLightboxIndex(i => i === null ? null : (i - 1 + imagePhotos.length) % imagePhotos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, photos])

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
          // Render first pages of PDF using PDF.js
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
        }
        // Excel/Word (xlsx/docx): extract embedded images automatically
        else if (file.name.match(/\.(xlsx|docx)$/i)) {
          try {
            const images = await extractOfficeImages(file)
            if (images.length) {
              for (const img of images) newPhotos.push(await compressImage(img))
            } else {
              const ext = file.name.split('.').pop()?.toLowerCase()
              const icon = ext === 'xlsx' ? '📊' : '📄'
              newPhotos.push(`data:text/plain,${icon} ${file.name} (no images found inside)`)
            }
          } catch {
            const ext = file.name.split('.').pop()?.toLowerCase()
            const icon = ext === 'xlsx' ? '📊' : '📄'
            newPhotos.push(`data:text/plain,${icon} ${file.name}`)
          }
        }
        // Old binary .xls / .doc — not a ZIP, images can't be extracted this way
        else if (file.name.match(/\.(xls|doc)$/i)) {
          const ext = file.name.split('.').pop()?.toLowerCase()
          const icon = ext?.includes('xl') ? '📊' : '📄'
          newPhotos.push(`data:text/plain,${icon} ${file.name} (old format — save as .xlsx/.docx to extract images)`)
        }
      }
    } catch {
      // Continue to save whatever succeeded rather than losing everything
    }
    try {
      if (newPhotos.length) {
        const uploaded = await fetch(`/api/reports/${id}/photos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos: newPhotos })
        }).then(r => r.json())
        if (Array.isArray(uploaded)) {
          setPhotos(prev => [...prev, ...uploaded.map((p: any) => ({ id: p.id, url: p.url }))])
        } else {
          alert('A apărut o eroare la salvarea pozelor pe server. Încearcă din nou.')
        }
      }
    } catch {
      alert('A apărut o eroare de rețea la salvarea pozelor. Verifică conexiunea și încearcă din nou.')
    }
    setUploadingPhoto(false)
    setPhotosJustSaved(false)
  }

  // Photos are saved to the server as soon as they're uploaded — this just re-confirms/re-syncs
  function savePhotosNow() {
    fetch(`/api/reports/${id}/photos`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setPhotos(data.map((p: any) => ({ id: p.id, url: p.url })))
      setPhotosJustSaved(true)
      setTimeout(() => setPhotosJustSaved(false), 2500)
    }).catch(() => alert('Nu am putut sincroniza cu serverul. Verifică conexiunea.'))
  }

  function deleteAllPhotos() {
    if (!confirm(`Delete all ${photos.length} photo(s)/attachment(s) from this report? This cannot be undone.`)) return
    fetch(`/api/reports/${id}/photos`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .catch(() => {})
    setPhotos([])
    setPhotosJustSaved(false)
  }

  function removePhoto(photoId: string) {
    fetch(`/api/reports/${id}/photos`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId }) })
      .catch(() => {})
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setPhotosJustSaved(false)
  }

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  function deleteSelectedPhotos() {
    if (!selectedPhotoIds.size) return
    if (!confirm(`Delete ${selectedPhotoIds.size} selected photo(s)? This cannot be undone.`)) return
    selectedPhotoIds.forEach(photoId => {
      fetch(`/api/reports/${id}/photos`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId }) }).catch(() => {})
    })
    setPhotos(prev => prev.filter(p => !selectedPhotoIds.has(p.id)))
    setSelectedPhotoIds(new Set())
    setDeletePhotoMode(false)
    setPhotosJustSaved(false)
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotos(prev => {
      const next = [...prev]
      const j = index + direction
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  async function savePhotoOrder() {
    try {
      await fetch(`/api/reports/${id}/photos`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: photos.map(p => p.id) })
      })
    } catch {}
    setRearrangeMode(false)
  }

  // New report with preserved progress
  function handleNewReport() {
    if (!report?.project_id) return
    const acts = (report.activities || []).map((a: any) => ({
      activity_id: a.activity_id,
      progress: a.progress,
      name: a.activity?.name,
      weight: getWeight(a.activity_id, a.activity?.default_weight || 0)
    }))
    localStorage.setItem(`prefill_report_${report.project_id}`, JSON.stringify({ activities: acts, project_id: report.project_id, project_name: report.project?.name }))
    router.push(`/reports/new?project=${report.project_id}&prefill=1`)
  }

  useEffect(() => {
    if (!allReports.length) return
    const loadChart = () => {
      const Chart = (window as any).Chart
      if (!Chart) return
      chartInstances.current.forEach(c => c?.destroy())
      chartInstances.current = []

      const labels = visibleReports.map(r => r.period_end)
      const cumData = visibleReports.map(r => computeProgress(r))
      const actualData = cumData.map((v, i) => i === 0 ? v : parseFloat((v - cumData[i-1]).toFixed(2)))

      const allLabels = [...labels]
      const trendFull: (number|null)[] = [...Array(cumData.length - 1).fill(null)]
      const trendColor = getTrendColor()

      if (cumData.length >= 2 && constructionFinishEstimated) {
        const lastProgress = cumData[cumData.length - 1]
        const prevProgress = cumData[cumData.length - 2]
        const weeklyGain = Math.max(lastProgress - prevProgress, 0)
        trendFull.push(lastProgress)
        let current = new Date(labels[labels.length - 1])
        let currentProg = lastProgress
        const finishDate = new Date(constructionFinishEstimated)
        while (current < finishDate && currentProg < 100) {
          current = new Date(current.getTime() + 7 * 86400000)
          currentProg = Math.min(100, currentProg + weeklyGain)
          allLabels.push(current.toISOString().split('T')[0])
          trendFull.push(parseFloat(currentProg.toFixed(2)))
        }
      } else {
        trendFull.push(cumData[cumData.length - 1] ?? null)
      }

      const cumulatedFull = [...cumData, ...Array(allLabels.length - labels.length).fill(null)]
      const actualFull = [...actualData, ...Array(allLabels.length - labels.length).fill(null)]

      // Trend finish annotation line index
      const trendFinishIdx = trendFinishDate ? allLabels.indexOf(trendFinishDate) : -1

      if (mainChartRef.current) {
        chartInstances.current.push(new Chart(mainChartRef.current, {
          type: 'line',
          data: {
            labels: allLabels,
            datasets: [
              { label: 'Cumulated Progress', data: cumulatedFull, borderColor: ORANGE, backgroundColor: 'rgba(212,106,40,0.12)', borderWidth: 2.5, pointBackgroundColor: ORANGE, pointRadius: 4, tension: 0.35, fill: true, yAxisID: 'y' },
              { label: 'Actual Progress', data: actualFull, borderColor: BLUE, backgroundColor: 'rgba(24,95,165,0.05)', borderWidth: 1.5, pointBackgroundColor: BLUE, pointRadius: 3, tension: 0.35, fill: false, yAxisID: 'y' },
              { label: 'Trend', data: trendFull, borderColor: trendColor, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.35, fill: false, yAxisID: 'y' }
            ]
          },
          options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true, position: 'top', labels: { color: '#e5e7eb', font: { size: 11 }, boxWidth: 18 } },
              tooltip: { callbacks: { label: (ctx: any) => ctx.parsed.y !== null ? ` ${ctx.dataset.label}: ${ctx.parsed.y}%` : '' } },
              annotation: trendFinishIdx >= 0 ? {
                annotations: {
                  trendLine: {
                    type: 'line',
                    xMin: trendFinishIdx,
                    xMax: trendFinishIdx,
                    borderColor: 'rgba(200,200,200,0.5)',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    label: {
                      display: true,
                      content: `Finish: ${trendFinishDate}`,
                      position: 'start',
                      color: '#ccc',
                      font: { size: 10 }
                    }
                  }
                }
              } : {}
            },
            scales: {
              y: { min: 0, max: 100, position: 'left', ticks: { callback: (v: any) => v + '%', color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.06)' } },
              y2: { min: 0, max: 100, position: 'right', ticks: { callback: (v: any) => v + '%', color: '#9ca3af' }, grid: { display: false } },
              x: { ticks: { maxRotation: 30, font: { size: 10 }, color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
          }
        }))
      }

      // Mini bar charts with data labels
      function miniBar(ref: any, barLabels: string[], values: number[], title: string) {
        if (!ref.current) return
        chartInstances.current.push(new Chart(ref.current, {
          type: 'bar',
          data: {
            labels: barLabels,
            datasets: [{
              data: values,
              backgroundColor: [BLUE_DARK, BLUE, BLUE, BLUE],
              borderRadius: 4,
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: title, font: { size: 12, weight: 'bold' }, color: MCORE_DARK },
              datalabels: {
                display: true,
                anchor: 'end',
                align: 'top',
                color: '#374151',
                font: { size: 10, weight: 'bold' },
                formatter: (v: number) => v > 0 ? `${v}d` : ''
              }
            },
            scales: {
              y: { beginAtZero: true, ticks: { font: { size: 9 } } },
              x: { ticks: { font: { size: 9 }, maxRotation: 20 } }
            }
          }
        }))
      }

      miniBar(tenderChartRef, ['Start', 'Offers Rec.', 'Offers Rev.', 'Finish'],
        [0, daysBetween(tenderStart, tenderOffersReceived), daysBetween(tenderOffersReceived, tenderOffersReview), daysBetween(tenderOffersReview, tenderFinish)],
        'Tender Days')
      miniBar(contractingChartRef, ['Start', 'Review Legal', 'Finish'],
        [0, daysBetween(contractingStart, contractingReviewLegal), daysBetween(contractingReviewLegal, contractingFinish)],
        'Contracting Days')
      miniBar(constructionChartRef, ['Proceed Notice', 'Start', 'Finish Est.'],
        [daysBetween(constructionProceedNotice, constructionStart), daysBetween(constructionStart, today), constructionTotal],
        'Construction Days')
    }

    // Load Chart.js + datalabels plugin
    const loadChartJS = () => {
      if ((window as any).Chart) { loadChart(); return }
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
      s.onload = () => {
        const dl = document.createElement('script')
        dl.src = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js'
        dl.onload = () => {
          const Chart = (window as any).Chart
          Chart.register((window as any).ChartDataLabels)
          // Load PDF.js for PDF photo extraction
          const pdfScript = document.createElement('script')
          pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          pdfScript.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          }
          document.head.appendChild(pdfScript)
          loadChart()
        }
        document.head.appendChild(dl)
      }
      document.head.appendChild(s)
    }
    loadChartJS()
  }, [id, allReports, constructionFinishEstimated, contractFinish, weights, tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish, contractingStart, contractingReviewLegal, contractingFinish, constructionProceedNotice, constructionStart])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>
  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box' as any }
  const lbl = { display: 'block' as any, fontSize: 11, color: '#6b7280', marginBottom: 3 }
  const btn = (bg: string, color = '#fff') => ({ background: bg, color, border: 'none', borderRadius: 6, padding: '6px 13px', fontSize: 12, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 } as any)

  // Client-side Excel export — Summary / Activities / Notes sheets
  async function exportExcel() {
    const XLSX = await import('xlsx')

    const summaryRows = [
      ['Project', report.project?.name || ''],
      ['Period', `${report.period_start} – ${report.period_end}`],
      ['Weighted Progress', `${totalProgress.toFixed(2)}%`],
      ['Weekly Progress', `${weeklyProgress}%`],
      ...(contractFinish ? [['Contract Finish', contractFinish], ['Days Remaining', String(daysBetween(today, contractFinish))]] : []),
      ...(estimatedAtContractFinish !== null ? [['Estimated at Contract Finish', `${estimatedAtContractFinish.toFixed(1)}%`]] : []),
      ...(trendFinishDate ? [['Trend Finish Date', trendFinishDate]] : []),
    ]

    const activityRows = [
      ['Activity', 'Weight (%)', 'Progress (%)', 'Contribution (%)', 'Status'],
      ...acts.map((a: any) => {
        const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
        const contribution = (a.progress * w / 100).toFixed(2)
        const status = a.progress === 0 ? 'Not started' : a.progress < 100 ? 'In progress' : 'Completed'
        return [a.activity?.name || '', w, a.progress, Number(contribution), status]
      }),
      ['TOTAL', 100, '', Number(totalProgress.toFixed(2)), '']
    ]

    const notesRows = [
      ['Works Completed', worksDone || '—'],
      ['Works Planned', worksPlanned || '—'],
      ['Red Flags', redFlags || '—'],
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(activityRows), 'Activities')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notesRows), 'Notes')

    XLSX.writeFile(wb, `Raport_${report.project?.name}_${report.period_start}.xlsx`)
  }

  // Client-side PDF export — opens in a NEW tab so the current report/dashboard is never lost,
  // and includes the charts + photos which only exist in this browser (not on the server).
  function exportPdfClientSide() {
    const win = window.open('', '_blank')
    if (!win) { alert('Please allow pop-ups for this site to export the PDF.'); return }

    const mainChartImg = mainChartRef.current ? mainChartRef.current.toDataURL('image/png', 1.0) : ''
    const tenderChartImg = tenderChartRef.current ? tenderChartRef.current.toDataURL('image/png', 1.0) : ''
    const contractingChartImg = contractingChartRef.current ? contractingChartRef.current.toDataURL('image/png', 1.0) : ''
    const constructionChartImg = constructionChartRef.current ? constructionChartRef.current.toDataURL('image/png', 1.0) : ''

    const photoImgs = photos.filter(p => p.url && !p.url.startsWith('data:text/plain')).map(p => p.url)
    const chartIncluded = allReports.length >= 1 && !!mainChartImg
    const scoreColor = chartIncluded ? '#059669' : ORANGE

    const actRows = acts.map((a: any) => {
      const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
      const contribution = (a.progress * w / 100).toFixed(2)
      return `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 12px;font-size:13px">${a.activity?.name}</td>
          <td style="padding:8px 12px;text-align:center;font-size:13px">${w}%</td>
          <td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:600">${a.progress}%</td>
          <td style="padding:8px 12px;text-align:center;font-size:13px;color:#185FA5">${contribution}%</td>
          <td style="padding:8px 12px;text-align:center">
            <div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden">
              <div style="height:100%;background:${a.progress===100?'#1A1A2A':'#D46A28'};width:${a.progress}%;border-radius:4px"></div>
            </div>
          </td>
          <td style="padding:8px 12px;text-align:center;font-size:11px;border-radius:99px;background:${a.progress===0?'#f5f5f5':a.progress<100?'#fef3c7':'#ecfdf5'};color:${a.progress===0?'#9ca3af':a.progress<100?'#92400e':'#065f46'}">${a.progress===0?'Not started':a.progress<100?'In progress':'Completed'}</td>
        </tr>`
    }).join('')

    const mainChartHtml = mainChartImg ? `
    <div class="section">
      <h2>Works Progress · ${report.project?.name}</h2>
      <div style="background:${GRAY_CHART};border-radius:12px;padding:16px">
        <img src="${mainChartImg}" style="width:100%;display:block" />
      </div>
    </div>` : ''

    const miniCharts = [
      ['Tender', tenderChartImg, tenderTotal],
      ['Contracting', contractingChartImg, contractingTotal],
      ['Construction', constructionChartImg, constructionTotal],
    ]
    const miniChartsHtml = showMiniCharts && miniCharts.some(m => m[1]) ? `
    <div class="section">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
        ${miniCharts.map(([label, img, total]) => `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;text-align:center">
            ${img ? `<img src="${img}" style="width:100%;display:block" />` : ''}
            ${Number(total) > 0 ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">${label} total: ${total} days</div>` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''

    const photosHtml = photoImgs.length ? `
    <div class="section">
      <h2>Site Photos</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${photoImgs.map(src => `<img src="${src}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;display:block" />`).join('')}
      </div>
    </div>` : ''

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Progress Report - ${report.project?.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1A1A2A; background: #fff; }
  .header { background: #1A1A2A; color: white; padding: 24px 32px; display:flex; justify-content:space-between; align-items:center; }
  .logo { font-size: 22px; font-weight: 900; background: #185FA5; padding: 6px 14px; border-radius: 8px; }
  .logo-sub { font-size: 10px; color: rgba(255,255,255,0.5); letter-spacing: 2px; margin-top: 2px; }
  .score-box { background: #2C2C3E; border-radius: 12px; padding: 20px 28px; margin: 24px; display:flex; justify-content:space-between; align-items:center; color:white; }
  .score-title { font-size: 30px; font-weight: 800; letter-spacing: -0.5px; }
  .score-num { font-size: 48px; font-weight: 800; color: ${scoreColor}; }
  .progress-bar { height: 8px; background: rgba(255,255,255,0.15); border-radius: 99px; margin-top: 12px; overflow:hidden; }
  .progress-fill { height: 100%; background: #D46A28; border-radius: 99px; }
  .section { margin: 0 24px 20px; }
  .section h2 { font-size: 14px; font-weight: 700; color: #1A1A2A; border-bottom: 2px solid #185FA5; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1A1A2A; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
  .text-box { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .text-card { background: #f9fafb; border-radius: 8px; padding: 14px; }
  .text-card h3 { font-size: 12px; font-weight: 700; margin-bottom: 8px; }
  .text-card p { font-size: 12px; color: #374151; line-height: 1.6; white-space: pre-wrap; }
  .footer { background: #f5f5f3; padding: 12px 32px; font-size: 10px; color: #9ca3af; margin-top: 24px; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div style="display:flex;align-items:center;gap:12px">
      <div class="logo">S7</div>
      <div>
        <div style="font-weight:700;font-size:14px">Square 7</div>
        <div class="logo-sub">PART OF M.CORE</div>
      </div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:13px;opacity:0.7">Progress Report</div>
    <div style="font-size:11px;opacity:0.5">${report.period_start} – ${report.period_end}</div>
  </div>
</div>

<div class="score-box">
  <div>
    <div class="score-title">${report.project?.name}</div>
    <div style="font-size:12px;opacity:0.6;margin-top:4px">${report.project?.location || ''} · ${report.project?.client || ''}</div>
    <div style="font-size:12px;opacity:0.5;margin-top:2px">Period: ${report.period_start} – ${report.period_end}</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(totalProgress,100)}%"></div></div>
  </div>
  <div style="text-align:right">
    <div class="score-num">${totalProgress.toFixed(2)}%</div>
    <div style="font-size:11px;opacity:0.5">weighted progress</div>
  </div>
</div>

<div class="section">
  <h2>Activities Progress</h2>
  <table>
    <thead>
      <tr>
        <th>Activity</th>
        <th style="text-align:center">Weight</th>
        <th style="text-align:center">Progress</th>
        <th style="text-align:center">Contribution</th>
        <th>Progress Bar</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${actRows}</tbody>
    <tr style="background:#1A1A2A;color:white">
      <td style="padding:10px 12px;font-weight:700">TOTAL WEIGHTED PROGRESS</td>
      <td style="padding:10px 12px;text-align:center">100%</td>
      <td style="padding:10px 12px;text-align:center">—</td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:#D46A28">${totalProgress.toFixed(2)}%</td>
      <td colspan="2"></td>
    </tr>
  </table>
</div>

${mainChartHtml}
${miniChartsHtml}

<div class="section">
  <h2>Works & Notes</h2>
  <div class="text-box">
    <div class="text-card">
      <h3 style="color:#065f46">✓ Works Completed</h3>
      <p>${worksDone || '—'}</p>
    </div>
    <div class="text-card">
      <h3 style="color:#0C447C">→ Works Planned</h3>
      <p>${worksPlanned || '—'}</p>
    </div>
    <div class="text-card">
      <h3 style="color:#7f1d1d">🚩 Red Flags</h3>
      <p>${redFlags || '—'}</p>
    </div>
  </div>
</div>

${photosHtml}

<div class="footer">
  Square 7 · Part of M.Core · Progress Platform · Generated ${new Date().toLocaleDateString('en-GB')}
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

    win.document.write(html)
    win.document.close()
  }

  if (!report || report.error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Report not found</div>

  const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order || 0) - (b.activity?.sort_order || 0))
  const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * getWeight(a.activity_id, a.activity?.default_weight || 0) / 100, 0)
  const trendColor = getTrendColor()

  // Weekly progress (difference from previous report)
  const currentIdx = allReports.findIndex(r => r.id === id)
  const currentCumulated = currentIdx >= 0 ? cumulatedData[currentIdx] : totalProgress
  const prevCumulated = currentIdx > 0 ? cumulatedData[currentIdx - 1] : 0
  const weeklyProgress = parseFloat((currentCumulated - prevCumulated).toFixed(2))

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>

      {/* STICKY HEADER */}
      <header className="s7-header-row" style={{ position: 'sticky', top: 0, zIndex: 100, background: MCORE_DARK, color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ background: BLUE, borderRadius: 7, padding: '3px 9px', fontWeight: 900, fontSize: 15, letterSpacing: 1 }}>S7</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>Square 7</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>PART OF M.CORE</div>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 8px' }} />
          <span style={{ fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Progress Platform</span>
        </div>
        <div className="s7-header-actions" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowDates(!showDates)} style={btn('rgba(255,255,255,0.1)')}>📅 {showDates ? 'Hide dates' : 'Visualize Dates'}</button>
          <button onClick={() => setShowMiniCharts(!showMiniCharts)} style={btn('rgba(255,255,255,0.1)')}>{showMiniCharts ? '🙈 Hide mini charts' : '👁️ Show mini charts'}</button>
          <button onClick={toggleFullEdit} style={btn(editing ? ORANGE : 'rgba(255,255,255,0.1)')}>✏️ {editing ? 'Editing…' : 'Edit Report'}</button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} style={btn(BLUE)}>📦 Export ▾</button>
            {showExportMenu && (
              <div onMouseLeave={() => setShowExportMenu(false)}
                style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', overflow: 'hidden', zIndex: 200, minWidth: 140 }}>
                <a href={`/api/reports/${id}/export-word`} onClick={() => setShowExportMenu(false)}
                  style={{ display: 'block', padding: '10px 14px', fontSize: 13, color: MCORE_DARK, textDecoration: 'none' }}>📄 Word</a>
                <button onClick={() => { setShowExportMenu(false); exportPdfClientSide() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: MCORE_DARK, background: 'none', border: 'none', cursor: 'pointer' }}>📑 PDF</button>
                <button onClick={() => { setShowExportMenu(false); exportExcel() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: MCORE_DARK, background: 'none', border: 'none', cursor: 'pointer' }}>📊 Excel</button>
              </div>
            )}
          </div>
          <button onClick={handleNewReport} style={btn(ORANGE)}>+ New Report</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>← Dashboard</button>
        </div>
      </header>

      <main className="s7-main-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>

        {settingsLoadError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 12, marginBottom: 16 }}>
            ⚠️ {settingsLoadError}
          </div>
        )}

        {/* EDIT REPORT PERIOD */}
        {editingPeriod && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: MCORE_DARK }}>Report Period</h2>
            <div className="s7-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 420 }}>
              <div>
                <label style={lbl}>Period start</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Period end</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inp} />
              </div>
            </div>
            {periodError && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 10 }}>{periodError}</div>}
          </div>
        )}

        {/* PROJECT DATES — collapsible */}
        {showDates && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: MCORE_DARK }}>Project Dates</h2>
              <button onClick={saveDates} style={btn(BLUE)}>Save & Hide</button>
            </div>
            <div className="s7-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { title: 'TENDER', fields: [['Start', tenderStart, setTenderStart], ['Offers Received', tenderOffersReceived, setTenderOffersReceived], ['Offers Review', tenderOffersReview, setTenderOffersReview], ['Finish', tenderFinish, setTenderFinish]] },
                { title: 'CONTRACTING', fields: [['Start', contractingStart, setContractingStart], ['Review Legal', contractingReviewLegal, setContractingReviewLegal], ['Finish', contractingFinish, setContractingFinish]] },
                { title: 'CONSTRUCTION', fields: [['Proceed Notice', constructionProceedNotice, setConstructionProceedNotice], ['Start', constructionStart, setConstructionStart], ['Finish Estimated', constructionFinishEstimated, setConstructionFinishEstimated]] },
                { title: 'CONTRACT', fields: [['Contract Start', contractStart, setContractStart], ['Contract Finish', contractFinish, setContractFinish]] },
              ].map(section => (
                <div key={section.title} style={{ background: '#f9fafb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: BLUE_DARK, marginBottom: 10, letterSpacing: 0.5 }}>{section.title}</div>
                  {section.fields.map(([label, value, setter]: any) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <label style={lbl}>{label}</label>
                      <input type="date" value={value} onChange={e => setter(e.target.value)} style={inp} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WEIGHTS EDITOR */}
        {editingWeights && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: MCORE_DARK }}>Activity Weights</h2>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: acts.reduce((s: number, a: any) => s + (weights[a.activity_id] ?? a.activity?.default_weight ?? 0), 0) === 100 ? '#ecfdf5' : '#fef2f2', color: acts.reduce((s: number, a: any) => s + (weights[a.activity_id] ?? a.activity?.default_weight ?? 0), 0) === 100 ? '#065f46' : '#dc2626' }}>
                Total: {acts.reduce((s: number, a: any) => s + (weights[a.activity_id] ?? a.activity?.default_weight ?? 0), 0)}%
              </span>
            </div>
            <div className="s7-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {acts.map((a: any) => (
                <div key={a.activity_id} style={{ background: '#f9fafb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: MCORE_DARK, marginBottom: 6 }}>{a.activity?.name}</div>
                  <input type="number" min={0} max={100} value={weights[a.activity_id] ?? a.activity?.default_weight ?? 0}
                    onChange={e => setWeights(prev => ({ ...prev, [a.activity_id]: Number(e.target.value) }))}
                    style={{ ...inp, textAlign: 'center', fontWeight: 600, fontSize: 14 }} />
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: 'center' }}>Default: {a.activity?.default_weight}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REPORT SWITCHER — jump between this project's reports. Live page only, never exported. */}
        {allReports.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#6b7280', marginRight: 8 }}>📋 Report:</label>
            <select value={String(id)} onChange={e => router.push(`/reports/${e.target.value}`)}
              style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: MCORE_DARK, background: '#fff', cursor: 'pointer' }}>
              {[...allReports].sort((a: any, b: any) => (b.period_end || '').localeCompare(a.period_end || '')).map((r: any) => (
                <option key={r.id} value={r.id}>{r.period_start} – {r.period_end}</option>
              ))}
            </select>
          </div>
        )}

        {/* REPORT HEADER — pleasant blue instead of black */}
        <div className="s7-score-box" style={{ background: HEADER_BG, borderRadius: 12, padding: '20px 28px', color: '#fff', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{report.project?.name}</h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4, fontSize: 13 }}>{report.period_start} – {report.period_end}</p>
              {contractFinish && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                Contract finish: {contractFinish} · Days remaining: {daysBetween(today, contractFinish)}
              </p>}
              {estimatedAtContractFinish !== null && (
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Estimated at contract finish:</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: trendColor }}>{estimatedAtContractFinish.toFixed(1)}%</span>
                </div>
              )}
              {trendFinishDate && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  At current pace, project finishes: <strong style={{ color: trendColor }}>{trendFinishDate}</strong>
                </div>
              )}
            </div>
            <div className="s7-score-right" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{totalProgress.toFixed(2)}%</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>weighted progress</div>
              {weeklyProgress > 0 && <div style={{ fontSize: 13, color: ORANGE, fontWeight: 600, marginTop: 4 }}>+{weeklyProgress}% this week</div>}
            </div>
          </div>
          <div style={{ marginTop: 14, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: allReports.length >= 1 ? '#059669' : ORANGE, borderRadius: 99, width: `${Math.min(totalProgress, 100)}%`, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* 3 MINI CHARTS */}
        <div className="s7-grid-3" style={{ display: showMiniCharts ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          {[
            { ref: tenderChartRef, total: tenderTotal, label: 'Tender' },
            { ref: contractingChartRef, total: contractingTotal, label: 'Contracting' },
            { ref: constructionChartRef, total: constructionTotal, label: 'Construction' },
          ].map(item => (
            <div key={item.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
              <canvas ref={item.ref} height={160} />
              {item.total > 0 && <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 4 }}>Total: {item.total} days</div>}
            </div>
          ))}
        </div>

        {/* MAIN CHART — dark bg */}
        {allReports.length >= 1 && (
          <div style={{ background: GRAY_CHART, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#e5e7eb' }}>Works Progress · {report.project?.name}</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {trendFinishDate && (
                  <div style={{ fontSize: 11, color: trendColor, fontWeight: 600, background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 6 }}>
                    📅 Trend finish: {trendFinishDate}
                  </div>
                )}
                {estimatedAtContractFinish !== null && (
                  <div style={{ fontSize: 11, color: trendColor, fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 6 }}>
                    At contract finish: {estimatedAtContractFinish.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
            <canvas ref={mainChartRef} height={175} />
          </div>
        )}

        {/* ACTIVITIES */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: MCORE_DARK }}>Activities Progress</h2>
          {acts.map((a: any) => {
            const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
            const displayProgress = editing ? (activityProgress[a.activity_id] ?? a.progress) : a.progress
            return (
              <div key={a.activity_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap', rowGap: 6 }}>
                <span style={{ flex: '1 1 140px', minWidth: 120, fontSize: 13, color: MCORE_DARK }}>{a.activity?.name}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', width: 28 }}>{w}%</span>
                <div style={{ flex: '2 1 90px', minWidth: 60, height: 7, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${displayProgress}%`, background: displayProgress === 100 ? '#4ade80' : displayProgress > 0 ? '#60a5fa' : '#e5e7eb', transition: 'width 0.3s' }} />
                </div>
                {editing ? (
                  <input type="number" min={0} max={100} value={activityProgress[a.activity_id] ?? a.progress}
                    onChange={e => setActivityProgress(prev => ({ ...prev, [a.activity_id]: Number(e.target.value) }))}
                    style={{ width: 55, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', fontSize: 13, textAlign: 'center', fontWeight: 600 }} />
                ) : (
                  <span style={{ width: 38, textAlign: 'right', fontSize: 13, fontWeight: 600, color: MCORE_DARK }}>{a.progress}%</span>
                )}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, minWidth: 72, textAlign: 'center', background: displayProgress === 0 ? '#f3f4f6' : displayProgress < 100 ? '#dbeafe' : '#dcfce7', color: displayProgress === 0 ? '#6b7280' : displayProgress < 100 ? '#1e40af' : '#166534' }}>
                  {displayProgress === 0 ? 'Not started' : displayProgress < 100 ? 'In progress' : 'Completed'}
                </span>
              </div>
            )
          })}
          {/* Weekly progress summary row */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: MCORE_DARK }}>Weekly Progress (this period)</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: ORANGE }}>+{weeklyProgress}%</span>
          </div>
        </div>

        {/* TEXT SECTIONS */}
        <div className="s7-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          {[
            { label: '✓ Works completed', value: worksDone, setter: setWorksDone, color: '#065f46', key: 'done' },
            { label: '→ Works planned', value: worksPlanned, setter: setWorksPlanned, color: BLUE_DARK, key: 'planned' },
            { label: '🚩 Red Flags', value: redFlags, setter: setRedFlags, color: '#7f1d1d', key: 'flags' },
          ].map(section => (
            <div key={section.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: section.color, marginBottom: 10 }}>{section.label}</h3>
              {editing ? (
                <textarea value={section.value} onChange={e => section.setter(e.target.value)} rows={5}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              ) : (
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-line', minHeight: 50 }}>{section.value || '—'}</div>
              )}
            </div>
          ))}
        </div>

        {/* PHOTOS / ATTACHMENTS */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: MCORE_DARK }}>Site Photos & Attachments</h2>

          {photos.length > 0 && (
            <div className="s7-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
              {photos.map((p, i) => {
                const isSelected = selectedPhotoIds.has(p.id)
                const isImage = !!(p.url && !p.url.startsWith('data:text/plain'))
                const imagePhotos = photos.filter(ph => ph.url && !ph.url.startsWith('data:text/plain'))
                return (
                  <div key={p.id}
                    draggable={rearrangeMode}
                    onDragStart={() => setDraggedPhotoIndex(i)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (!rearrangeMode || draggedPhotoIndex === null || draggedPhotoIndex === i) return
                      setPhotos(prev => {
                        const next = [...prev]
                        const [moved] = next.splice(draggedPhotoIndex, 1)
                        next.splice(i, 0, moved)
                        return next
                      })
                      setDraggedPhotoIndex(i)
                    }}
                    onDragEnd={() => setDraggedPhotoIndex(null)}
                    onClick={() => {
                      if (deletePhotoMode) togglePhotoSelection(p.id)
                      else if (!rearrangeMode && isImage) setLightboxIndex(imagePhotos.findIndex(ph => ph.id === p.id))
                    }}
                    style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: '#f3f4f6', cursor: deletePhotoMode ? 'pointer' : rearrangeMode ? 'grab' : isImage ? 'pointer' : 'default', outline: isSelected ? '3px solid #dc2626' : draggedPhotoIndex === i ? '3px solid #185FA5' : 'none', opacity: rearrangeMode && draggedPhotoIndex === i ? 0.5 : 1 }}>
                    {isImage ? (
                      <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: deletePhotoMode && !isSelected ? 0.55 : 1 }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13, color: '#374151', padding: 8, textAlign: 'center' }}>{p.url?.replace('data:text/plain,', '')}</div>
                    )}
                    {deletePhotoMode && (
                      <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 99, background: isSelected ? '#dc2626' : 'rgba(255,255,255,0.85)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff' }}>
                        {isSelected ? '✓' : ''}
                      </div>
                    )}
                    {rearrangeMode && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 6 }}>
                        <button onClick={(e) => { e.stopPropagation(); movePhoto(i, -1) }} disabled={i === 0}
                          style={{ width: 28, height: 28, borderRadius: 99, background: '#fff', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: 16 }}>‹</button>
                        <button onClick={(e) => { e.stopPropagation(); movePhoto(i, 1) }} disabled={i === photos.length - 1}
                          style={{ width: 28, height: 28, borderRadius: 99, background: '#fff', border: 'none', cursor: i === photos.length - 1 ? 'default' : 'pointer', opacity: i === photos.length - 1 ? 0.4 : 1, fontSize: 16 }}>›</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {editing && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {photosJustSaved && <span style={{ fontSize: 12, color: '#065f46' }}>✓ Saved</span>}
              {deletePhotoMode ? (
                <>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{selectedPhotoIds.size} selectate</span>
                  <button onClick={() => { setDeletePhotoMode(false); setSelectedPhotoIds(new Set()) }} style={btn('#f3f4f6', '#374151')}>Cancel</button>
                  <button onClick={deleteSelectedPhotos} disabled={!selectedPhotoIds.size} style={btn('#dc2626')}>🗑 Delete selected</button>
                </>
              ) : rearrangeMode ? (
                <>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Trage pozele cu mouse-ul (sau ‹ ›) pentru a schimba ordinea</span>
                  <button onClick={savePhotoOrder} style={btn(BLUE)}>✓ Done rearranging</button>
                </>
              ) : (
                photos.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowPhotoMenu(!showPhotoMenu)} style={btn('#fef2f2', '#dc2626')}>🗑 Photo actions ▾</button>
                    {showPhotoMenu && (
                      <div onMouseLeave={() => setShowPhotoMenu(false)}
                        style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', overflow: 'hidden', zIndex: 200, minWidth: 180 }}>
                        <button onClick={() => { setShowPhotoMenu(false); deleteAllPhotos() }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>🗑 Delete all photos</button>
                        <button onClick={() => { setShowPhotoMenu(false); setDeletePhotoMode(true) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: MCORE_DARK, background: 'none', border: 'none', cursor: 'pointer' }}>🗑 Delete photo</button>
                        <button onClick={() => { setShowPhotoMenu(false); setRearrangeMode(true) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, color: MCORE_DARK, background: 'none', border: 'none', cursor: 'pointer' }}>↔️ Rearrange photo</button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {editing && (
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
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={toggleFullEdit} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveAllEdits} disabled={saving || savingPeriod} style={{ ...btn(BLUE), padding: '8px 20px', fontSize: 13 }}>
              {saving || savingPeriod ? 'Saving...' : '💾 Save all changes'}
            </button>
          </div>
        )}

      </main>

      {/* PHOTO LIGHTBOX */}
      {lightboxIndex !== null && (() => {
        const imagePhotos = photos.filter(p => p.url && !p.url.startsWith('data:text/plain'))
        if (!imagePhotos.length) return null
        const idx = ((lightboxIndex % imagePhotos.length) + imagePhotos.length) % imagePhotos.length
        const current = imagePhotos[idx]
        return (
          <div onClick={() => setLightboxIndex(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(null) }}
              style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>×</button>

            {imagePhotos.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); setLightboxIndex((idx - 1 + imagePhotos.length) % imagePhotos.length) }}
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>‹</button>
            )}

            <img src={current.url} onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 6 }} />

            {imagePhotos.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); setLightboxIndex((idx + 1) % imagePhotos.length) }}
                style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 99, width: 44, height: 44, fontSize: 22, cursor: 'pointer' }}>›</button>
            )}

            <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{idx + 1} / {imagePhotos.length}</div>
          </div>
        )
      })()}
    </div>
  )
}
