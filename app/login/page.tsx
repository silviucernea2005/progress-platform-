'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/dashboard')
    } catch {
      setError('Eroare de retea')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '40px 36px', width: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: '#185FA5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#fff', fontSize: 22, fontWeight: 700 }}>PP</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: 0 }}>Progress Platform</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Square 7 / M.Core</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="email@square7.ro" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>PIN</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="••••" maxLength={8} required />
          </div>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Se verifica...' : 'Autentificare'}
          </button>
        </form>
      </div>
    </div>
  )
}
