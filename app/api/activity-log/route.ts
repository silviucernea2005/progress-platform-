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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Only an admin can view this log.' }, { status: 403 })
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, project:projects(name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

