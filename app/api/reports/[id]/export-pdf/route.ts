import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .select('*, project:projects(id,name,location,client), activities:report_activities(*, activity:activities(*)), payments:report_payments(*)')
      .eq('id', params.id).single()
    if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const acts = (report.activities || []).sort((a: any, b: any) => a.activity.sort_order - b.activity.sort_order)
    const totalProgress = acts.reduce((s: number, a: any) => s + a.progress * a.activity.default_weight / 100, 0)

    const actRows = acts.map((a: any) => `
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:8px 12px;font-size:13px">${a.activity.name}</td>
        <td style="padding:8px 12px;text-align:center;font-size:13px">${a.activity.default_weight}%</td>
        <td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:600">${a.progress}%</td>
        <td style="padding:8px 12px;text-align:center;font-size:13px;color:#185FA5">${(a.progress * a.activity.default_weight / 100).toFixed(2)}%</td>
        <td style="padding:8px 12px;text-align:center">
          <div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden">
            <div style="height:100%;background:${a.progress===100?'#1A1A2A':'#D46A28'};width:${a.progress}%;border-radius:4px"></div>
          </div>
        </td>
        <td style="padding:8px 12px;text-align:center;font-size:11px;padding:3px 8px;border-radius:99px;background:${a.progress===0?'#f5f5f5':a.progress<100?'#fef3c7':'#ecfdf5'};color:${a.progress===0?'#9ca3af':a.progress<100?'#92400e':'#065f46'}">${a.progress===0?'Not started':a.progress<100?'In progress':'Completed'}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Progress Report - ${report.project?.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1A1A2A; background: #fff; }
  .header { background: #1A1A2A; color: white; padding: 24px 32px; display:flex; justify-content:space-between; align-items:center; }
  .logo { font-size: 22px; font-weight: 900; background: #185FA5; padding: 6px 14px; border-radius: 8px; }
  .logo-sub { font-size: 10px; color: rgba(255,255,255,0.5); letter-spacing: 2px; margin-top: 2px; }
  .score-box { background: #2C2C3E; border-radius: 12px; padding: 20px 28px; margin: 24px; display:flex; justify-content:space-between; align-items:center; color:white; }
  .score-num { font-size: 48px; font-weight: 800; color: #D46A28; }
  .progress-bar { height: 8px; background: rgba(255,255,255,0.15); border-radius: 99px; margin-top: 12px; overflow:hidden; }
  .progress-fill { height: 100%; background: #D46A28; border-radius: 99px; }
  .section { margin: 0 24px 20px; }
  .section h2 { font-size: 14px; font-weight: 700; color: #1A1A2A; border-bottom: 2px solid #185FA5; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1A1A2A; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
  .text-box { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .text-card { background: #f9fafb; border-radius: 8px; padding: 14px; }
  .text-card h3 { font-size: 12px; font-weight: 700; margin-bottom: 8px; }
  .text-card p { font-size: 12px; color: #374151; line-height: 1.6; white-space: pre-wrap; }
  .footer { background: #f5f5f3; padding: 12px 32px; font-size: 10px; color: #9ca3af; margin-top: 24px; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div style="display:flex;align-items:center;gap:12px">
      <div class="logo">S7</div>
      <div>
        <div style="font-weight:700;font-size:14px">Square 7</div>
        <div class="logo-sub">PART OF M.CORE</div>
      </div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:13px;opacity:0.7">Progress Report</div>
    <div style="font-size:11px;opacity:0.5">${report.period_start} – ${report.period_end}</div>
  </div>
</div>

<div class="score-box">
  <div>
    <div style="font-size:18px;font-weight:700">${report.project?.name}</div>
    <div style="font-size:12px;opacity:0.6;margin-top:4px">${report.project?.location || ''} · ${report.project?.client || ''}</div>
    <div style="font-size:12px;opacity:0.5;margin-top:2px">Period: ${report.period_start} – ${report.period_end}</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(totalProgress,100)}%"></div></div>
  </div>
  <div style="text-align:right">
    <div class="score-num">${totalProgress.toFixed(2)}%</div>
    <div style="font-size:11px;opacity:0.5">weighted progress</div>
  </div>
</div>

<div class="section">
  <h2>Activities Progress</h2>
  <table>
    <thead>
      <tr>
        <th>Activity</th>
        <th style="text-align:center">Weight</th>
        <th style="text-align:center">Progress</th>
        <th style="text-align:center">Contribution</th>
        <th>Progress Bar</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${actRows}</tbody>
    <tr style="background:#1A1A2A;color:white">
      <td style="padding:10px 12px;font-weight:700">TOTAL WEIGHTED PROGRESS</td>
      <td style="padding:10px 12px;text-align:center">100%</td>
      <td style="padding:10px 12px;text-align:center">—</td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:#D46A28">${totalProgress.toFixed(2)}%</td>
      <td colspan="2"></td>
    </tr>
  </table>
</div>

<div class="section">
  <h2>Works & Notes</h2>
  <div class="text-box">
    <div class="text-card">
      <h3 style="color:#065f46">✓ Works Completed</h3>
      <p>${report.works_done || '—'}</p>
    </div>
    <div class="text-card">
      <h3 style="color:#0C447C">→ Works Planned</h3>
      <p>${report.works_planned || '—'}</p>
    </div>
    <div class="text-card">
      <h3 style="color:#7f1d1d">🚩 Red Flags</h3>
      <p>${report.red_flags || '—'}</p>
    </div>
  </div>
</div>

<div class="footer">
  Square 7 · Part of M.Core · Progress Platform · Generated ${new Date().toLocaleDateString('en-GB')}
</div>

<script>window.onload = () => window.print()</script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
