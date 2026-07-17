import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('reports')
    .select('*, project:projects(id,name,location,client), activities:report_activities(*, activity:activities(*)), payments:report_payments(*)')
    .eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.works_done !== undefined) update.works_done = body.works_done
    if (body.works_planned !== undefined) update.works_planned = body.works_planned
    if (body.red_flags !== undefined) update.red_flags = body.red_flags
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
          .update({ progress: a.progress })
          .eq('report_id', params.id)
          .eq('activity_id', a.activity_id)
        if (error) throw error
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from('reports').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
