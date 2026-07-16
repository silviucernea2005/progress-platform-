'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MCORE = '#1A1A2A'
const ORANGE = '#D46A28'

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
    ]).then(([p, r]) => {
      setProjects(Array.isArray(p) ? p : [])
      setReports(Array.isArray(r) ? r : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filteredReports = selectedProject === 'all'
    ? reports
    : reports.filter(r => r.project_id === selectedProject)

  const filteredProjects = selectedProject === 'all'
    ? projects
    : projects.filter(p => p.id === selectedProject)

  function getProgress(projectId: string) {
    const rep = reports.find((r: any) => r.project_id === projectId)
    if (!rep || !rep.activities?.length) return null
    return rep.activities.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f3', display:'flex', flexDirection:'column' }}>
      {/* HEADER */}
      <header style={{ background: MCORE, color:'#fff', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:34, height:34, background:'rgba(255,255,255,0.1)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, letterSpacing:1 }}>MC</div>
          <span style={{ fontWeight:700, letterSpacing:0.5 }}>M.CORE · Progress Platform</span>
        </div>
        <nav style={{ display:'flex', gap:12, alignItems:'center' }}>
          <Link href="/projects/new" style={{ color:'rgba(255,255,255,0.7)', textDecoration:'none', fontSize:13 }}>+ New Project</Link>
          <Link href="/reports/new" style={{ background: ORANGE, color:'#fff', padding:'7px 16px', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>+ New Report</Link>
        </nav>
      </header>

      <div style={{ display:'flex', flex:1 }}>
        {/* SIDEBAR — Projects */}
        <aside style={{ width:240, background:'#fff', borderRight:'1px solid #e5e7eb', padding:'20px 0', flexShrink:0 }}>
          <div style={{ padding:'0 16px 12px', fontSize:11, fontWeight:700, color:'#9ca3af', letterSpacing:1 }}>PROJECTS</div>
          <div
            onClick={() => setSelectedProject('all')}
            style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight: selectedProject==='all'?600:400, color: selectedProject==='all'? MCORE :'#374151', background: selectedProject==='all'?'#f5f5f3':'transparent', borderLeft: selectedProject==='all'?`3px solid ${MCORE}`:'3px solid transparent' }}
          >
            All Projects
          </div>
          {loading ? (
            <div style={{ padding:'10px 16px', fontSize:13, color:'#9ca3af' }}>Loading...</div>
          ) : projects.map(p => {
            const prog = getProgress(p.id)
            return (
              <div key={p.id}
                onClick={() => setSelectedProject(p.id)}
                style={{ padding:'10px 16px', cursor:'pointer', borderLeft: selectedProject===p.id?`3px solid ${ORANGE}`:'3px solid transparent', background: selectedProject===p.id?'#fef9f5':'transparent' }}
              >
                <div style={{ fontSize:13, fontWeight: selectedProject===p.id?600:400, color: selectedProject===p.id? ORANGE : '#374151' }}>{p.name}</div>
                {prog !== null && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                    <div style={{ flex:1, height:3, background:'#f3f4f6', borderRadius:99 }}>
                      <div style={{ height:'100%', background: ORANGE, borderRadius:99, width:`${Math.min(prog,100)}%` }} />
                    </div>
                    <span style={{ fontSize:10, color:'#9ca3af' }}>{prog.toFixed(0)}%</span>
                  </div>
                )}
                <div style={{ fontSize:10, color:'#d1d5db', marginTop:2 }}>{p.location || ''}</div>
              </div>
            )
          })}
        </aside>

        {/* MAIN */}
        <main style={{ flex:1, padding:'28px 32px', overflowY:'auto' }}>

          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:28 }}>
            {[
              { label:'Active Projects', value: loading?'—': projects.filter(p=>p.status==='active').length, color: MCORE },
              { label:'Total Reports', value: loading?'—': filteredReports.length, color:'#374151' },
              { label:'Completed Projects', value: loading?'—': projects.filter(p=>p.status==='completed').length, color:'#3B6D11' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'18px 22px' }}>
                <div style={{ fontSize:30, fontWeight:700, color:k.color }}>{k.value}</div>
                <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* PROJECT CARDS */}
          {selectedProject === 'all' && (
            <>
              <h2 style={{ fontSize:16, fontWeight:700, color: MCORE, marginBottom:14 }}>Active Projects</h2>
              {loading ? <p style={{ color:'#9ca3af' }}>Loading...</p> :
              filteredProjects.filter(p=>p.status==='active').length === 0 ? (
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:32, textAlign:'center', color:'#9ca3af', marginBottom:28 }}>
                  No active projects. <Link href="/projects/new" style={{ color: ORANGE }}>Add first project</Link>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:28 }}>
                  {projects.filter(p=>p.status==='active').map((proj: any) => {
                    const prog = getProgress(proj.id)
                    const repCount = reports.filter(r => r.project_id === proj.id).length
                    return (
                      <div key={proj.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20, cursor:'pointer' }}
                        onClick={() => setSelectedProject(proj.id)}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                          <div>
                            <div style={{ fontWeight:600, color: MCORE, fontSize:14 }}>{proj.name}</div>
                            <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{proj.location || '—'}</div>
                          </div>
                          <span style={{ fontSize:11, background:'#ecfdf5', color:'#065f46', padding:'3px 10px', borderRadius:99, fontWeight:600, height:'fit-content' }}>Active</span>
                        </div>
                        {prog !== null && (
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9ca3af', marginBottom:4 }}>
                              <span>Progress</span><span style={{ fontWeight:600, color: MCORE }}>{prog.toFixed(1)}%</span>
                            </div>
                            <div style={{ height:6, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                              <div style={{ height:'100%', background: ORANGE, borderRadius:99, width:`${Math.min(prog,100)}%` }} />
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop:12, fontSize:12, color: ORANGE, fontWeight:500 }}>{repCount} report{repCount!==1?'s':''} →</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* REPORTS TABLE */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color: MCORE, margin:0 }}>
              {selectedProject === 'all' ? 'Latest Reports' : `Reports — ${projects.find(p=>p.id===selectedProject)?.name || ''}`}
            </h2>
            {selectedProject !== 'all' && (
              <Link href={`/reports/new?project=${selectedProject}`} style={{ background: ORANGE, color:'#fff', padding:'7px 16px', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>+ New Report</Link>
            )}
          </div>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600, color:'#374151' }}>Project</th>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600, color:'#374151' }}>Period</th>
                  <th style={{ textAlign:'left', padding:'12px 16px', fontWeight:600, color:'#374151' }}>Progress</th>
                  <th style={{ padding:'12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={4} style={{ padding:24, textAlign:'center', color:'#9ca3af' }}>Loading...</td></tr>
                : filteredReports.length === 0 ? <tr><td colSpan={4} style={{ padding:24, textAlign:'center', color:'#9ca3af' }}>No reports yet</td></tr>
                : filteredReports.slice(0,20).map((r: any) => {
                  const acts = r.activities || []
                  const prog = acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0)
                  return (
                    <tr key={r.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                      <td style={{ padding:'12px 16px', fontWeight:500, color: MCORE }}>{r.project?.name || '—'}</td>
                      <td style={{ padding:'12px 16px', color:'#6b7280' }}>{r.period_start} – {r.period_end}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ height:5, width:80, background:'#f3f4f6', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', background: ORANGE, borderRadius:99, width:`${Math.min(prog,100)}%` }} />
                          </div>
                          <span style={{ fontSize:12, fontWeight:600, color: MCORE }}>{prog.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>
                        <Link href={`/reports/${r.id}`} style={{ color: ORANGE, fontSize:12, textDecoration:'none', fontWeight:600 }}>View →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
