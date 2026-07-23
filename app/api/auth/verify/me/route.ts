import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pp_session')?.value
  if (!token) return NextResponse.json({ user: null })
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return NextResponse.json({ user: { id: payload.sub, name: payload.name, email: payload.email, role: payload.role } })
  } catch {
    return NextResponse.json({ user: null })
  }
}

