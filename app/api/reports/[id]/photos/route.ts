import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// List all photos/attachments for a report
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('report_photos')
    .select('id, url, created_at')
    .eq('report_id', params.id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

// Upload one or more photos (base64 data URLs) — images go to Storage, non-image
// placeholders (e.g. old .xls/.doc filenames) are stored as-is in the url column.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { photos } = await req.json()
    if (!Array.isArray(photos) || !photos.length) return NextResponse.json({ error: 'No photos provided' }, { status: 400 })

    const inserted = []
    for (const dataUrl of photos) {
      if (typeof dataUrl !== 'string') continue

      if (dataUrl.startsWith('data:text/plain')) {
        const { data, error } = await supabase.from('report_photos')
          .insert({ report_id: params.id, storage_path: '', url: dataUrl })
          .select().single()
        if (!error) inserted.push(data)
        continue
      }

      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!match) continue
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
      const buffer = Buffer.from(match[2], 'base64')
      const path = `${params.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(path, buffer, { contentType: `image/${match[1]}`, upsert: false })
      if (uploadError) { console.error(uploadError); continue }

      const { data: pub } = supabase.storage.from('report-photos').getPublicUrl(path)
      const { data, error } = await supabase.from('report_photos')
        .insert({ report_id: params.id, storage_path: path, url: pub.publicUrl })
        .select().single()
      if (!error) inserted.push(data)
    }
    return NextResponse.json(inserted)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Reorder photos — { order: [photoId, ...] } in the desired display order.
// No dedicated sort column exists, so we re-stamp created_at spaced 1s apart in the new order (GET already sorts by created_at asc).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { order } = await req.json()
    if (!Array.isArray(order) || !order.length) return NextResponse.json({ error: 'order must be a non-empty array' }, { status: 400 })
    const base = Date.now()
    for (let i = 0; i < order.length; i++) {
      const ts = new Date(base + i * 1000).toISOString()
      const { error } = await supabase.from('report_photos').update({ created_at: ts }).eq('id', order[i]).eq('report_id', params.id)
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Delete a single photo ({ photoId }) or all photos for this report ({ all: true })
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({} as any))

    if (body.photoId) {
      const { data: row } = await supabase.from('report_photos').select('storage_path').eq('id', body.photoId).single()
      if (row?.storage_path) await supabase.storage.from('report-photos').remove([row.storage_path])
      await supabase.from('report_photos').delete().eq('id', body.photoId)
      return NextResponse.json({ ok: true })
    }

    const { data: rows } = await supabase.from('report_photos').select('storage_path').eq('report_id', params.id)
    const paths = (rows || []).map((r: any) => r.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('report-photos').remove(paths)
    await supabase.from('report_photos').delete().eq('report_id', params.id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
