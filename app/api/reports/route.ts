import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  let q = supabase.from('reports').select('*, project:projects(id,name), activities:report_activities(*, activity:activities(*)), photos:report_photos(id,url)').order('period_start', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { activities, payments, weekly, created_by, ...reportData } = body
    const { data: report, error: rErr } = await supabase.from('reports').insert({ ...reportData, created_by }).select().single()
    if (rErr) throw rErr
    if (activities?.length) await supabase.from('report_activities').insert(activities.map((a: any) => ({ report_id: report.id, activity_id: a.activity_id, progress: a.progress })))
    if (payments?.length) await supabase.from('report_payments').insert(payments.map((p: any) => ({ ...p, report_id: report.id })))
    return NextResponse.json({ ok: true, id: report.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
