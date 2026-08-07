import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Records that SOME anonymous visitor was here today — nothing else. The anon_id is
// a random string generated in the browser (see the client), not tied to any name,
// email, or IP. This exists purely so an admin can see "N unknown users today"
// without ever knowing who they were.
export async function POST(req: NextRequest) {
  try {
    const { anon_id } = await req.json()
    if (!anon_id || typeof anon_id !== 'string' || anon_id.length > 100) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    // unique(anon_id, visit_date) means this silently no-ops if already recorded today
    await supabase.from('anon_visits').upsert({ anon_id, visit_date: new Date().toISOString().split('T')[0] }, { onConflict: 'anon_id,visit_date', ignoreDuplicates: true })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

