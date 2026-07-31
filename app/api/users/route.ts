import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('pp_session')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin') return null
    return payload
  } catch {
    return null
  }
}

// List all users (id, name, email, role only — never pin_hash). Admin-only, used
// for assigning editors to projects.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Doar un admin poate vedea lista de utilizatori.' }, { status: 403 })
  const { data, error } = await supabase.from('users').select('id, name, email, role').order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

