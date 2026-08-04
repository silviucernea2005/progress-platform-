import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import ExcelJS from 'exceljs'

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

const DARK = 'FF1A1A2A'
const BLUE = 'FF185FA5'
const ORANGE = 'FFD46A28'
const GREEN = 'FF059669'
const WHITE = 'FFFFFFFF'

function statusOf(progress: number) {
  if (progress === 0) return { label: 'Not started', bg: 'FFF5F5F5', color: 'FF9CA3AF' }
  if (progress < 100) return { label: 'In progress', bg: 'FFDBEAFE', color: 'FF1E40AF' }
  return { label: 'Completed', bg: 'FFDCFCE7', color: 'FF166534' }
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return null
  return Buffer.from(match[2], 'base64')
}

function headerCell(cell: ExcelJS.Cell, text: string, align: 'left' | 'center' = 'left') {
  cell.value = text
  cell.font = { bold: true, color: { argb: WHITE }, name: 'Calibri', size: 11 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
  cell.alignment = { horizontal: align, vertical: 'middle' }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const mainChartImage: string | null = body?.mainChartImage || null
    const miniChartImages: string[] = Array.isArray(body?.miniChartImages) ? body.miniChartImages : []

    const { data: report, error } = await supabase
      .from('reports')
      .select('*, project:projects(id,name,location,client), activities:report_activities(*, activity:activities(*))')
      .eq('id', params.id).single()
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const [{ data: settings }, { data: allReports }, { data: photoRows }] = await Promise.all([
      supabase.from('project_settings').select('weights, responsible').eq('project_id', report.project_id).maybeSingle(),
      supabase.from('reports').select('id').eq('project_id', report.project_id),
      supabase.from('report_photos').select('url').eq('report_id', params.id).order('created_at', { ascending: true }),
    ])
    const weights: Record<string, number> = settings?.weights || {}
    const getWeight = (activityId: number, defaultWeight: number) => weights[activityId] !== undefined ? weights[activityId] : defaultWeight
    const responsible: string = report.responsible || settings?.responsible || ''

    const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order || 0) - (b.activity?.sort_order || 0))
    const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * getWeight(a.activity_id, a.activity?.default_weight || 0) / 100, 0)
    const chartIncluded = (allReports?.length || 0) >= 1
    const scoreColor = chartIncluded ? GREEN : ORANGE

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Progress Platform'
    wb.created = new Date()

    // ============ SHEET 1: REPORT ============
    const sheet = wb.addWorksheet('Report', { views: [{ showGridLines: false }] })
    sheet.columns = [{ width: 24 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 16 }]

    let r = 1
    sheet.mergeCells(`A${r}:E${r}`)
    sheet.getCell(`A${r}`).value = 'M°CORE · SQUARE 7'
    sheet.getCell(`A${r}`).font = { bold: true, size: 10, color: { argb: 'FF6B7280' }, name: 'Calibri' }
    r++
    sheet.mergeCells(`A${r}:E${r}`)
    sheet.getCell(`A${r}`).value = report.project?.name || ''
    sheet.getCell(`A${r}`).font = { bold: true, size: 20, name: 'Calibri' }
    r++
    sheet.mergeCells(`A${r}:E${r}`)
    sheet.getCell(`A${r}`).value = `${report.period_start} – ${report.period_end}`
    sheet.getCell(`A${r}`).font = { size: 11, color: { argb: 'FF6B7280' }, name: 'Calibri' }
    r += 2

    sheet.mergeCells(`A${r}:B${r}`)
    sheet.getCell(`A${r}`).value = `${totalProgress.toFixed(2)}%`
    sheet.getCell(`A${r}`).font = { bold: true, size: 26, color: { argb: scoreColor }, name: 'Calibri' }
    sheet.getCell(`C${r}`).value = 'weighted progress'
    sheet.getCell(`C${r}`).font = { size: 10, color: { argb: 'FF9CA3AF' }, name: 'Calibri' }
    sheet.getCell(`C${r}`).alignment = { vertical: 'bottom' }
    r++
    if (responsible) {
      sheet.getCell(`A${r}`).value = `Responsible: ${responsible}`
      sheet.getCell(`A${r}`).font = { size: 10, color: { argb: 'FF9CA3AF' }, name: 'Calibri' }
      r++
    }
    r += 1

    sheet.mergeCells(`A${r}:E${r}`)
    sheet.getCell(`A${r}`).value = 'ACTIVITIES PROGRESS'
    sheet.getCell(`A${r}`).font = { bold: true, size: 13, name: 'Calibri' }
    r++

    ;['Activity', 'Weight', 'Progress', 'Contribution', 'Status'].forEach((h, i) => {
      headerCell(sheet.getCell(r, i + 1), h, i === 0 ? 'left' : 'center')
    })
    sheet.getRow(r).height = 20
    r++

    for (const a of acts) {
      const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
      const contribution = (a.progress * w / 100)
      const st = statusOf(a.progress)
      sheet.getCell(r, 1).value = a.activity?.name || ''
      sheet.getCell(r, 2).value = w / 100
      sheet.getCell(r, 2).numFmt = '0%'
      sheet.getCell(r, 3).value = a.progress / 100
      sheet.getCell(r, 3).numFmt = '0%'
      sheet.getCell(r, 3).font = { bold: true }
      sheet.getCell(r, 4).value = contribution / 100
      sheet.getCell(r, 4).numFmt = '0.00%'
      sheet.getCell(r, 4).font = { color: { argb: BLUE } }
      sheet.getCell(r, 5).value = st.label
      sheet.getCell(r, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.bg } }
      sheet.getCell(r, 5).font = { color: { argb: st.color } }
      for (let c = 2; c <= 5; c++) sheet.getCell(r, c).alignment = { horizontal: 'center', vertical: 'middle' }
      r++
    }
    // TOTAL row
    sheet.getCell(r, 1).value = 'TOTAL WEIGHTED PROGRESS'
    sheet.getCell(r, 2).value = 1
    sheet.getCell(r, 2).numFmt = '0%'
    sheet.getCell(r, 3).value = ''
    sheet.getCell(r, 4).value = totalProgress / 100
    sheet.getCell(r, 4).numFmt = '0.00%'
    sheet.getCell(r, 5).value = ''
    for (let c = 1; c <= 5; c++) {
      sheet.getCell(r, c).font = { bold: true, color: { argb: WHITE } }
      sheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
      if (c > 1) sheet.getCell(r, c).alignment = { horizontal: 'center', vertical: 'middle' }
    }
    r += 2

    // Main "Works Progress" chart — captured client-side (canvas.toDataURL) and sent in the request
    if (mainChartImage) {
      sheet.mergeCells(`A${r}:E${r}`)
      sheet.getCell(`A${r}`).value = `WORKS PROGRESS · ${report.project?.name || ''}`
      sheet.getCell(`A${r}`).font = { bold: true, size: 13, name: 'Calibri' }
      r++
      const buf = dataUrlToBuffer(mainChartImage)
      if (buf) {
        const imgId = wb.addImage({ buffer: buf as any, extension: 'png' })
        sheet.addImage(imgId, { tl: { col: 0, row: r - 1 }, ext: { width: 760, height: 320 } })
        r += Math.ceil(320 / 20) + 1
      }
    }

    // Mini charts (Tender/Contracting/Construction Days) — same source images as the PDF/Word export
    const miniBuffers = miniChartImages.map(dataUrlToBuffer).filter(Boolean) as Buffer[]
    if (miniBuffers.length) {
      const startRow = r
      miniBuffers.forEach((buf, i) => {
        const imgId = wb.addImage({ buffer: buf as any, extension: 'png' })
        sheet.addImage(imgId, { tl: { col: i * 2, row: startRow - 1 }, ext: { width: 210, height: 130 } })
      })
      r += Math.ceil(130 / 20) + 1
    }
    r += 1

    const notesSection = (title: string, color: string, text: string) => {
      sheet.mergeCells(`A${r}:E${r}`)
      sheet.getCell(`A${r}`).value = title
      sheet.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: color }, name: 'Calibri' }
      r++
      const lines = (text || '').split('\n').map((s: string) => s.trim()).filter(Boolean)
      if (lines.length) {
        for (const line of lines) {
          sheet.mergeCells(`B${r}:E${r}`)
          sheet.getCell(`B${r}`).value = `•  ${line}`
          sheet.getCell(`B${r}`).font = { size: 11, name: 'Calibri' }
          r++
        }
      } else {
        sheet.getCell(`B${r}`).value = '—'
        sheet.getCell(`B${r}`).font = { size: 11, color: { argb: 'FF9CA3AF' }, name: 'Calibri' }
        r++
      }
      r++
    }
    notesSection('✓ WORKS COMPLETED', 'FF166534', report.works_done)
    notesSection('→ WORKS PLANNED', 'FF1E40AF', report.works_planned)
    notesSection('🚩 RED FLAGS', 'FF991B1B', report.red_flags)

    // ============ SHEET 2: PHOTOS ============
    const photoUrls: string[] = (photoRows || []).map((p: any) => p.url).filter((u: string) => u && !u.startsWith('data:text/plain'))
    if (photoUrls.length) {
      const photoSheet = wb.addWorksheet('Photos', { views: [{ showGridLines: false }] })
      photoSheet.columns = [{ width: 38 }, { width: 38 }]
      let pr = 1
      let col = 0
      for (const url of photoUrls.slice(0, 20)) {
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const buf = Buffer.from(await res.arrayBuffer())
          const ext = url.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
          const imgId = wb.addImage({ buffer: buf as any, extension: ext as any })
          photoSheet.addImage(imgId, { tl: { col, row: pr - 1 }, ext: { width: 260, height: 195 } })
          if (col === 0) { col = 2 } else { col = 0; pr += 11 }
        } catch {}
      }
    }

    const arrayBuffer = await wb.xlsx.writeBuffer()
    return new NextResponse(new Uint8Array(arrayBuffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Raport_${report.project?.name}_${report.period_start}.xlsx"`,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

