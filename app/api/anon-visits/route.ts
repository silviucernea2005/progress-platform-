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

// Returns e.g. [{ visit_date: '2026-08-07', count: 3 }, ...] for the last 14 days —
// just how many distinct anonymous visitors per day, never who they were.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Only an admin can view this.' }, { status: 403 })
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('anon_visits')
    .select('visit_date')
    .gte('visit_date', since)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  for (const row of data || []) counts[row.visit_date] = (counts[row.visit_date] || 0) + 1
  const result = Object.entries(counts)
    .map(([visit_date, count]) => ({ visit_date, count }))
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date))

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

