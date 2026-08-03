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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('project_settings')
    .select('dates, weights')
    .eq('project_id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || { dates: {}, weights: {} }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

// Body: { dates?: {...}, weights?: {...} } — only the keys provided get updated, the rest are preserved
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (!(await canEditProject(user, params.id))) return NextResponse.json({ error: 'You don't have edit rights on this project.' }, { status: 403 })
  try {
    const body = await req.json()
    const { data: existing } = await supabase.from('project_settings').select('*').eq('project_id', params.id).maybeSingle()
    const merged = {
      project_id: params.id,
      dates: body.dates !== undefined ? body.dates : (existing?.dates || {}),
      weights: body.weights !== undefined ? body.weights : (existing?.weights || {}),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('project_settings').upsert(merged)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


