'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ReportPage() {
  const { id } = useParams()
  const router = useRouter()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [allReports, setAllReports] = useState<any[]>([])
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)

  useEffect(() => {
    fetch(`/api/reports/${id}`).then(r => r.json()).then(data => {
      setReport(data)
      setLoading(false)
      if (data.project_id) {
        fetch(`/api/reports?project_id=${data.project_id}`)
          .then(r => r.json())
          .then(reports => setAllReports(Array.isArray(reports) ? reports.reverse() : []))
      }
    })
  }, [id])

  useEffect(() => {
    if (!allReports.length || !chartRef.current) return
    if (typeof window === 'undefined') return
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
    script.onload = () => {
      if (chartInstance.current) chartInstance.current.destroy()
      const Chart = (window as any).Chart
      const labels = allReports.map(r => r.period_end)
      const data = allReports.map(r => {
        const acts = r.activities || []
        return parseFloat(acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0).toFixed(2))
      })
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Progres cumulat (%)',
            data,
            borderColor: '#185FA5',
            backgroundColor: 'rgba(24,95,165,0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#185FA5',
            pointRadius: 5,
            tension: 0.35,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.parsed.y}%` } }
          },
          scales: {
            y: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%' } },
            x: { ticks: { maxRotation: 30 } }
          }
        }
      })
    }
    document.head.appendChild(script)
    return () => { if (chartInstance.current) chartInstance.current.destroy() }
  }, [allReports])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#9ca3af' }}>Se incarca...</div>
  if (!report || report.error) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#9ca3af' }}>Raport negasit</div>

  const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order||0) - (b.activity?.sort_order||0))
  const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight||0) / 100, 0)

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb' }}>
      <header style={{ background:'#0C447C', color:'#fff', padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:600 }}>Progress Platform</span>
        <div style={{ display:'flex', gap:12 }}>
          <a href={`/api/reports/${id}/export-word`} style={{ background:'rgba(255,255,255,0.2)', color:'#fff', padding:'6px 14px', borderRadius:8, textDecoration:'none', fontSize:13 }}>📄 Word</a>
          <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:14 }}>← Dashboard</button>
        </div>
      </header>
      <main style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>
        <div style={{ background:'#0C447C', borderRadius:16, padding:'28px 32px', color:'#fff', marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h1 style={{ fontSize:22, fontWeight:600, margin:0 }}>{report.project?.name}</h1>
              <p style={{ color:'rgba(255,255,255,0.7)', marginTop:4, fontSize:14 }}>{report.period_start} – {report.period_end}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:36, fontWeight:700 }}>{totalProgress.toFixed(2)}%</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>progres general</div>
            </div>
          </div>
          <div style={{ marginTop:16, height:8, background:'rgba(255,255,255,0.2)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'#fff', borderRadius:99, width:`${Math.min(totalProgress,100)}%` }} />
          </div>
        </div>

        {allReports.length > 1 && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:24, marginBottom:16 }}>
            <h2 style={{ fontSize:15, fontWeight:500, marginBottom:16 }}>Evolutie progres proiect</h2>
            <canvas ref={chartRef} height={200} />
          </div>
        )}

        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:24, marginBottom:16 }}>
          <h2 style={{ fontSize:15, fontWeight:500, marginBottom:16 }}>Progres activitati</h2>
          {acts.map((a: any) => (
            <div key={a.activity_id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <span style={{ width:200, fontSize:13 }}>{a.activity?.name}</span>
              <span style={{ fontSize:11, color:'#9ca3af', width:28 }}>{a.activity?.default_weight}%</span>
              <div style={{ flex:1, height:8, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, width:`${a.progress}%`, background: a.progress===100?'#3B6D11':a.progress>0?'#185FA5':'#e5e7eb' }} />
              </div>
              <span style={{ width:40, textAlign:'right', fontSize:13, fontWeight:500 }}>{a.progress}%</span>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:a.progress===0?'#f3f4f6':a.progress<100?'#fef3c7':'#ecfdf5', color:a.progress===0?'#6b7280':a.progress<100?'#92400e':'#065f46' }}>
                {a.progress===0?'Neinceput':a.progress<100?'In executie':'Finalizat'}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }}>
            <h3 style={{ fontSize:13, fontWeight:500, color:'#3B6D11', marginBottom:12 }}>✓ Lucrari desfasurate</h3>
            <div style={{ fontSize:13, color:'#374151', whiteSpace:'pre-line' }}>{report.works_done||'—'}</div>
          </div>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }}>
            <h3 style={{ fontSize:13, fontWeight:500, color:'#185FA5', marginBottom:12 }}>→ Lucrari planificate</h3>
            <div style={{ fontSize:13, color:'#374151', whiteSpace:'pre-line' }}>{report.works_planned||'—'}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
