'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const MCORE_DARK = '#1A1A2A'
const BLUE = '#185FA5'

export default function EditReportPage() {
  const { id } = useParams()
  const router = useRouter()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  useEffect(() => {
    fetch(`/api/reports/${id}`).then(r => r.json()).then(data => {
      setReport(data)
      setPeriodStart(data.period_start || '')
      setPeriodEnd(data.period_end || '')
      setLoading(false)
    })
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (periodStart && periodEnd && periodStart > periodEnd) {
      setError('Data de start nu poate fi după data de final.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: periodStart, period_end: periodEnd })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(`Nu s-a putut salva: ${err.error || res.status}`)
        setSaving(false)
        return
      }
      router.push(`/reports/${id}`)
    } catch {
      setError('Eroare de rețea. Verifică conexiunea și încearcă din nou.')
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Se încarcă...</div>
  if (!report || report.error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Raportul nu a fost găsit</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 30px', width: '100%', maxWidth: 420, boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: MCORE_DARK, marginBottom: 4 }}>Edit Report</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>{report.project?.name}</p>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 5 }}>Period start</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} required
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 5 }}>Period end</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => router.push(`/reports/${id}`)}
              style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Se salvează...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
