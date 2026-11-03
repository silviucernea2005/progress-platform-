import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'report-photos' // the existing public bucket; project photos live under projects/<project id>/...

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get('pp_session')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload as any
  } catch {
    return null
  }
}

const isAdmin = (user: any) => user?.role === 'admin'
const todayIso = () => new Date().toISOString().slice(0, 10)
const saneDate = (d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000 && Number(d.slice(0, 4)) <= 2100 && !isNaN(new Date(d).getTime())
const cleanName = (n: any) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, 80) : '')

// Viewing needs a login; adding, moving and deleting is admin-only.
// List a project's photos (the page groups them into folders by folder_date + folder_name).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Please log in to see project photos.' }, { status: 401 })
  const { data, error } = await supabase
    .from('project_photos')
    .select('id, folder_date, folder_name, url, created_at')
    .eq('project_id', params.id)
    .order('folder_date', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

// Add ONE photo (a base64 image data URL) to a folder. The page sends photos one at a time,
// like report photos do, to stay well under the request-size limit.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Only an admin can add project photos.' }, { status: 403 })
  try {
    const body = await req.json()
    const folderDate = body.folder_date ? body.folder_date : todayIso()
    if (!saneDate(folderDate)) return NextResponse.json({ error: 'Invalid folder date (use a year between 2000 and 2100).' }, { status: 400 })
    const match = typeof body.photo === 'string' ? body.photo.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/) : null
    if (!match) return NextResponse.json({ error: 'Unsupported image. Use JPG, PNG, WebP or GIF.' }, { status: 400 })
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length > 4 * 1024 * 1024) return NextResponse.json({ error: 'Image is too large (max 4 MB after compression).' }, { status: 413 })

    const { data: project } = await supabase.from('projects').select('id').eq('id', params.id).maybeSingle()
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
    const path = `projects/${params.id}/${folderDate}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}`, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { data, error } = await supabase.from('project_photos')
      .insert({ project_id: params.id, folder_date: folderDate, folder_name: cleanName(body.folder_name), storage_path: path, url: pub.publicUrl, created_by: user.sub })
      .select('id, folder_date, folder_name, url, created_at').single()
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]) // don't leave an orphan file behind
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Move photos to another folder / rename or re-date a folder: send the ids of the photos to change.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Only an admin can change project photos.' }, { status: 403 })
  try {
    const body = await req.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string') : []
    if (!ids.length) return NextResponse.json({ error: 'No photos selected' }, { status: 400 })
    const update: Record<string, any> = {}
    if (body.folder_date !== undefined) {
      if (!saneDate(body.folder_date)) return NextResponse.json({ error: 'Invalid folder date (use a year between 2000 and 2100).' }, { status: 400 })
      update.folder_date = body.folder_date
    }
    if (body.folder_name !== undefined) update.folder_name = cleanName(body.folder_name)
    if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    const { error } = await supabase.from('project_photos').update(update).eq('project_id', params.id).in('id', ids)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Delete photos (one, several, or a whole folder): their files are removed from Storage too.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Only an admin can delete project photos.' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({} as any))
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string') : []
    if (!ids.length) return NextResponse.json({ error: 'No photos selected' }, { status: 400 })
    const { data: rows } = await supabase.from('project_photos').select('id, storage_path').eq('project_id', params.id).in('id', ids)
    const paths = (rows || []).map((r: any) => r.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    const { error } = await supabase.from('project_photos').delete().eq('project_id', params.id).in('id', ids)
    if (error) throw error
    try {
      await supabase.from('activity_log').insert({ user_id: user.sub, user_name: user.name, action: 'project_photos_deleted', details: `${user.name} deleted ${(rows || []).length} project photo(s)`, project_id: params.id })
    } catch {}
    return NextResponse.json({ ok: true, deleted: (rows || []).length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

