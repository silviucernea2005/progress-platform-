'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const active = projects.filter(p => p.status === 'active')

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#0C447C', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>PP</div>
          <span style={{ fontWeight: 600 }}>Progress Platform</span>
        </div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 14 }}>
          <Link href="/projects/new" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>+ Proiect</Link>
          <Link href="/reports/new" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '6px 14px', borderRadius: 8, textDecoration: 'none' }}>+ Raport nou</Link>
        </nav>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111827', marginBottom: 24 }}>Dashboard</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Proiecte active', value: loading ? '—' : active.length, color: '#185FA5' },
            { label: 'Rapoarte totale', value: loading ? '—' : reports.length, color: '#111827' },
            { label: 'Proiecte finalizate', value: loading ? '—' : projects.filter(p => p.status === 'completed').length, color: '#3B6D11' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 500, color: '#374151', marginBottom: 16 }}>Proiecte active</h2>
        {loading ? <p style={{ color: '#9ca3af' }}>Se incarca...</p> : active.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 32, textAlign: 'center', color: '#9ca3af' }}>
            Niciun proiect activ. <Link href="/projects/new" style={{ color: '#185FA5' }}>Adauga primul proiect</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
            {active.map((proj: any) => (
              <Link key={proj.id} href={`/reports/new?project=${proj.id}`} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, textDecoration: 'none', display: 'block' }}>
                <div style={{ fontWeight: 500, color: '#111827' }}>{proj.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{proj.location || '—'}</div>
                <div style={{ marginTop: 12, fontSize: 12, color: '#185FA5' }}>{reports.filter(r => r.project_id === proj.id).length} rapoarte →</div>
              </Link>
            ))}
          </div>
        )}
        <h2 style={{ fontSize: 17, fontWeight: 500, color: '#374151', marginBottom: 16 }}>Ultimele rapoarte</h2>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#6b7280' }}>Proiect</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#6b7280' }}>Perioada</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#6b7280' }}>Progres</th>
                <th style={{ padding: '12px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Se incarca...</td></tr>
              : reports.slice(0, 8).map((r: any) => {
                const acts = r.activities || []
                const prog = acts.reduce((s: number, a: any) => s + a.progress * (a.activity?.default_weight || 0) / 100, 0)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{r.project?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{r.period_start} – {r.period_end}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ height: 6, width: 80, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#185FA5', borderRadius: 99, width: `${Math.min(prog, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{prog.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link href={`/reports/${r.id}`} style={{ color: '#185FA5', fontSize: 12, textDecoration: 'none' }}>Vezi →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
