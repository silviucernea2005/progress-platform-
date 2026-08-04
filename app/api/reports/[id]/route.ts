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

async function logActivity(user: any, action: string, details: string, opts: { project_id?: string, report_id?: string } = {}) {
  try {
    await supabase.from('activity_log').insert({ user_id: user.sub, user_name: user.name, action, details, project_id: opts.project_id || null, report_id: opts.report_id || null })
  } catch {}
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('reports')
    .select('*, project:projects(id,name,location,client), activities:report_activities(*, activity:activities(*)), payments:report_payments(*)')
    .eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const { data: existingReport } = await supabase.from('reports').select('project_id').eq('id', params.id).single()
    if (!existingReport) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    const allowed = await canEditProject(user, existingReport.project_id)
    if (!allowed) return NextResponse.json({ error: "You don't have edit rights on this project." }, { status: 403 })

    const body = await req.json()
    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.works_done !== undefined) update.works_done = body.works_done
    if (body.works_planned !== undefined) update.works_planned = body.works_planned
    if (body.red_flags !== undefined) update.red_flags = body.red_flags
    if (body.responsible !== undefined) update.responsible = body.responsible
    if (body.period_start !== undefined) update.period_start = body.period_start
    if (body.period_end !== undefined) update.period_end = body.period_end
    if (Object.keys(update).length > 1) {
      const { error } = await supabase.from('reports').update(update).eq('id', params.id)
      if (error) throw error
    }
    if (Array.isArray(body.activities)) {
      for (const a of body.activities) {
        const { error } = await supabase
          .from('report_activities')
          .upsert({ report_id: params.id, activity_id: a.activity_id, progress: a.progress }, { onConflict: 'report_id,activity_id' })
        if (error) throw error
      }
    }
    await logActivity(user, 'report_edited', `${user.name} edited a report`, { project_id: existingReport.project_id, report_id: params.id })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const { data: existingReport } = await supabase.from('reports').select('project_id').eq('id', params.id).single()
    if (!existingReport) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    const allowed = await canEditProject(user, existingReport.project_id)
    if (!allowed) return NextResponse.json({ error: "You don't have edit rights on this project." }, { status: 403 })

    const { error } = await supabase.from('reports').delete().eq('id', params.id)
    if (error) throw error
    await logActivity(user, 'report_deleted', `${user.name} deleted a report`, { project_id: existingReport.project_id })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}



