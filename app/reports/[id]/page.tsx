'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const BLUE = '#185FA5'
const BLUE_DARK = '#0C447C'
const ORANGE = '#D46A28'
const GRAY_CHART = '#2C2C2C'

export default function ReportPage() {
  const { id } = useParams()
  const router = useRouter()
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
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [editingWeights, setEditingWeights] = useState(false)
  const [weights, setWeights] = useState<Record<number, number>>({})
  const dropRef = useRef<HTMLDivElement>(null)

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
    fetch(`/api/reports/${id}`).then(r => r.json()).then(data => {
      setReport(data)
      setWorksDone(data.works_done || '')
      setWorksPlanned(data.works_planned || '')
      setRedFlags(data.red_flags || '')
      setLoading(false)
      if (data.project_id) {
        fetch(`/api/reports?project_id=${data.project_id}`)
          .then(r => r.json())
          .then(reports => setAllReports(Array.isArray(reports) ? reports.reverse() : []))
        const saved = localStorage.getItem(`project_dates_${data.project_id}`)
        if (saved) {
          const d = JSON.parse(saved)
          setTenderStart(d.tenderStart||''); setTenderOffersReceived(d.tenderOffersReceived||'')
          setTenderOffersReview(d.tenderOffersReview||''); setTenderFinish(d.tenderFinish||'')
          setContractingStart(d.contractingStart||''); setContractingReviewLegal(d.contractingReviewLegal||'')
          setContractingFinish(d.contractingFinish||''); setConstructionProceedNotice(d.constructionProceedNotice||'')
          setConstructionStart(d.constructionStart||''); setConstructionFinishEstimated(d.constructionFinishEstimated||'')
          setContractStart(d.contractStart||''); setContractFinish(d.contractFinish||'')
        }
        const savedPhotos = localStorage.getItem(`report_photos_${id}`)
        if (savedPhotos) setPhotos(JSON.parse(savedPhotos))
        const savedWeights = localStorage.getItem(`project_weights_${data.project_id}`)
        if (savedWeights) setWeights(JSON.parse(savedWeights))
      }
    })
  }, [id])

  function saveDates() {
    if (!report?.project_id) return
    localStorage.setItem(`project_dates_${report.project_id}`, JSON.stringify({
      tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish,
      contractingStart, contractingReviewLegal, contractingFinish,
      constructionProceedNotice, constructionStart, constructionFinishEstimated,
      contractStart, contractFinish
    }))
    setShowDates(false)
  }

  function saveWeights() {
    if (!report?.project_id) return
    localStorage.setItem(`project_weights_${report.project_id}`, JSON.stringify(weights))
    setEditingWeights(false)
  }

  function getWeight(activityId: number, defaultWeight: number) {
    return weights[activityId] !== undefined ? weights[activityId] : defaultWeight
  }

  async function saveText() {
    setSaving(true)
    await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ works_done: worksDone, works_planned: worksPlanned, red_flags: redFlags })
    })
    setReport((r: any) => ({ ...r, works_done: worksDone, works_planned: worksPlanned, red_flags: redFlags }))
    setSaving(false)
    setEditing(false)
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

  // Photo drag & drop
  async function handlePhotoDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    setUploadingPhoto(true)
    const newPhotos: string[] = []
    for (const file of files) {
      const reader = new FileReader()
      await new Promise<void>(res => {
        reader.onload = () => {
          newPhotos.push(reader.result as string)
          res()
        }
        reader.readAsDataURL(file)
      })
    }
    const updated = [...photos, ...newPhotos]
    setPhotos(updated)
    localStorage.setItem(`report_photos_${id}`, JSON.stringify(updated))
    setUploadingPhoto(false)
  }

  function removePhoto(idx: number) {
    const updated = photos.filter((_, i) => i !== idx)
    setPhotos(updated)
    localStorage.setItem(`report_photos_${id}`, JSON.stringify(updated))
  }

  const tenderTotal = daysBetween(tenderStart, tenderFinish)
  const contractingTotal = daysBetween(contractingStart, contractingFinish)
  const constructionTotal = daysBetween(constructionStart, constructionFinishEstimated)

  // Compute weighted progress using custom weights
  function computeProgress(rep: any) {
    const acts = rep.activities || []
    return parseFloat(acts.reduce((s: number, a: any) => {
      const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
      return s + a.progress * w / 100
    }, 0).toFixed(2))
  }

  // Trend color
  function getTrendColor() {
    if (!allReports.length || !constructionFinishEstimated || !contractFinish) return '#888780'
    if (estimatedAtContractFinish === null) return '#888780'
    if (estimatedAtContractFinish >= 100) return '#86efac' // light green
    if (estimatedAtContractFinish < 95) return '#fca5a5'  // light red
    return '#888780' // gray = on time
  }

  // Estimated at contract finish
  let estimatedAtContractFinish: number | null = null
  if (allReports.length >= 2 && contractFinish) {
    const cumulatedData = allReports.map(r => computeProgress(r))
    const lastProgress = cumulatedData[cumulatedData.length - 1]
    const prevProgress = cumulatedData[cumulatedData.length - 2]
    const weeklyGain = lastProgress - prevProgress
    const lastDate = allReports[allReports.length - 1].period_end
    const weeksToFinish = daysBetween(lastDate, contractFinish) / 7
    estimatedAtContractFinish = Math.min(100, lastProgress + Math.max(weeklyGain, 0) * weeksToFinish)
  }

  useEffect(() => {
    if (!allReports.length) return
    const loadChart = () => {
      const Chart = (window as any).Chart
      if (!Chart) return
      chartInstances.current.forEach(c => c?.destroy())
      chartInstances.current = []

      const labels = allReports.map(r => r.period_end)
      const cumulatedData = allReports.map(r => computeProgress(r))
      const actualData = cumulatedData.map((v, i) => i === 0 ? v : parseFloat((v - cumulatedData[i-1]).toFixed(2)))

      const allLabels = [...labels]
      const trendFull: (number|null)[] = [...Array(cumulatedData.length - 1).fill(null)]
      const trendColor = getTrendColor()

      if (cumulatedData.length >= 2 && constructionFinishEstimated) {
        const lastProgress = cumulatedData[cumulatedData.length - 1]
        const prevProgress = cumulatedData[cumulatedData.length - 2]
        const weeklyGain = lastProgress - prevProgress
        trendFull.push(lastProgress)
        let current = new Date(labels[labels.length - 1])
        let currentProg = lastProgress
        const finishDate = new Date(constructionFinishEstimated)
        while (current < finishDate) {
          current = new Date(current.getTime() + 7 * 86400000)
          currentProg = Math.min(100, currentProg + Math.max(weeklyGain, 0))
          allLabels.push(current.toISOString().split('T')[0])
          trendFull.push(parseFloat(currentProg.toFixed(2)))
        }
      } else {
        trendFull.push(cumulatedData[cumulatedData.length - 1] ?? null)
      }

      const cumulatedFull = [...cumulatedData, ...Array(allLabels.length - labels.length).fill(null)]
      const actualFull = [...actualData, ...Array(allLabels.length - labels.length).fill(null)]

      if (mainChartRef.current) {
        chartInstances.current.push(new Chart(mainChartRef.current, {
          type: 'line',
          data: {
            labels: allLabels,
            datasets: [
              { label: 'Cumulated Progress', data: cumulatedFull, borderColor: ORANGE, backgroundColor: 'rgba(212,106,40,0.12)', borderWidth: 2.5, pointBackgroundColor: ORANGE, pointRadius: 4, tension: 0.35, fill: true, yAxisID: 'y' },
              { label: 'Actual Progress', data: actualFull, borderColor: BLUE, backgroundColor: 'rgba(24,95,165,0.05)', borderWidth: 1.5, pointBackgroundColor: BLUE, pointRadius: 3, tension: 0.35, fill: false, yAxisID: 'y' },
              { label: 'Trend', data: trendFull, borderColor: trendColor, borderWidth: 2, borderDash: [6,4], pointRadius: 0, tension: 0.35, fill: false, yAxisID: 'y' }
            ]
          },
          options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true, position: 'top', labels: { color: '#e5e7eb', font: { size: 11 }, boxWidth: 18 } },
              tooltip: { callbacks: { label: (ctx: any) => ctx.parsed.y !== null ? ` ${ctx.dataset.label}: ${ctx.parsed.y}%` : '' } }
            },
            scales: {
              y: { min: 0, max: 100, position: 'left', ticks: { callback: (v: any) => v + '%', color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.06)' } },
              y2: { min: 0, max: 100, position: 'right', ticks: { callback: (v: any) => v + '%', color: '#9ca3af' }, grid: { display: false } },
              x: { ticks: { maxRotation: 30, font: { size: 10 }, color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
          }
        }))
      }

      function miniBar(ref: any, labels: string[], values: number[], title: string) {
        if (!ref.current) return
        chartInstances.current.push(new Chart(ref.current, {
          type: 'bar',
          data: { labels, datasets: [{ data: values, backgroundColor: [BLUE_DARK, BLUE, BLUE, BLUE], borderRadius: 4 }] },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: title, font: { size: 12, weight: 'bold' }, color: MCORE_DARK }
            },
            scales: {
              y: { beginAtZero: true, ticks: { font: { size: 9 } } },
              x: { ticks: { font: { size: 9 }, maxRotation: 20 } }
            }
          }
        }))
      }

      miniBar(tenderChartRef, ['Start','Offers Received','Offers Review','Finish'], [0, daysBetween(tenderStart,tenderOffersReceived), daysBetween(tenderOffersReceived,tenderOffersReview), daysBetween(tenderOffersReview,tenderFinish)], 'Tender Days')
      miniBar(contractingChartRef, ['Start','Review Legal','Finish'], [0, daysBetween(contractingStart,contractingReviewLegal), daysBetween(contractingReviewLegal,contractingFinish)], 'Contracting Days')
      miniBar(constructionChartRef, ['Proceed Notice','Start','Finish Est.'], [daysBetween(constructionProceedNotice,constructionStart), daysBetween(constructionStart,today), constructionTotal], 'Construction Days')
    }

    if ((window as any).Chart) loadChart()
    else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
      s.onload = loadChart
      document.head.appendChild(s)
    }
  }, [allReports, constructionFinishEstimated, contractFinish, weights, tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish, contractingStart, contractingReviewLegal, contractingFinish, constructionProceedNotice, constructionStart])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>Loading...</div>
  if (!report || report.error) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>Report not found</div>

  const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order||0) - (b.activity?.sort_order||0))
  const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * getWeight(a.activity_id, a.activity?.default_weight||0) / 100, 0)
  const trendColor = getTrendColor()

  const inp = { border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' as any }
  const lbl = { display:'block' as any, fontSize:11, color:'#6b7280', marginBottom:3 }
  const btn = (bg: string, color='#fff') => ({ background:bg, color, border:'none', borderRadius:6, padding:'6px 13px', fontSize:12, cursor:'pointer', fontWeight:500, display:'inline-flex', alignItems:'center', gap:5 } as any)

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f3', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      {/* HEADER */}
      <header style={{ background: MCORE_DARK, color:'#fff', padding:'10px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Square 7 logo text */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ background: BLUE, borderRadius:8, padding:'4px 10px', fontWeight:900, fontSize:16, letterSpacing:1, color:'#fff' }}>S7</div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, letterSpacing:0.5, color:'#fff' }}>Square 7</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', letterSpacing:1 }}>PART OF M.CORE</div>
            </div>
          </div>
          <div style={{ width:1, height:28, background:'rgba(255,255,255,0.15)', margin:'0 8px' }} />
          <span style={{ fontWeight:500, fontSize:13, color:'rgba(255,255,255,0.8)' }}>Progress Platform</span>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setShowDates(!showDates)} style={btn('rgba(255,255,255,0.1)')}>📅 {showDates ? 'Hide dates' : 'Visualize Dates'}</button>
          <button onClick={() => setEditing(!editing)} style={btn('rgba(255,255,255,0.1)')}>✏️ Edit text</button>
          <button onClick={() => setEditingWeights(!editingWeights)} style={btn('rgba(255,255,255,0.1)')}>⚖️ Weights</button>
          <a href={`/api/reports/${id}/export-word`} style={{ ...btn('rgba(255,255,255,0.1)'), textDecoration:'none' }}>📄 Word</a>
          <a href={`/api/reports/${id}/export-pdf`} style={{ ...btn(BLUE), textDecoration:'none' }}>📑 PDF</a>
          <button onClick={deleteReport} disabled={deleting} style={btn('#dc2626')}>🗑 Delete</button>
          <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:12 }}>← Dashboard</button>
        </div>
      </header>

      <main style={{ maxWidth:1100, margin:'0 auto', padding:'20px 24px' }}>

        {/* PROJECT DATES — collapsible */}
        {showDates && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h2 style={{ fontSize:14, fontWeight:700, margin:0, color: MCORE_DARK }}>Project Dates</h2>
              <button onClick={saveDates} style={btn(BLUE)}>Save & Hide</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                { title:'TENDER', fields:[['Start',tenderStart,setTenderStart],['Offers Received',tenderOffersReceived,setTenderOffersReceived],['Offers Review',tenderOffersReview,setTenderOffersReview],['Finish',tenderFinish,setTenderFinish]] },
                { title:'CONTRACTING', fields:[['Start',contractingStart,setContractingStart],['Review Legal',contractingReviewLegal,setContractingReviewLegal],['Finish',contractingFinish,setContractingFinish]] },
                { title:'CONSTRUCTION', fields:[['Proceed Notice',constructionProceedNotice,setConstructionProceedNotice],['Start',constructionStart,setConstructionStart],['Finish Estimated',constructionFinishEstimated,setConstructionFinishEstimated]] },
                { title:'CONTRACT', fields:[['Contract Start',contractStart,setContractStart],['Contract Finish',contractFinish,setContractFinish]] },
              ].map(section => (
                <div key={section.title} style={{ background:'#f9fafb', borderRadius:8, padding:12 }}>
                  <div style={{ fontWeight:700, fontSize:11, color: BLUE_DARK, marginBottom:10, letterSpacing:0.5 }}>{section.title}</div>
                  {section.fields.map(([label, value, setter]: any) => (
                    <div key={label} style={{ marginBottom:8 }}>
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
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h2 style={{ fontSize:14, fontWeight:700, margin:0, color: MCORE_DARK }}>Edit Activity Weights for this Project</h2>
              <div style={{ display:'flex', gap:8 }}>
                <span style={{ fontSize:12, color: acts.reduce((s: number, a: any) => s + (weights[a.activity_id]??a.activity?.default_weight??0), 0) === 100 ? '#065f46' : '#dc2626', fontWeight:600, padding:'4px 10px', background: acts.reduce((s: number, a: any) => s + (weights[a.activity_id]??a.activity?.default_weight??0), 0) === 100 ? '#ecfdf5' : '#fef2f2', borderRadius:6 }}>
                  Total: {acts.reduce((s: number, a: any) => s + (weights[a.activity_id]??a.activity?.default_weight??0), 0)}%
                </span>
                <button onClick={saveWeights} style={btn(BLUE)}>Save weights</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {acts.map((a: any) => (
                <div key={a.activity_id} style={{ background:'#f9fafb', borderRadius:8, padding:10 }}>
                  <div style={{ fontSize:12, fontWeight:500, color: MCORE_DARK, marginBottom:6 }}>{a.activity?.name}</div>
                  <input type="number" min={0} max={100} value={weights[a.activity_id]??a.activity?.default_weight??0}
                    onChange={e => setWeights(prev => ({ ...prev, [a.activity_id]: Number(e.target.value) }))}
                    style={{ ...inp, textAlign:'center', fontWeight:600, fontSize:14 }} />
                  <div style={{ fontSize:10, color:'#9ca3af', marginTop:4, textAlign:'center' }}>Default: {a.activity?.default_weight}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REPORT HEADER */}
        <div style={{ background: MCORE_DARK, borderRadius:12, padding:'20px 28px', color:'#fff', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>{report.project?.name}</h1>
              <p style={{ color:'rgba(255,255,255,0.6)', marginTop:4, fontSize:13 }}>{report.period_start} – {report.period_end}</p>
              {contractFinish && <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginTop:2 }}>
                Contract finish: {contractFinish} · Days remaining: {daysBetween(today, contractFinish)}
              </p>}
              {estimatedAtContractFinish !== null && (
                <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', borderRadius:8, padding:'5px 12px' }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>Estimated at contract finish:</span>
                  <span style={{ fontSize:18, fontWeight:700, color: trendColor }}>{estimatedAtContractFinish.toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:40, fontWeight:700 }}>{totalProgress.toFixed(2)}%</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>weighted progress</div>
            </div>
          </div>
          <div style={{ marginTop:14, height:6, background:'rgba(255,255,255,0.15)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', background: ORANGE, borderRadius:99, width:`${Math.min(totalProgress,100)}%`, transition:'width 0.5s' }} />
          </div>
        </div>

        {/* 3 MINI CHARTS — always visible */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
          {[
            { ref: tenderChartRef, total: tenderTotal, label: 'Tender' },
            { ref: contractingChartRef, total: contractingTotal, label: 'Contracting' },
            { ref: constructionChartRef, total: constructionTotal, label: 'Construction' },
          ].map(item => (
            <div key={item.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
              <canvas ref={item.ref} height={150} />
              {item.total > 0 && <div style={{ textAlign:'center', fontSize:11, color:'#6b7280', marginTop:4 }}>Total: {item.total} days</div>}
            </div>
          ))}
        </div>

        {/* MAIN CHART — dark bg */}
        {allReports.length >= 1 && (
          <div style={{ background: GRAY_CHART, borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={{ fontSize:14, fontWeight:700, margin:0, color:'#e5e7eb' }}>Works Progress · {report.project?.name}</h2>
              {estimatedAtContractFinish !== null && (
                <div style={{ fontSize:12, color: trendColor, fontWeight:700, background:'rgba(255,255,255,0.1)', padding:'4px 12px', borderRadius:6 }}>
                  Trend: {estimatedAtContractFinish.toFixed(1)}% at finish
                </div>
              )}
            </div>
            <canvas ref={mainChartRef} height={220} />
          </div>
        )}

        {/* ACTIVITIES */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
          <h2 style={{ fontSize:14, fontWeight:700, marginBottom:14, color: MCORE_DARK }}>Activities Progress</h2>
          {acts.map((a: any) => {
            const w = getWeight(a.activity_id, a.activity?.default_weight||0)
            return (
              <div key={a.activity_id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <span style={{ width:190, fontSize:13, color: MCORE_DARK }}>{a.activity?.name}</span>
                <span style={{ fontSize:11, color:'#9ca3af', width:28 }}>{w}%</span>
                <div style={{ flex:1, height:7, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, width:`${a.progress}%`, background: a.progress===100? MCORE_DARK:a.progress>0? ORANGE:'#e5e7eb', transition:'width 0.3s' }} />
                </div>
                <span style={{ width:38, textAlign:'right', fontSize:13, fontWeight:600, color: MCORE_DARK }}>{a.progress}%</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, minWidth:72, textAlign:'center',
                  background:a.progress===0?'#f3f4f6':a.progress<100?'#fef3c7':'#ecfdf5',
                  color:a.progress===0?'#6b7280':a.progress<100?'#92400e':'#065f46' }}>
                  {a.progress===0?'Not started':a.progress<100?'In progress':'Completed'}
                </span>
              </div>
            )
          })}
        </div>

        {/* TEXT SECTIONS */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
          {[
            { label:'✓ Works completed', value: worksDone, setter: setWorksDone, color:'#065f46', key:'done' },
            { label:'→ Works planned', value: worksPlanned, setter: setWorksPlanned, color: BLUE_DARK, key:'planned' },
            { label:'🚩 Red Flags', value: redFlags, setter: setRedFlags, color:'#7f1d1d', key:'flags' },
          ].map(section => (
            <div key={section.key} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18 }}>
              <h3 style={{ fontSize:13, fontWeight:600, color: section.color, marginBottom:10 }}>{section.label}</h3>
              {editing ? (
                <textarea value={section.value} onChange={e => section.setter(e.target.value)} rows={5}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 10px', fontSize:13, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
              ) : (
                <div style={{ fontSize:13, color:'#374151', whiteSpace:'pre-line', minHeight:50 }}>{section.value || '—'}</div>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginBottom:20 }}>
            <button onClick={() => setEditing(false)} style={{ padding:'8px 18px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Cancel</button>
            <button onClick={saveText} disabled={saving} style={{ ...btn(BLUE), padding:'8px 20px', fontSize:13 }}>
              {saving ? 'Saving...' : 'Save text'}
            </button>
          </div>
        )}

        {/* PHOTOS */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
          <h2 style={{ fontSize:14, fontWeight:700, marginBottom:14, color: MCORE_DARK }}>Site Photos</h2>
          <div
            ref={dropRef}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handlePhotoDrop}
            style={{ border:`2px dashed ${dragOver ? BLUE : '#d1d5db'}`, borderRadius:10, padding:28, textAlign:'center',
              background: dragOver ? '#eff6ff' : '#f9fafb', transition:'all 0.2s', marginBottom:14, cursor:'pointer' }}
          >
            {uploadingPhoto ? (
              <div style={{ color: BLUE, fontSize:13 }}>Uploading...</div>
            ) : (
              <>
                <div style={{ fontSize:28, marginBottom:6 }}>📸</div>
                <div style={{ fontSize:13, color:'#6b7280' }}>Drag & drop photos here</div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>JPG, PNG supported</div>
              </>
            )}
          </div>
          {photos.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {photos.map((src, i) => (
                <div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden', aspectRatio:'4/3' }}>
                  <img src={src} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  <button onClick={() => removePhoto(i)}
                    style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:99, width:22, height:22, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
