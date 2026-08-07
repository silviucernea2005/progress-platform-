import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('pp_session')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin') return null
    return payload
  } catch {
    return null
  }
}

// Returns e.g. [{ visit_date: '2026-08-07', count: 3, times: ['09:15', '13:42', '18:07'] }, ...]
// for the last 14 days — how many distinct anonymous visitors per day and what time
// each one first showed up that day. Still never who they were.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Only an admin can view this.' }, { status: 403 })
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('anon_visits')
    .select('visit_date, created_at')
    .gte('visit_date', since)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byDay: Record<string, string[]> = {}
  for (const row of data || []) {
    const time = new Date(row.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (!byDay[row.visit_date]) byDay[row.visit_date] = []
    byDay[row.visit_date].push(time)
  }
  const result = Object.entries(byDay)
    .map(([visit_date, times]) => ({ visit_date, count: times.length, times }))
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date))

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

