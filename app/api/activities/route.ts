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

// Returns the 8 standard activities (project_id is null) plus any custom
// activities created specifically for the given project.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  let query = supabase.from('activities').select('*').order('sort_order', { ascending: true })
  if (projectId) {
    query = query.or(`project_id.is.null,project_id.eq.${projectId}`)
  } else {
    query = query.is('project_id', null)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

// Create a new custom activity/category scoped to a specific project.
// Body: { name, default_weight, project_id }
export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Autentificare necesara' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body.name || !body.project_id) return NextResponse.json({ error: 'name si project_id sunt obligatorii' }, { status: 400 })
    if (!(await canEditProject(user, body.project_id))) return NextResponse.json({ error: 'Nu ai drepturi de editare pentru acest proiect.' }, { status: 403 })

    const { data: existing } = await supabase.from('activities').select('sort_order').order('sort_order', { ascending: false }).limit(1)
    const nextSortOrder = (existing?.[0]?.sort_order || 0) + 1

    const { data, error } = await supabase.from('activities').insert({
      name: body.name,
      default_weight: body.default_weight ?? 0,
      project_id: body.project_id,
      sort_order: nextSortOrder,
    }).select().single()
    if (error) throw error
    return NextResponse.json({ ok: true, activity: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

