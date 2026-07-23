import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, ImageRun, VerticalAlign } from 'docx'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DARK = '1A1A2A'
const BLUE = '185FA5'
const ORANGE = 'D46A28'
const GREEN = '059669'

function statusOf(progress: number) {
  if (progress === 0) return { label: 'Not started', bg: 'F5F5F5', color: '9CA3AF' }
  if (progress < 100) return { label: 'In progress', bg: 'DBEAFE', color: '1E40AF' }
  return { label: 'Completed', bg: 'DCFCE7', color: '166534' }
}

function cell(text: string, opts: { bold?: boolean; color?: string; bg?: string; align?: any; size?: number } = {}) {
  return new TableCell({
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size || 20, font: 'Arial' })]
    })]
  })
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  if (!match) return null
  return Buffer.from(match[1], 'base64')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const mainChartImage: string | null = body?.mainChartImage || null
    const miniChartImages: string[] = Array.isArray(body?.miniChartImages) ? body.miniChartImages : []

    const { data: report, error } = await supabase
      .from('reports')
      .select('*, project:projects(id,name,location,client), activities:report_activities(*, activity:activities(*))')
      .eq('id', params.id).single()
    if (error || !report) return NextResponse.json({ error: 'Raport negasit' }, { status: 404 })

    const [{ data: settings }, { data: allReports }, { data: photoRows }] = await Promise.all([
      supabase.from('project_settings').select('weights').eq('project_id', report.project_id).maybeSingle(),
      supabase.from('reports').select('id').eq('project_id', report.project_id),
      supabase.from('report_photos').select('url').eq('report_id', params.id).order('created_at', { ascending: true }),
    ])
    const weights: Record<string, number> = settings?.weights || {}
    const getWeight = (activityId: number, defaultWeight: number) => weights[activityId] !== undefined ? weights[activityId] : defaultWeight

    const acts = (report.activities || []).sort((a: any, b: any) => (a.activity?.sort_order || 0) - (b.activity?.sort_order || 0))
    const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * getWeight(a.activity_id, a.activity?.default_weight || 0) / 100, 0)
    const chartIncluded = (allReports?.length || 0) >= 1
    const scoreColor = chartIncluded ? GREEN : ORANGE

    const activityRows = [
      new TableRow({
        children: [
          cell('Activity', { bold: true, color: 'FFFFFF', bg: DARK }),
          cell('Weight', { bold: true, color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
          cell('Progress', { bold: true, color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
          cell('Contribution', { bold: true, color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
          cell('Status', { bold: true, color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
        ]
      }),
      ...acts.map((a: any) => {
        const w = getWeight(a.activity_id, a.activity?.default_weight || 0)
        const contribution = (a.progress * w / 100).toFixed(2)
        const st = statusOf(a.progress)
        return new TableRow({
          children: [
            cell(a.activity?.name || ''),
            cell(`${w}%`, { align: AlignmentType.CENTER }),
            cell(`${a.progress}%`, { align: AlignmentType.CENTER, bold: true }),
            cell(`${contribution}%`, { align: AlignmentType.CENTER, color: BLUE }),
            cell(st.label, { align: AlignmentType.CENTER, bg: st.bg, color: st.color }),
          ]
        })
      }),
      new TableRow({
        children: [
          cell('TOTAL WEIGHTED PROGRESS', { bold: true, color: 'FFFFFF', bg: DARK }),
          cell('100%', { bold: true, color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
          cell('—', { color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
          cell(`${totalProgress.toFixed(2)}%`, { bold: true, color: 'FFFFFF', bg: DARK, align: AlignmentType.CENTER }),
          cell('', { bg: DARK }),
        ]
      })
    ]

    const activitiesTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: activityRows })

    const notesSection = (title: string, color: string, text: string) => {
      return [
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: title, bold: true, color, size: 22, font: 'Arial' })] }),
        new Paragraph({ children: [new TextRun({ text: text || '—', size: 20, font: 'Arial' })] }),
      ]
    }

    // Fetch and embed real photos (skip text placeholders), 2 per row
    const photoUrls: string[] = (photoRows || []).map((p: any) => p.url).filter((u: string) => u && !u.startsWith('data:text/plain'))
    const imageBuffers: Buffer[] = []
    for (const url of photoUrls.slice(0, 12)) {
      try {
        const res = await fetch(url)
        if (res.ok) imageBuffers.push(Buffer.from(await res.arrayBuffer()))
      } catch {}
    }

    const photoRowsEls: TableRow[] = []
    for (let i = 0; i < imageBuffers.length; i += 2) {
      const pair = imageBuffers.slice(i, i + 2)
      photoRowsEls.push(new TableRow({
        children: pair.map(buf => new TableCell({
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          children: [new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: 260, height: 195 }, type: 'jpg' } as any)] })]
        })).concat(pair.length === 1 ? [new TableCell({ children: [new Paragraph('')] })] : [])
      }))
    }

    const children: any[] = [
      new Paragraph({ children: [new TextRun({ text: 'SQUARE 7 · PART OF M.CORE', bold: true, size: 18, color: '6B7280', font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Progress Report', size: 20, color: '6B7280', font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: report.project?.name || '', bold: true, size: 40, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: `${report.period_start} – ${report.period_end}`, size: 22, color: '6B7280', font: 'Arial' })] }),
      new Paragraph({
        spacing: { before: 100, after: 300 },
        children: [new TextRun({ text: `${totalProgress.toFixed(2)}%`, bold: true, size: 56, color: scoreColor, font: 'Arial' }), new TextRun({ text: '  weighted progress', size: 20, color: '9CA3AF', font: 'Arial' })]
      }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'ACTIVITIES PROGRESS', bold: true, size: 22, font: 'Arial' })] }),
      activitiesTable,
    ]

    // Main "Works Progress" chart, captured client-side (canvas.toDataURL) and sent in the request
    if (mainChartImage) {
      const buf = dataUrlToBuffer(mainChartImage)
      if (buf) {
        children.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: `WORKS PROGRESS · ${report.project?.name || ''}`, bold: true, size: 22, font: 'Arial' })] }))
        children.push(new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: 600, height: 260 }, type: 'png' } as any)] }))
      }
    }

    // Mini charts (Tender/Contracting/Construction Days), same source images as the PDF export
    const miniBuffers = miniChartImages.map(dataUrlToBuffer).filter(Boolean) as Buffer[]
    if (miniBuffers.length) {
      const miniRow = new TableRow({
        children: miniBuffers.map(buf => new TableCell({
          margins: { top: 60, bottom: 60, left: 40, right: 40 },
          children: [new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: 175, height: 105 }, type: 'png' } as any)] })]
        }))
      })
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
        rows: [miniRow]
      }))
    }

    children.push(
      ...notesSection('✓ WORKS COMPLETED', '166534', report.works_done),
      ...notesSection('→ WORKS PLANNED', '1E40AF', report.works_planned),
      ...notesSection('🚩 RED FLAGS', '991B1B', report.red_flags),
    )

    if (photoRowsEls.length) {
      children.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: 'SITE PHOTOS', bold: true, size: 22, font: 'Arial' })] }))
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, rows: photoRowsEls }))
    }

    const doc = new Document({ sections: [{ children }] })

    const buf = await Packer.toBuffer(doc)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Raport_${report.project?.name}_${report.period_start}.docx"`,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

