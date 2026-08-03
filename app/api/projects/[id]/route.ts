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

// Admins can edit/delete anything. Otherwise, only the person who created the
// project can edit/delete it — everyone else is view/export only.
async function canEditProject(user: any, projectId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  const { data: project } = await supabase.from('projects').select('created_by').eq('id', projectId).maybeSingle()
  if (project?.created_by === user.sub) return true
  const { data: editor } = await supabase.from('project_editors').select('user_id').eq('project_id', projectId).eq('user_id', user.sub).maybeSingle()
  return !!editor
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const allowed = await canEditProject(user, params.id)
  if (!allowed) return NextResponse.json({ error: 'Only the project's creator or an admin can delete this project.' }, { status: 403 })
  try {
    const { data: existing } = await supabase.from('projects').select('name').eq('id', params.id).maybeSingle()
    const { error } = await supabase.from('projects').delete().eq('id', params.id)
    if (error) throw error
    try {
      await supabase.from('activity_log').insert({ user_id: user.sub, user_name: user.name, action: 'project_deleted', details: `${user.name} deleted project "${existing?.name || ''}"` })
    } catch {}
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

