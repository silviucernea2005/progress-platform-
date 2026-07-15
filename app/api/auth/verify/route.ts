import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, pin } = await req.json()
    const { data: user, error } = await supabase
      .from('users').select('*').eq('email', email.toLowerCase().trim()).single()
    if (error || !user) return NextResponse.json({ error: 'Utilizator negasit' }, { status: 401 })
    const valid = await bcrypt.compare(String(pin), user.pin_hash)
    if (!valid) return NextResponse.json({ error: 'PIN incorect' }, { status: 401 })
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const token = await new SignJWT({ sub: user.id, name: user.name, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('8h').sign(secret)
    const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
    response.cookies.set('pp_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 8, path: '/' })
    return response
  } catch (e) {
    return NextResponse.json({ error: 'Eroare server' }, { status: 500 })
  }
}
