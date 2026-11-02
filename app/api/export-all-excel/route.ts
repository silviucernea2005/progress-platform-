import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { buildExcelBackup } from '../../../lib/buildExcelBackup'
import { injectCharts } from '../../../lib/excelCharts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('pp_session')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload.role === 'admin' ? payload : null
  } catch {
    return null
  }
}

// Whole-platform export as ONE Excel workbook with live formulas (admin only, since it
// contains every project).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Only an admin can export everything.' }, { status: 403 })
  try {
    const [projectsRes, activitiesRes, reportsRes] = await Promise.all([
      supabase.from('projects').select('id, name, location, client, project_settings(responsible, weights, dates, activity_overrides)').order('name'),
      supabase.from('activities').select('id, name, default_weight, sort_order, project_id'),
      supabase.from('reports')
        .select('id, project_id, period_start, period_end, works_done, works_planned, red_flags, responsible, activities:report_activities(activity_id, progress)')
        .order('period_end', { ascending: true }).range(0, 9999),
    ])
    const err = projectsRes.error || activitiesRes.error || reportsRes.error
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })

    const projects = (projectsRes.data || []).map((p: any) => ({
      ...p,
      settings: Array.isArray(p.project_settings) ? p.project_settings[0] || null : p.project_settings || null,
    }))
    const { wb, charts } = buildExcelBackup({ projects, activities: activitiesRes.data || [], reports: (reportsRes.data || []) as any })
    // ExcelJS can't draw charts, so the native Excel charts are added to the finished file
    const buffer = await injectCharts(await wb.xlsx.writeBuffer() as ArrayBuffer, charts)
    const day = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Progress_Platform_Excel_${day}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

