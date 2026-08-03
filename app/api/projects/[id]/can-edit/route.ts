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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ allowed: false })

  if (user.role === 'admin') return NextResponse.json({ allowed: true })

  const { data: project } = await supabase.from('projects').select('created_by').eq('id', params.id).maybeSingle()
  if (project?.created_by === user.sub) return NextResponse.json({ allowed: true })

  const { data: editor } = await supabase.from('project_editors').select('user_id').eq('project_id', params.id).eq('user_id', user.sub).maybeSingle()
  return NextResponse.json({ allowed: !!editor })
}

