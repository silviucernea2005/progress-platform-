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

// Sends an email via Resend if RESEND_API_KEY + NOTIFY_EMAIL are configured in Vercel env vars.
// Silently does nothing otherwise, so this never breaks the app if not set up yet.
async function sendNotificationEmail(subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || 'Progress Platform <onboarding@resend.dev>',
        to: process.env.NOTIFY_EMAIL,
        subject,
        html,
      }),
    })
  } catch {}
}

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
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const body = await req.json()
    const { activities, payments, weekly, created_by, ...reportData } = body
    if (!reportData.project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    const allowed = await canEditProject(user, reportData.project_id)
    if (!allowed) return NextResponse.json({ error: 'You don't have edit rights on this project.' }, { status: 403 })
    const { data: report, error: rErr } = await supabase.from('reports').insert({ ...reportData, created_by: user.sub }).select().single()
    if (rErr) throw rErr
    if (activities?.length) await supabase.from('report_activities').insert(activities.map((a: any) => ({ report_id: report.id, activity_id: a.activity_id, progress: a.progress })))
    if (payments?.length) await supabase.from('report_payments').insert(payments.map((p: any) => ({ ...p, report_id: report.id })))

    const { data: projectRow } = await supabase.from('projects').select('name').eq('id', reportData.project_id).maybeSingle()
    await logActivity(user, 'report_created', `${user.name} created a report (${reportData.period_start} – ${reportData.period_end}) for "${projectRow?.name || ''}"`, { project_id: reportData.project_id, report_id: report.id })
    await sendNotificationEmail(
      `New report completed — ${projectRow?.name || ''}`,
      `<p><strong>${user.name}</strong> completed a new report for project <strong>${projectRow?.name || ''}</strong>, period ${reportData.period_start} – ${reportData.period_end}.</p>`
    )

    return NextResponse.json({ ok: true, id: report.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


