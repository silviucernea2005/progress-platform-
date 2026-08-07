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

async function canEditProject(user: any, projectId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  const { data: project } = await supabase.from('projects').select('created_by').eq('id', projectId).maybeSingle()
  if (project?.created_by === user.sub) return true
  const { data: editor } = await supabase.from('project_editors').select('user_id').eq('project_id', projectId).eq('user_id', user.sub).maybeSingle()
  return !!editor
}

// Rename a CUSTOM (project-scoped) activity directly. Renaming a shared default
// activity (project_id IS NULL) must go through project_settings.activity_overrides
// instead — it's used by every project, so we never mutate the shared row itself.
// Body: { name?, default_weight? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data: activity } = await supabase.from('activities').select('*').eq('id', params.id).maybeSingle()
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  if (!activity.project_id) return NextResponse.json({ error: 'Default activities are shared across projects — use activity_overrides to rename them per-project instead.' }, { status: 400 })
  if (!(await canEditProject(user, activity.project_id))) return NextResponse.json({ error: "You don't have edit rights on this project." }, { status: 403 })
  try {
    const body = await req.json()
    const update: Record<string, any> = {}
    if (body.name !== undefined) update.name = body.name
    if (body.default_weight !== undefined) update.default_weight = body.default_weight
    const { error } = await supabase.from('activities').update(update).eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Delete a CUSTOM (project-scoped) activity. Never allowed for shared defaults —
// use activity_overrides.excluded to hide those on a per-project basis instead.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data: activity } = await supabase.from('activities').select('*').eq('id', params.id).maybeSingle()
  if (!activity) return NextResponse.json({ ok: true })
  if (!activity.project_id) return NextResponse.json({ error: 'Default activities are shared across projects and cannot be deleted — hide them for this project instead.' }, { status: 400 })
  if (!(await canEditProject(user, activity.project_id))) return NextResponse.json({ error: "You don't have edit rights on this project." }, { status: 403 })
  try {
    const { error } = await supabase.from('activities').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

