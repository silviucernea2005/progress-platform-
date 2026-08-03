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

// List the users currently assigned as editors for this project. Admin-only.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Doar un admin poate vedea aceasta lista.' }, { status: 403 })
  const { data, error } = await supabase
    .from('project_editors')
    .select('user_id, users(id, name, email)')
    .eq('project_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

// Assign a user as an editor on this project. Body: { user_id }. Admin-only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Doar un admin poate asigna editori.' }, { status: 403 })
  try {
    const body = await req.json()
    if (!body.user_id) return NextResponse.json({ error: 'user_id este obligatoriu' }, { status: 400 })
    const { error } = await supabase.from('project_editors').upsert({ project_id: params.id, user_id: body.user_id })
    if (error) throw error
    try {
      const { data: target } = await supabase.from('users').select('name').eq('id', body.user_id).maybeSingle()
      const { data: proj } = await supabase.from('projects').select('name').eq('id', params.id).maybeSingle()
      await supabase.from('activity_log').insert({ user_id: user.sub, user_name: user.name, action: 'editor_assigned', details: `${user.name} a dat acces de editare lui ${target?.name || body.user_id} pe proiectul "${proj?.name || ''}"`, project_id: params.id })
    } catch {}
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Remove a user's editor assignment. Body: { user_id }. Admin-only.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Doar un admin poate elimina editori.' }, { status: 403 })
  try {
    const body = await req.json()
    if (!body.user_id) return NextResponse.json({ error: 'user_id este obligatoriu' }, { status: 400 })
    const { error } = await supabase.from('project_editors').delete().eq('project_id', params.id).eq('user_id', body.user_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

