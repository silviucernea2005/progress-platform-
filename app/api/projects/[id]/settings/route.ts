import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('project_settings')
    .select('dates, weights')
    .eq('project_id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || { dates: {}, weights: {} })
}

// Body: { dates?: {...}, weights?: {...} } — only the keys provided get updated, the rest are preserved
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
