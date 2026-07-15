import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun } from 'docx'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .select('*, project:projects(id,name,location,client), activities:report_activities(*, activity:activities(*))')
      .eq('id', params.id).single()
    if (error || !report) return NextResponse.json({ error: 'Raport negasit' }, { status: 404 })

    const acts = (report.activities || []).sort((a: any, b: any) => a.activity.sort_order - b.activity.sort_order)
    const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * a.activity.default_weight / 100, 0)

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: 'RAPORT DE PROGRES LUCRARI', font: 'Arial', size: 32, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: report.project?.name || '', font: 'Arial', size: 26, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Perioada: ${report.period_start} - ${report.period_end}`, font: 'Arial', size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: `Progres general: ${totalProgress.toFixed(2)}%`, font: 'Arial', size: 22, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: ' ', font: 'Arial', size: 22 })] }),
          ...acts.map((a: any) => new Paragraph({ children: [new TextRun({ text: `${a.activity.name} (${a.activity.default_weight}%): ${a.progress}%`, font: 'Arial', size: 20 })] })),
          new Paragraph({ children: [new TextRun({ text: ' ', font: 'Arial', size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: 'Lucrari desfasurate:', font: 'Arial', size: 22, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: report.works_done || '-', font: 'Arial', size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: 'Lucrari planificate:', font: 'Arial', size: 22, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: report.works_planned || '-', font: 'Arial', size: 20 })] }),
        ]
      }]
    })

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
