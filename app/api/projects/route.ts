import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('pp_session')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function GET() {
  const { data, error } = await supabase.from('projects').select('*, project_settings(responsible)').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const body = await req.json()
    const { data, error } = await supabase.from('projects').insert({ ...body, created_by: user.sub }).select().single()
    if (error) throw error
    try {
      await supabase.from('activity_log').insert({ user_id: user.sub, user_name: user.name, action: 'project_created', details: `${user.name} created project "${data.name}"`, project_id: data.id })
    } catch {}
    return NextResponse.json({ ok: true, data, id: data.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


