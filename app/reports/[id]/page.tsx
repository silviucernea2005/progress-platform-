'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const MCORE = '#1A1A2A'
const MCORE_LIGHT = '#2C2C3E'
const ORANGE = '#D46A28'
const BLUE_LINE = '#185FA5'
const GRAY = '#888780'

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
  const [showDates, setShowDates] = useState(true)

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
    if (!confirm('Delete this report?')) return
    setDeleting(true)
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  function daysBetween(a: string, b: string) {
    if (!a || !b) return 0
    return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
  }

  const today = new Date().toISOString().split('T')[0]
  const tenderTotal = daysBetween(tenderStart, tenderFinish)
  const contractingTotal = daysBetween(contractingStart, contractingFinish)
  const constructionTotal = daysBetween(constructionStart, constructionFinishEstimated)

  useEffect(() => {
    if (!allReports.length) return
    const loadChart = () => {
      const Chart = (window as any).Chart
      if (!Chart) return
      chartInstances.current.forEach(c => c?.destroy())
      chartInstances.current = []

      const labels = allReports.map(r => r.period_end)
      const cumulatedData = allReports.map(r => {
        const acts = r.activities || []
        return parseFloat(acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0).toFixed(2))
      })
      // Actual Progress per period = difference between cumulated values
      const actualData = cumulatedData.map((v, i) => i === 0 ? v : parseFloat((v - cumulatedData[i-1]).toFixed(2)))

      // Trend extrapolation
      const allLabels = [...labels]
      const trendFull: (number|null)[] = [...Array(cumulatedData.length - 1).fill(null)]

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

        // Show estimated % at contract finish
        if (contractFinish) {
          const daysToFinish = daysBetween(labels[labels.length - 1], contractFinish)
          const weeksToFinish = daysToFinish / 7
          const estimatedAtFinish = Math.min(100, lastProgress + Math.max(weeklyGain, 0) * weeksToFinish)
          console.log(`Estimated at contract finish: ${estimatedAtFinish.toFixed(1)}%`)
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
              {
                label: 'Cumulated Progress',
                data: cumulatedFull,
                borderColor: ORANGE,
                backgroundColor: 'rgba(212,106,40,0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: ORANGE,
                pointRadius: 4,
                tension: 0.35,
                fill: true,
                yAxisID: 'y',
              },
              {
                label: 'Actual Progress',
                data: actualFull,
                borderColor: BLUE_LINE,
                backgroundColor: 'rgba(24,95,165,0.04)',
                borderWidth: 1.5,
                pointBackgroundColor: BLUE_LINE,
                pointRadius: 3,
                tension: 0.35,
                fill: false,
                yAxisID: 'y',
              },
              {
                label: 'Trend (extrapolated)',
                data: trendFull,
                borderColor: GRAY,
                borderWidth: 1.5,
                borderDash: [6, 4],
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
              legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 20 } },
              tooltip: { callbacks: { label: (ctx: any) => ctx.parsed.y !== null ? ` ${ctx.dataset.label}: ${ctx.parsed.y}%` : '' } }
            },
            scales: {
              y: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } },
              x: { ticks: { maxRotation: 30, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
            }
          }
        }))
      }

      function miniBar(ref: any, labels: string[], values: number[], title: string) {
        if (!ref.current) return
        chartInstances.current.push(new Chart(ref.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data: values, backgroundColor: [MCORE_LIGHT, MCORE, MCORE, MCORE], borderRadius: 4 }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: title, font: { size: 12, weight: 'bold' }, color: MCORE }
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
        [0, daysBetween(tenderStart, tenderOffersReceived), daysBetween(tenderOffersReceived, tenderOffersReview), daysBetween(tenderOffersReview, tenderFinish)],
        'Tender Days'
      )
      miniBar(contractingChartRef,
        ['Start', 'Review Legal', 'Finish'],
        [0, daysBetween(contractingStart, contractingReviewLegal), daysBetween(contractingReviewLegal, contractingFinish)],
        'Contracting Days'
      )
      miniBar(constructionChartRef,
        ['Proceed Notice', 'Start', 'Finish Estimated'],
        [daysBetween(constructionProceedNotice, constructionStart), daysBetween(constructionStart, today), constructionTotal],
        'Construction Days'
      )
    }

    if ((window as any).Chart) loadChart()
    else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
      s.onload = loadChart
      document.head.appendChild(s)
    }
  }, [allReports, constructionFinishEstimated, contractFinish, tenderStart, tenderOffersReceived, tenderOffersReview, tenderFinish, contractingStart, contractingReviewLegal, contractingFinish, constructionProceedNotice, constructionStart])

  // Estimated % at contract finish
  let estimatedAtContractFinish: number | null = null
  if (allReports.length >= 2 && contractFinish) {
    const cumulatedData = allReports.map(r => {
      const acts = r.activities || []
      return parseFloat(acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0).toFixed(2))
    })
    const lastProgress = cumulatedData[cumulatedData.length - 1]
    const prevProgress = cumulatedData[cumulatedData.length - 2]
    const weeklyGain = lastProgress - prevProgress
    const lastDate = allReports[allReports.length - 1].period_end
    const weeksToFinish = daysBetween(lastDate, contractFinish) / 7
    estimatedAtContractFinish = Math.min(100, lastProgress + Math.max(weeklyGain, 0) * weeksToFinish)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>Loading...</div>
  if (!report || report.error) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>Report not found</div>

  const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order||0) - (b.activity?.sort_order||0))
  const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight||0) / 100, 0)

  const inp = { border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' as any }
  const lbl = { display:'block', fontSize:11, color:'#6b7280', marginBottom:3 }

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f3' }}>
      {/* HEADER */}
      <header style={{ background: MCORE, color:'#fff', padding:'12px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:700, letterSpacing:0.5 }}>M.CORE · Progress Platform</span>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => setShowDates(!showDates)} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>
            {showDates ? '▲ Hide dates' : '📅 Project dates'}
          </button>
          <button onClick={() => setEditing(!editing)} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>
            ✏️ Edit text
          </button>
          <a href={`/api/reports/${id}/export-word`} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', padding:'5px 12px', borderRadius:6, textDecoration:'none', fontSize:12 }}>📄 Word</a>
          <button onClick={deleteReport} disabled={deleting} style={{ background:'rgba(220,38,38,0.7)', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>
            🗑 Delete
          </button>
          <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:13 }}>← Dashboard</button>
        </div>
      </header>

      <main style={{ maxWidth:1100, margin:'0 auto', padding:'24px' }}>

        {/* DATE PROIECT */}
        {showDates && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h2 style={{ fontSize:14, fontWeight:700, margin:0, color: MCORE }}>Project Dates</h2>
              <button onClick={saveDates} style={{ background: MCORE, color:'#fff', border:'none', borderRadius:8, padding:'7px 18px', fontSize:13, cursor:'pointer', fontWeight:600 }}>Save dates</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                { title:'TENDER', fields:[['Start', tenderStart, setTenderStart],['Offers Received', tenderOffersReceived, setTenderOffersReceived],['Offers Review', tenderOffersReview, setTenderOffersReview],['Finish', tenderFinish, setTenderFinish]] },
                { title:'CONTRACTING', fields:[['Start', contractingStart, setContractingStart],['Review Legal', contractingReviewLegal, setContractingReviewLegal],['Finish', contractingFinish, setContractingFinish]] },
                { title:'CONSTRUCTION', fields:[['Proceed Notice', constructionProceedNotice, setConstructionProceedNotice],['Start', constructionStart, setConstructionStart],['Finish Estimated', constructionFinishEstimated, setConstructionFinishEstimated]] },
                { title:'CONTRACT', fields:[['Contract Start', contractStart, setContractStart],['Contract Finish', contractFinish, setContractFinish]] },
              ].map(section => (
                <div key={section.title} style={{ background:'#f9fafb', borderRadius:8, padding:12 }}>
                  <div style={{ fontWeight:700, fontSize:11, color: MCORE, marginBottom:10, letterSpacing:0.5 }}>{section.title}</div>
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

        {/* REPORT HEADER */}
        <div style={{ background: MCORE, borderRadius:12, padding:'20px 28px', color:'#fff', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h1 style={{ fontSize:20, fontWeight:700, margin:0, letterSpacing:0.3 }}>{report.project?.name}</h1>
              <p style={{ color:'rgba(255,255,255,0.6)', marginTop:4, fontSize:13 }}>{report.period_start} – {report.period_end}</p>
              {contractFinish && <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginTop:2 }}>
                Contract finish: {contractFinish} · Days remaining: {daysBetween(today, contractFinish)}
              </p>}
              {estimatedAtContractFinish !== null && (
                <div style={{ marginTop:8, background:'rgba(255,255,255,0.12)', borderRadius:8, padding:'6px 12px', display:'inline-block' }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.8)' }}>Estimated progress at contract finish: </span>
                  <span style={{ fontSize:16, fontWeight:700, color: estimatedAtContractFinish >= 100 ? '#86efac' : '#fbbf24' }}>
                    {estimatedAtContractFinish.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:38, fontWeight:700 }}>{totalProgress.toFixed(2)}%</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>weighted progress</div>
            </div>
          </div>
          <div style={{ marginTop:14, height:6, background:'rgba(255,255,255,0.15)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', background: ORANGE, borderRadius:99, width:`${Math.min(totalProgress,100)}%`, transition:'width 0.5s' }} />
          </div>
        </div>

        {/* 3 MINI CHARTS */}
        {(tenderStart || contractingStart || constructionStart) && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
            {[
              { ref: tenderChartRef, total: tenderTotal, label: 'Tender' },
              { ref: contractingChartRef, total: contractingTotal, label: 'Contracting' },
              { ref: constructionChartRef, total: constructionTotal, label: 'Construction' },
            ].map(item => (
              <div key={item.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
                <canvas ref={item.ref} height={150} />
                {item.total > 0 && <div style={{ textAlign:'center', fontSize:11, color:'#6b7280', marginTop:6 }}>Total: {item.total} days</div>}
              </div>
            ))}
          </div>
        )}

        {/* MAIN CHART */}
        {allReports.length >= 1 && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h2 style={{ fontSize:14, fontWeight:700, margin:0, color: MCORE }}>Works Progress · {report.project?.name}</h2>
              {estimatedAtContractFinish !== null && (
                <div style={{ fontSize:11, background: estimatedAtContractFinish >= 100 ? '#ecfdf5' : '#fef3c7', color: estimatedAtContractFinish >= 100 ? '#065f46' : '#92400e', padding:'4px 10px', borderRadius:6, fontWeight:600 }}>
                  At contract finish: {estimatedAtContractFinish.toFixed(1)}%
                </div>
              )}
            </div>
            <canvas ref={mainChartRef} height={220} />
          </div>
        )}

        {/* ACTIVITIES */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, marginBottom:20 }}>
          <h2 style={{ fontSize:14, fontWeight:700, marginBottom:14, color: MCORE }}>Activities Progress</h2>
          {acts.map((a: any) => (
            <div key={a.activity_id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <span style={{ width:200, fontSize:13 }}>{a.activity?.name}</span>
              <span style={{ fontSize:11, color:'#9ca3af', width:28 }}>{a.activity?.default_weight}%</span>
              <div style={{ flex:1, height:7, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, width:`${a.progress}%`, background: a.progress===100?'#1A1A2A':a.progress>0? ORANGE :'#e5e7eb', transition:'width 0.3s' }} />
              </div>
              <span style={{ width:38, textAlign:'right', fontSize:13, fontWeight:600 }}>{a.progress}%</span>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:a.progress===0?'#f3f4f6':a.progress<100?'#fef3c7':'#ecfdf5', color:a.progress===0?'#6b7280':a.progress<100?'#92400e':'#065f46', minWidth:70, textAlign:'center' }}>
                {a.progress===0?'Not started':a.progress<100?'In progress':'Completed'}
              </span>
            </div>
          ))}
        </div>

        {/* TEXT SECTIONS */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          {[
            { label:'✓ Works completed', value: worksDone, setter: setWorksDone, color:'#065f46', bg:'#ecfdf5', key:'done' },
            { label:'→ Works planned', value: worksPlanned, setter: setWorksPlanned, color:'#1e3a5f', bg:'#eff6ff', key:'planned' },
            { label:'🚩 Red Flags', value: redFlags, setter: setRedFlags, color:'#7f1d1d', bg:'#fef2f2', key:'flags' },
          ].map(section => (
            <div key={section.key} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:18 }}>
              <h3 style={{ fontSize:13, fontWeight:600, color: section.color, marginBottom:10 }}>{section.label}</h3>
              {editing ? (
                <textarea value={section.value} onChange={e => section.setter(e.target.value)} rows={6}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 10px', fontSize:13, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
              ) : (
                <div style={{ fontSize:13, color:'#374151', whiteSpace:'pre-line', minHeight:60 }}>{section.value || '—'}</div>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
            <button onClick={() => setEditing(false)} style={{ padding:'9px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:14, cursor:'pointer' }}>Cancel</button>
            <button onClick={saveText} disabled={saving} style={{ padding:'9px 24px', background: MCORE, color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
