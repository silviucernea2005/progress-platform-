'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ReportPage() {
  const { id } = useParams()
  const router = useRouter()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [allReports, setAllReports] = useState<any[]>([])

  // Contract dates (stored locally per project — future: from DB)
  const [contractStart, setContractStart] = useState('')
  const [contractFinish, setContractFinish] = useState('')
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
  const [showDates, setShowDates] = useState(true)

  const mainChartRef = useRef<HTMLCanvasElement>(null)
  const tenderChartRef = useRef<HTMLCanvasElement>(null)
  const contractingChartRef = useRef<HTMLCanvasElement>(null)
  const constructionChartRef = useRef<HTMLCanvasElement>(null)
  const chartInstances = useRef<any[]>([])

  useEffect(() => {
    fetch(`/api/reports/${id}`).then(r => r.json()).then(data => {
      setReport(data)
      setLoading(false)
      if (data.project_id) {
        fetch(`/api/reports?project_id=${data.project_id}`)
          .then(r => r.json())
          .then(reports => setAllReports(Array.isArray(reports) ? reports.reverse() : []))
        // Load saved dates from localStorage
        const saved = localStorage.getItem(`project_dates_${data.project_id}`)
        if (saved) {
          const d = JSON.parse(saved)
          setContractStart(d.contractStart||'')
          setContractFinish(d.contractFinish||'')
          setTenderStart(d.tenderStart||'')
          setTenderOffersReceived(d.tenderOffersReceived||'')
          setTenderOffersReview(d.tenderOffersReview||'')
          setTenderFinish(d.tenderFinish||'')
          setContractingStart(d.contractingStart||'')
          setContractingReviewLegal(d.contractingReviewLegal||'')
          setContractingFinish(d.contractingFinish||'')
          setConstructionProceedNotice(d.constructionProceedNotice||'')
          setConstructionStart(d.constructionStart||'')
          setConstructionFinishEstimated(d.constructionFinishEstimated||'')
        }
      }
    })
  }, [id])

  function saveDates() {
    if (!report?.project_id) return
    localStorage.setItem(`project_dates_${report.project_id}`, JSON.stringify({
      contractStart, contractFinish, tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish,
      contractingStart, contractingReviewLegal, contractingFinish,
      constructionProceedNotice, constructionStart, constructionFinishEstimated
    }))
    setShowDates(false)
  }

  function daysBetween(a: string, b: string) {
    if (!a || !b) return 0
    return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
  }

  const tenderTotal = daysBetween(tenderStart, tenderFinish)
  const tenderOffers = daysBetween(tenderStart, tenderOffersReceived)
  const tenderReview = daysBetween(tenderOffersReceived, tenderOffersReview)
  const tenderFin = daysBetween(tenderOffersReview, tenderFinish)

  const contractingTotal = daysBetween(contractingStart, contractingFinish)
  const contractingReview = daysBetween(contractingStart, contractingReviewLegal)
  const contractingFin = daysBetween(contractingReviewLegal, contractingFinish)

  const constructionTotal = daysBetween(constructionStart, constructionFinishEstimated)
  const constructionNotice = daysBetween(constructionProceedNotice, constructionStart)
  const constructionActual = daysBetween(constructionStart, new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!allReports.length) return
    const loadChart = () => {
      const Chart = (window as any).Chart
      if (!Chart) return

      // Destroy old instances
      chartInstances.current.forEach(c => c?.destroy())
      chartInstances.current = []

      const labels = allReports.map(r => r.period_end)
      const progressData = allReports.map(r => {
        const acts = r.activities || []
        return parseFloat(acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0).toFixed(2))
      })

      // Trend line — extrapolate from last week's increment
      let trendData: (number | null)[] = progressData.map(() => null)
      let trendExtended: any[] = []
      let extendedLabels = [...labels]

      if (progressData.length >= 2 && constructionFinishEstimated) {
        const lastIdx = progressData.length - 1
        const lastProgress = progressData[lastIdx]
        const prevProgress = progressData[lastIdx - 1]
        const weeklyGain = lastProgress - prevProgress

        if (weeklyGain > 0) {
          // Project forward from last known date to contract finish
          const lastDate = new Date(labels[lastIdx])
          const finishDate = new Date(constructionFinishEstimated)
          let current = new Date(lastDate)
          let currentProg = lastProgress
          trendData[lastIdx] = lastProgress

          while (current <= finishDate && currentProg < 100) {
            current = new Date(current.getTime() + 7 * 86400000)
            currentProg = Math.min(100, currentProg + weeklyGain)
            const dateStr = current.toISOString().split('T')[0]
            extendedLabels.push(dateStr)
            trendExtended.push({ x: dateStr, y: parseFloat(currentProg.toFixed(2)) })
          }
        }
      }

      const allLabels = extendedLabels
      const progressFull = [...progressData, ...Array(extendedLabels.length - labels.length).fill(null)]
      const trendFull = [
        ...Array(progressData.length - 1).fill(null),
        ...(progressData.length ? [progressData[progressData.length - 1]] : []),
        ...trendExtended.map(t => t.y)
      ]

      // Main chart
      if (mainChartRef.current) {
        chartInstances.current.push(new Chart(mainChartRef.current, {
          type: 'line',
          data: {
            labels: allLabels,
            datasets: [
              {
                label: 'Progres Percent',
                data: progressFull,
                borderColor: '#D46A28',
                backgroundColor: 'rgba(212,106,40,0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: '#D46A28',
                pointRadius: 4,
                tension: 0.35,
                fill: true,
                yAxisID: 'y',
              },
              {
                label: 'Trend extrapolat',
                data: trendFull,
                borderColor: '#888780',
                borderWidth: 1.5,
                borderDash: [6, 3],
                pointRadius: 0,
                tension: 0.35,
                fill: false,
                yAxisID: 'y',
              }
            ]
          },
          options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true, position: 'top', labels: { font: { size: 11 } } },
              tooltip: { callbacks: { label: (ctx: any) => ctx.parsed.y !== null ? ` ${ctx.dataset.label}: ${ctx.parsed.y}%` : '' } }
            },
            scales: {
              y: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { ticks: { maxRotation: 30, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
          }
        }))
      }

      // Mini chart factory
      function miniBar(ref: any, labels: string[], values: number[], colors: string[], title: string) {
        if (!ref.current) return
        chartInstances.current.push(new Chart(ref.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: title, font: { size: 12, weight: 'bold' } }
            },
            scales: {
              y: { beginAtZero: true, ticks: { font: { size: 9 } } },
              x: { ticks: { font: { size: 9 }, maxRotation: 20 } }
            }
          }
        }))
      }

      miniBar(tenderChartRef,
        ['Start', 'Offers Received', 'Offers Review', 'Finish'],
        [0, tenderOffers, tenderReview, tenderFin],
        ['#B5D4F4', '#185FA5', '#185FA5', '#0C447C'],
        'Tender Days'
      )

      miniBar(contractingChartRef,
        ['Start', 'Review Legal', 'Finish'],
        [0, contractingReview, contractingFin],
        ['#B5D4F4', '#185FA5', '#0C447C'],
        'Contracting Days'
      )

      miniBar(constructionChartRef,
        ['Proceed Notice', 'Start', 'Finish Estimated'],
        [constructionNotice, constructionActual, constructionTotal],
        ['#B5D4F4', '#185FA5', '#0C447C'],
        'Construction Days'
      )
    }

    if ((window as any).Chart) {
      loadChart()
    } else {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
      script.onload = loadChart
      document.head.appendChild(script)
    }
  }, [allReports, constructionFinishEstimated, tenderOffers, tenderReview, tenderFin, contractingReview, contractingFin, constructionNotice, constructionActual, constructionTotal])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#9ca3af' }}>Se incarca...</div>
  if (!report || report.error) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#9ca3af' }}>Raport negasit</div>

  const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order||0) - (b.activity?.sort_order||0))
  const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight||0) / 100, 0)

  const inp = { border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' as any }
  const lbl = { display:'block', fontSize:11, color:'#6b7280', marginBottom:3 }

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb' }}>
      <header style={{ background:'#0C447C', color:'#fff', padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:600 }}>Progress Platform</span>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <button onClick={() => setShowDates(!showDates)} style={{ background:'rgba(255,255,255,0.2)', color:'#fff', border:'none', borderRadius:8, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>
            {showDates ? '⬆ Ascunde date' : '📅 Date proiect'}
          </button>
          <a href={`/api/reports/${id}/export-word`} style={{ background:'rgba(255,255,255,0.2)', color:'#fff', padding:'5px 12px', borderRadius:8, textDecoration:'none', fontSize:12 }}>📄 Word</a>
          <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:13 }}>← Dashboard</button>
        </div>
      </header>

      <main style={{ maxWidth:1100, margin:'0 auto', padding:'24px' }}>

        {/* DATE PROIECT */}
        {showDates && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:14, fontWeight:600, margin:0, color:'#111827' }}>Date proiect — Tender / Contracting / Construction</h2>
              <button onClick={saveDates} style={{ background:'#185FA5', color:'#fff', border:'none', borderRadius:8, padding:'7px 18px', fontSize:13, cursor:'pointer', fontWeight:500 }}>Salveaza</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {/* Tender */}
              <div style={{ background:'#f9fafb', borderRadius:8, padding:12 }}>
                <div style={{ fontWeight:600, fontSize:12, color:'#185FA5', marginBottom:10 }}>TENDER</div>
                <label style={lbl}>Start</label><input type="date" value={tenderStart} onChange={e=>setTenderStart(e.target.value)} style={inp} />
                <div style={{ marginTop:8 }}><label style={lbl}>Offers Received</label><input type="date" value={tenderOffersReceived} onChange={e=>setTenderOffersReceived(e.target.value)} style={inp} /></div>
                <div style={{ marginTop:8 }}><label style={lbl}>Offers Review</label><input type="date" value={tenderOffersReview} onChange={e=>setTenderOffersReview(e.target.value)} style={inp} /></div>
                <div style={{ marginTop:8 }}><label style={lbl}>Finish</label><input type="date" value={tenderFinish} onChange={e=>setTenderFinish(e.target.value)} style={inp} /></div>
              </div>
              {/* Contracting */}
              <div style={{ background:'#f9fafb', borderRadius:8, padding:12 }}>
                <div style={{ fontWeight:600, fontSize:12, color:'#185FA5', marginBottom:10 }}>CONTRACTING</div>
                <label style={lbl}>Start</label><input type="date" value={contractingStart} onChange={e=>setContractingStart(e.target.value)} style={inp} />
                <div style={{ marginTop:8 }}><label style={lbl}>Review Legal</label><input type="date" value={contractingReviewLegal} onChange={e=>setContractingReviewLegal(e.target.value)} style={inp} /></div>
                <div style={{ marginTop:8 }}><label style={lbl}>Finish</label><input type="date" value={contractingFinish} onChange={e=>setContractingFinish(e.target.value)} style={inp} /></div>
              </div>
              {/* Construction */}
              <div style={{ background:'#f9fafb', borderRadius:8, padding:12 }}>
                <div style={{ fontWeight:600, fontSize:12, color:'#185FA5', marginBottom:10 }}>CONSTRUCTION</div>
                <label style={lbl}>Proceed Notice</label><input type="date" value={constructionProceedNotice} onChange={e=>setConstructionProceedNotice(e.target.value)} style={inp} />
                <div style={{ marginTop:8 }}><label style={lbl}>Start</label><input type="date" value={constructionStart} onChange={e=>setConstructionStart(e.target.value)} style={inp} /></div>
                <div style={{ marginTop:8 }}><label style={lbl}>Finish Estimated</label><input type="date" value={constructionFinishEstimated} onChange={e=>setConstructionFinishEstimated(e.target.value)} style={inp} /></div>
              </div>
              {/* Contract general */}
              <div style={{ background:'#f9fafb', borderRadius:8, padding:12 }}>
                <div style={{ fontWeight:600, fontSize:12, color:'#185FA5', marginBottom:10 }}>CONTRACT GENERAL</div>
                <label style={lbl}>Data start contract</label><input type="date" value={contractStart} onChange={e=>setContractStart(e.target.value)} style={inp} />
                <div style={{ marginTop:8 }}><label style={lbl}>Data finish contract</label><input type="date" value={contractFinish} onChange={e=>setContractFinish(e.target.value)} style={inp} /></div>
                {contractStart && contractFinish && (
                  <div style={{ marginTop:12, background:'#E6F1FB', borderRadius:6, padding:'8px 10px', fontSize:12, color:'#185FA5' }}>
                    <strong>Durata totală:</strong> {daysBetween(contractStart, contractFinish)} zile
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HEADER RAPORT */}
        <div style={{ background:'#0C447C', borderRadius:12, padding:'20px 28px', color:'#fff', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h1 style={{ fontSize:20, fontWeight:600, margin:0 }}>{report.project?.name}</h1>
              <p style={{ color:'rgba(255,255,255,0.7)', marginTop:4, fontSize:13 }}>{report.period_start} – {report.period_end}</p>
              {contractFinish && <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginTop:2 }}>Finish contract: {contractFinish} · Zile rămase: {daysBetween(new Date().toISOString().split('T')[0], contractFinish)}</p>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:34, fontWeight:700 }}>{totalProgress.toFixed(2)}%</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>progres general ponderat</div>
            </div>
          </div>
          <div style={{ marginTop:14, height:6, background:'rgba(255,255,255,0.2)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'#fff', borderRadius:99, width:`${Math.min(totalProgress,100)}%` }} />
          </div>
        </div>

        {/* 3 MINI CHARTS */}
        {(tenderStart || contractingStart || constructionStart) && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
              <canvas ref={tenderChartRef} height={160} />
              {tenderTotal > 0 && <div style={{ textAlign:'center', fontSize:11, color:'#6b7280', marginTop:6 }}>Total: {tenderTotal} zile</div>}
            </div>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
              <canvas ref={contractingChartRef} height={160} />
              {contractingTotal > 0 && <div style={{ textAlign:'center', fontSize:11, color:'#6b7280', marginTop:6 }}>Total: {contractingTotal} zile</div>}
            </div>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
              <canvas ref={constructionChartRef} height={160} />
              {constructionTotal > 0 && <div style={{ textAlign:'center', fontSize:11, color:'#6b7280', marginTop:6 }}>Total: {constructionTotal} zile</div>}
            </div>
          </div>
        )}

        {/* GRAFIC PROGRES + TREND */}
        {allReports.length >= 1 && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>Works Progress {report.project?.name}</h2>
              {constructionFinishEstimated && allReports.length >= 2 && (
                <div style={{ fontSize:11, color:'#888780', background:'#f9fafb', padding:'4px 10px', borderRadius:6 }}>
                  Linia punctată = trend extrapolat până la {constructionFinishEstimated}
                </div>
              )}
            </div>
            <canvas ref={mainChartRef} height={220} />
          </div>
        )}

        {/* ACTIVITATI */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
          <h2 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Progres activitati</h2>
          {acts.map((a: any) => (
            <div key={a.activity_id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <span style={{ width:190, fontSize:13 }}>{a.activity?.name}</span>
              <span style={{ fontSize:11, color:'#9ca3af', width:28 }}>{a.activity?.default_weight}%</span>
              <div style={{ flex:1, height:7, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, width:`${a.progress}%`, background: a.progress===100?'#3B6D11':a.progress>0?'#185FA5':'#e5e7eb' }} />
              </div>
              <span style={{ width:38, textAlign:'right', fontSize:13, fontWeight:500 }}>{a.progress}%</span>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:a.progress===0?'#f3f4f6':a.progress<100?'#fef3c7':'#ecfdf5', color:a.progress===0?'#6b7280':a.progress<100?'#92400e':'#065f46' }}>
                {a.progress===0?'Neinceput':a.progress<100?'In executie':'Finalizat'}
              </span>
            </div>
          ))}
        </div>

        {/* LUCRARI */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18 }}>
            <h3 style={{ fontSize:13, fontWeight:500, color:'#3B6D11', marginBottom:10 }}>✓ Lucrari desfasurate</h3>
            <div style={{ fontSize:13, color:'#374151', whiteSpace:'pre-line' }}>{report.works_done||'—'}</div>
          </div>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18 }}>
            <h3 style={{ fontSize:13, fontWeight:500, color:'#185FA5', marginBottom:10 }}>→ Lucrari planificate</h3>
            <div style={{ fontSize:13, color:'#374151', whiteSpace:'pre-line' }}>{report.works_planned||'—'}</div>
          </div>
        </div>

      </main>
    </div>
  )
}
