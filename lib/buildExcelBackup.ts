import ExcelJS from 'exceljs'
import { ChartSpec, ref } from './excelCharts'

// Builds a standalone Excel version of the platform: one sheet per project with the
// weekly progress laid out as a table and the same calculations the platform does
// (weighted progress, weekly gain, contract plan line, trend, delay status) written as
// LIVE Excel formulas — so the workbook keeps working with no platform behind it.

export type BackupInput = {
  projects: { id: string; name: string; location?: string; client?: string; settings?: { responsible?: string | null; weights?: Record<string, number>; dates?: Record<string, string>; activity_overrides?: Record<string, { name?: string; excluded?: boolean }> } | null }[]
  activities: { id: number; name: string; default_weight: number; sort_order?: number; project_id: string | null }[]
  reports: { id: string; project_id: string; period_start: string; period_end: string; works_done?: string; works_planned?: string; red_flags?: string; responsible?: string | null; activities?: { activity_id: number; progress: number }[] }[]
}

const DATE_KEYS: [string, string][] = [
  ['tenderStart', 'Tender start'], ['tenderOffersReceived', 'Tender offers received'], ['tenderOffersReview', 'Tender offers review'], ['tenderFinish', 'Tender finish'],
  ['contractingStart', 'Contracting start'], ['contractingReviewLegal', 'Contracting legal review'], ['contractingFinish', 'Contracting finish'],
  ['constructionProceedNotice', 'Notice to proceed'], ['constructionStart', 'Construction start'], ['constructionFinishEstimated', 'Construction finish (est.)'],
  ['contractStart', 'Contract start'], ['contractFinish', 'Contract finish'],
]
const CONTRACT_START_IDX = 10
const CONTRACT_FINISH_IDX = 11

const NAVY = 'FF22304A'
const FIRST_ROW = 7      // first data row on a project sheet
const LAST_ROW = 300     // formulas are pre-filled down to here so new weeks can simply be typed in

const toDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10) + 'T00:00:00Z') : null)
const saneDate = (s?: string | null) => { const y = Number((s || '').slice(0, 4)); return !!s && /^\d{4}-\d{2}-\d{2}/.test(s) && y >= 2000 && y <= 2100 }
const colLetter = (n: number) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }
const q = (name: string) => `'${name.replace(/'/g, "''")}'`

function header(cell: ExcelJS.Cell, wrap = true) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: wrap }
}

export function buildExcelBackup(input: BackupInput) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Progress Platform'
  wb.created = new Date()
  wb.calcProperties.fullCalcOnLoad = true // make Excel calculate every formula when the file opens

  const projects = [...input.projects].sort((a, b) => a.name.localeCompare(b.name))
  const skipped: string[] = []
  const charts: ChartSpec[] = []
  let chartedProjects = 0

  // ---------- unique, Excel-safe sheet names ----------
  const used = new Set<string>(['README', 'Dashboard', 'Charts', 'Projects'])
  const sheetNames = new Map<string, string>()
  for (const p of projects) {
    let base = p.name.replace(/[\[\]:*?\/\\]/g, '-').trim().slice(0, 28) || 'Project'
    let name = base, n = 2
    while (used.has(name.toLowerCase()) || used.has(name)) name = `${base.slice(0, 26)} ${n++}`
    used.add(name); used.add(name.toLowerCase())
    sheetNames.set(p.id, name)
  }

  const readme = wb.addWorksheet('README', { views: [{ showGridLines: false }] })
  const dash = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] })
  const chartsWs = wb.addWorksheet('Charts', { views: [{ showGridLines: false }] })
  const master = wb.addWorksheet('Projects')

  // ---------- Projects (master data: names, client, responsible, ALL dates) ----------
  const mh = ['Project', 'Location', 'Client', 'Responsible', ...DATE_KEYS.map(d => d[1])]
  mh.forEach((h, i) => { const c = master.getCell(1, i + 1); c.value = h; header(c) })
  master.getRow(1).height = 34
  master.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  master.getColumn(1).width = 26; master.getColumn(2).width = 18; master.getColumn(3).width = 20; master.getColumn(4).width = 20
  for (let i = 0; i < DATE_KEYS.length; i++) master.getColumn(5 + i).width = 15
  const masterRow = new Map<string, number>()
  projects.forEach((p, i) => {
    const r = i + 2
    masterRow.set(p.id, r)
    master.getCell(r, 1).value = p.name
    master.getCell(r, 2).value = p.location || ''
    master.getCell(r, 3).value = p.client || ''
    master.getCell(r, 4).value = p.settings?.responsible || ''
    DATE_KEYS.forEach(([key], k) => {
      const d = toDate(p.settings?.dates?.[key])
      const c = master.getCell(r, 5 + k)
      if (d) { c.value = d; c.numFmt = 'yyyy-mm-dd' }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBE6' } }
    })
  })

  // ---------- one sheet per project ----------
  projects.forEach(p => {
    const sheetName = sheetNames.get(p.id)!
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true, state: 'frozen', xSplit: 2, ySplit: 6 }] })
    const pr = masterRow.get(p.id)!
    const overrides = p.settings?.activity_overrides || {}
    const weights = p.settings?.weights || {}

    // categories that apply to this project (shared defaults + its own), minus the hidden ones,
    // plus anything its reports reference so no recorded progress is ever dropped
    const myReports = input.reports.filter(r => r.project_id === p.id)
    const referenced = new Set<number>()
    myReports.forEach(r => (r.activities || []).forEach(a => referenced.add(a.activity_id)))
    const acts = input.activities
      .filter(a => (a.project_id === null || a.project_id === p.id) && (!overrides[a.id]?.excluded || referenced.has(a.id)))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
      .map(a => ({ id: a.id, name: overrides[a.id]?.name || a.name, weight: weights[a.id] !== undefined ? Number(weights[a.id]) : Number(a.default_weight || 0) }))
    const nAct = acts.length
    const A0 = 3                       // first activity column (C)
    const cW = A0 + nAct               // weighted progress
    const cWeekly = cW + 1, cPlan = cW + 2, cGap = cW + 3, cDone = cW + 4, cNext = cW + 5, cRed = cW + 6, cResp = cW + 7
    const L = (n: number) => colLetter(n)
    const firstAct = L(A0), lastAct = L(Math.max(A0, A0 + nAct - 1))
    const W = L(cW)

    // title + key figures (rows 1-3)
    ws.getCell('A1').value = p.name
    ws.getCell('A1').font = { bold: true, size: 16 }
    const kpis: [string, string, string?][] = [
      ['Client', `=IF(Projects!C${pr}="","",Projects!C${pr})`],
      ['Responsible', `=IF(Projects!D${pr}="","",Projects!D${pr})`],
      ['Contract start', `=IF(Projects!${L(5 + CONTRACT_START_IDX)}${pr}="","",Projects!${L(5 + CONTRACT_START_IDX)}${pr})`, 'yyyy-mm-dd'],
      ['Contract finish', `=IF(Projects!${L(5 + CONTRACT_FINISH_IDX)}${pr}="","",Projects!${L(5 + CONTRACT_FINISH_IDX)}${pr})`, 'yyyy-mm-dd'],
      ['Latest progress %', `=IFERROR(LOOKUP(2,1/ISNUMBER(${W}${FIRST_ROW}:${W}${LAST_ROW}),${W}${FIRST_ROW}:${W}${LAST_ROW}),"")`, '0.00'],
      ['Status', `=IF(E3="","Ongoing",IF(ROUND(E3,1)>=100,"Completed","Ongoing"))`],
      ['Latest report date', `=IFERROR(LOOKUP(2,1/ISNUMBER(${W}${FIRST_ROW}:${W}${LAST_ROW}),B${FIRST_ROW}:B${LAST_ROW}),"")`, 'yyyy-mm-dd'],
      ['Trend (% / week)', `=IFERROR(SLOPE(${W}${FIRST_ROW}:${W}${LAST_ROW},B${FIRST_ROW}:B${LAST_ROW})*7,"")`, '0.00'],
      ['Trend finish', `=IF(OR(E3="",H3="",G3=""),"",IF(E3>=100,G3,IF(H3<=0,"",G3+(100-E3)/(H3/7))))`, 'yyyy-mm-dd'],
      ['Est. at contract finish %', `=IF(OR(E3="",H3="",G3="",D3=""),"",MIN(100,E3+MAX(H3,0)*MAX(0,D3-G3)/7))`, '0.0'],
      ['Contract plan % at latest report', `=IF(OR(G3="",C3="",D3=""),"",IFERROR(MAX(0,MIN(100,(G3-C3)/(D3-C3)*100)),""))`, '0.0'],
      ['Gap vs plan (pp)', `=IF(OR(E3="",K3=""),"",E3-K3)`, '0.0'],
      ['Required % / week to finish on time', `=IF(OR(E3="",G3="",D3=""),"",(100-E3)/MAX((D3-G3)/7,0.01))`, '0.00'],
      ['Delay status', `=IF(L3="","",IF(L3>=0,"🟢 On track",IF(H3="","🔴 Behind",IF(H3>M3,"🟠 Behind, recovering","🔴 Behind, falling further behind"))))`],
    ]
    kpis.forEach(([label, formula, fmt], i) => {
      const lc = ws.getCell(2, i + 1); lc.value = label
      lc.font = { size: 9, color: { argb: 'FF6B7280' }, bold: true }
      lc.alignment = { wrapText: true, vertical: 'bottom' }
      const vc = ws.getCell(3, i + 1); vc.value = { formula: formula.slice(1) } as any
      vc.font = { bold: true, size: 11 }
      vc.alignment = { horizontal: 'left' }
      if (fmt) vc.numFmt = fmt
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    })
    ws.getRow(2).height = 38

    // weights row (inputs) + headers
    ws.getCell(`A5`).value = 'Weight %  (edit here — applies to every week)'
    ws.getCell(`A5`).font = { bold: true, size: 9 }
    ws.mergeCells('A5:B5')
    acts.forEach((a, i) => {
      const c = ws.getCell(5, A0 + i); c.value = a.weight; c.numFmt = '0.##'
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBE6' } }
      c.alignment = { horizontal: 'center' }; c.font = { bold: true }
    })
    if (nAct) {
      const sc = ws.getCell(5, cW); sc.value = { formula: `SUM(${firstAct}5:${lastAct}5)` } as any
      sc.numFmt = '"Total "0.##'; sc.font = { bold: true, size: 9 }; sc.alignment = { horizontal: 'center' }
    }
    const heads = ['Period start', 'Period end', ...acts.map(a => a.name), 'Weighted progress %', 'Weekly progress %', 'Contract plan %', 'Gap vs plan (pp)', 'Works executed', 'Works planned next week', 'Red flags', 'Responsible (override)']
    heads.forEach((h, i) => { const c = ws.getCell(6, i + 1); c.value = h; header(c) })
    ws.getRow(6).height = 44

    // existing reports, oldest first
    const rows = myReports
      .filter(r => { const ok = saneDate(r.period_start) && saneDate(r.period_end); if (!ok) skipped.push(`${p.name}: ${r.period_start} – ${r.period_end}`); return ok })
      .sort((a, b) => a.period_end.localeCompare(b.period_end))

    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      const rep = rows[r - FIRST_ROW]
      const sc = ws.getCell(r, 1), ec = ws.getCell(r, 2)
      sc.numFmt = 'yyyy-mm-dd'; ec.numFmt = 'yyyy-mm-dd'
      if (rep) {
        sc.value = toDate(rep.period_start)!; ec.value = toDate(rep.period_end)!
        const byAct = new Map((rep.activities || []).map(a => [a.activity_id, Number(a.progress)]))
        acts.forEach((a, i) => { const v = byAct.get(a.id); const c = ws.getCell(r, A0 + i); if (v !== undefined) c.value = v; c.numFmt = '0.##'; c.alignment = { horizontal: 'center' } })
        ws.getCell(r, cDone).value = rep.works_done || ''
        ws.getCell(r, cNext).value = rep.works_planned || ''
        ws.getCell(r, cRed).value = rep.red_flags || ''
        ws.getCell(r, cResp).value = rep.responsible || ''
      } else {
        acts.forEach((_, i) => { const c = ws.getCell(r, A0 + i); c.numFmt = '0.##'; c.alignment = { horizontal: 'center' } })
      }
      const wf = nAct ? `IF($B${r}="","",SUMPRODUCT($${firstAct}$5:$${lastAct}$5,${firstAct}${r}:${lastAct}${r})/100)` : `IF($B${r}="","",0)`
      const weeklyF = r === FIRST_ROW ? `IF($B${r}="","",${W}${r})` : `IF($B${r}="","",IF(ISNUMBER(${W}${r - 1}),${W}${r}-${W}${r - 1},${W}${r}))`
      const planF = `IF(OR($B${r}="",$C$3="",$D$3=""),"",IFERROR(MAX(0,MIN(100,($B${r}-$C$3)/($D$3-$C$3)*100)),""))`
      const gapF = `IF(OR(${W}${r}="",${L(cPlan)}${r}=""),"",${W}${r}-${L(cPlan)}${r})`
      ;[[cW, wf, '0.00'], [cWeekly, weeklyF, '0.00'], [cPlan, planF, '0.0'], [cGap, gapF, '+0.0;-0.0;0.0']].forEach(([col, f, fmt]) => {
        const c = ws.getCell(r, col as number); c.value = { formula: f as string } as any; c.numFmt = fmt as string
        c.alignment = { horizontal: 'center' }
        if (col === cW) c.font = { bold: true }
      })
      ;[cDone, cNext, cRed].forEach(col => { ws.getCell(r, col).alignment = { wrapText: true, vertical: 'top' } })
    }

    ws.getColumn(1).width = 13; ws.getColumn(2).width = 13
    for (let i = 0; i < nAct; i++) ws.getColumn(A0 + i).width = 14
    ;[cW, cWeekly, cPlan, cGap].forEach(c => { ws.getColumn(c).width = 14 })
    ws.getColumn(cDone).width = 46; ws.getColumn(cNext).width = 46; ws.getColumn(cRed).width = 36; ws.getColumn(cResp).width = 18
    // columns that carry the key-figure labels must be wide enough for them even on sheets with few categories
    for (let c = 1; c <= kpis.length; c++) if ((ws.getColumn(c).width || 0) < 14) ws.getColumn(c).width = 14

    ws.addConditionalFormatting({ ref: `${L(cGap)}${FIRST_ROW}:${L(cGap)}${LAST_ROW}`, rules: [
      { type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 1, style: { font: { color: { argb: 'FFB91C1C' } } } },
      { type: 'cellIs', operator: 'greaterThan', formulae: ['-0.00001'], priority: 2, style: { font: { color: { argb: 'FF166534' } } } },
    ] })
    ws.addConditionalFormatting({ ref: 'F3', rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"Completed"'], priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } } } },
    ] })

    // ----- chart data: helper columns that feed the charts on the "Charts" sheet -----
    // Empty rows: the VALUE columns give #N/A on purpose (Excel skips #N/A points), while the DATE
    // column just repeats the last date, so the X axis never contains an error. The cells are
    // formatted white-on-white when unused so the sheet stays clean. Do not edit these columns.
    const cData = cResp + 2
    const [Ld, Lc, Lw, Lpx, Lpy, Ltx, Lty] = [0, 1, 2, 3, 4, 5, 6].map(k => L(cData + k))
    ;['Chart data: date', 'Chart data: cumulated %', 'Chart data: weekly %', 'Plan: date', 'Plan: %', 'Trend: date', 'Trend: %'].forEach((h, k) => {
      const c = ws.getCell(6, cData + k); c.value = h
      c.font = { size: 9, color: { argb: 'FF9CA3AF' } }; c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }
      ws.getColumn(cData + k).width = 12
    })
    ws.getCell(5, cData).value = 'Feeds the Charts sheet — formulas, do not edit'
    ws.getCell(5, cData).font = { size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      const d = ws.getCell(r, cData)
      d.value = { formula: r === FIRST_ROW ? `IF($B${r}="",0,$B${r})` : `IF($B${r}="",${Ld}${r - 1},$B${r})` } as any; d.numFmt = 'yyyy-mm-dd'
      ws.getCell(r, cData + 1).value = { formula: `IF($B${r}="",NA(),${W}${r})` } as any
      ws.getCell(r, cData + 2).value = { formula: `IF($B${r}="",NA(),${L(cWeekly)}${r})` } as any
      ;[cData, cData + 1, cData + 2].forEach(col => { ws.getCell(r, col).font = { size: 9, color: { argb: 'FF9CA3AF' } } })
    }
    const noPlan = 'OR($C$3="",$D$3="")', noTrend = 'OR($G$3="",$I$3="",$E$3="")'
    const mini: [number, string, string][] = [
      [cData + 3, `IF(${noPlan},$B$7,$C$3)`, `IF(${noPlan},$B$7,$D$3)`],
      [cData + 4, `IF(${noPlan},NA(),0)`, `IF(${noPlan},NA(),100)`],
      [cData + 5, `IF(${noTrend},$B$7,$G$3)`, `IF(${noTrend},$B$7,$I$3)`],
      [cData + 6, `IF(${noTrend},NA(),$E$3)`, `IF(${noTrend},NA(),100)`],
    ]
    mini.forEach(([col, f1, f2], k) => {
      for (const [row, f] of [[FIRST_ROW, f1], [FIRST_ROW + 1, f2]] as [number, string][]) {
        const c = ws.getCell(row, col); c.value = { formula: f } as any; c.font = { size: 9, color: { argb: 'FF9CA3AF' } }
        if (k === 0 || k === 2) c.numFmt = 'yyyy-mm-dd'
      }
    })
    ws.addConditionalFormatting({ ref: `${Ld}${FIRST_ROW}:${Lty}${LAST_ROW}`, rules: [
      { type: 'expression', formulae: [`OR(ISNA(${Ld}${FIRST_ROW}),$B${FIRST_ROW}="")`], priority: 4, style: { font: { color: { argb: 'FFFFFFFF' } } } },
    ] })

    if (rows.length > 0) {
      const i = chartedProjects++
      const rng = (col: string, r1 = FIRST_ROW, r2 = LAST_ROW) => ref(sheetName, `$${col}$${r1}:$${col}$${r2}`)
      const col0 = (i % 2) * 11, row0 = 25 + Math.floor(i / 2) * 22
      charts.push({
        kind: 'scatter', sheet: 'Charts', title: `Works Progress — ${p.name}`, yMin: 0, yMax: 100, yTitle: '%',
        from: { col: col0, row: row0 }, to: { col: col0 + 10, row: row0 + 21 },
        series: [
          { name: 'Cumulated progress', x: rng(Ld), y: rng(Lc), color: 'D46A28', widthPt: 2.5, marker: true },
          { name: 'Actual (weekly) progress', x: rng(Ld), y: rng(Lw), color: '185FA5', widthPt: 1.5 },
          { name: 'Trend', x: rng(Ltx, FIRST_ROW, FIRST_ROW + 1), y: rng(Lty, FIRST_ROW, FIRST_ROW + 1), color: '059669', widthPt: 2, dash: 'dash' },
          { name: 'Contract plan', x: rng(Lpx, FIRST_ROW, FIRST_ROW + 1), y: rng(Lpy, FIRST_ROW, FIRST_ROW + 1), color: '888780', widthPt: 1.5, dash: 'sysDot' },
        ],
      })
    }
  })

  // ---------- Dashboard (all projects, all formulas pointing at the project sheets) ----------
  dash.getCell('A1').value = 'Progress Platform — Dashboard'
  dash.getCell('A1').font = { bold: true, size: 16 }
  const dh = ['Project', 'Client', 'Responsible', 'Latest progress %', 'Status', 'Delay status', 'Trend finish', 'Contract finish', 'Days remaining', 'Latest report']
  const D_FIRST = 5
  dh.forEach((h, i) => { const c = dash.getCell(4, i + 1); c.value = h; header(c) })
  dash.getRow(4).height = 32
  const lastDashRow = D_FIRST + Math.max(projects.length, 1) - 1
  dash.getCell('A2').value = 'Ongoing'; dash.getCell('B2').value = { formula: `COUNTIF(E${D_FIRST}:E${lastDashRow + 50},"Ongoing")` } as any
  dash.getCell('C2').value = 'Completed'; dash.getCell('D2').value = { formula: `COUNTIF(E${D_FIRST}:E${lastDashRow + 50},"Completed")` } as any
  ;['A2', 'C2'].forEach(a => { dash.getCell(a).font = { bold: true, color: { argb: 'FF6B7280' } } })
  ;['B2', 'D2'].forEach(a => { dash.getCell(a).font = { bold: true, size: 14 }; dash.getCell(a).alignment = { horizontal: 'left' } })
  projects.forEach((p, i) => {
    const r = D_FIRST + i
    const S = q(sheetNames.get(p.id)!)
    const link = dash.getCell(r, 1)
    link.value = { text: p.name, hyperlink: `#${S}!A1` } as any
    link.font = { color: { argb: 'FF185FA5' }, underline: true, bold: true }
    const ref = (cell: string) => ({ formula: `IF(${S}!${cell}="","",${S}!${cell})` } as any)
    dash.getCell(r, 2).value = ref('A3')
    dash.getCell(r, 3).value = ref('B3')
    dash.getCell(r, 4).value = ref('E3'); dash.getCell(r, 4).numFmt = '0.00'
    dash.getCell(r, 5).value = ref('F3')
    dash.getCell(r, 6).value = ref('N3')
    dash.getCell(r, 7).value = ref('I3'); dash.getCell(r, 7).numFmt = 'yyyy-mm-dd'
    dash.getCell(r, 8).value = ref('D3'); dash.getCell(r, 8).numFmt = 'yyyy-mm-dd'
    dash.getCell(r, 9).value = { formula: `IF(${S}!D3="","",${S}!D3-TODAY())` } as any; dash.getCell(r, 9).numFmt = '0'
    dash.getCell(r, 10).value = ref('G3'); dash.getCell(r, 10).numFmt = 'yyyy-mm-dd'
  })
  ;[28, 22, 20, 16, 14, 34, 14, 14, 14, 14].forEach((w, i) => { dash.getColumn(i + 1).width = w })
  dash.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }]
  dash.addConditionalFormatting({ ref: `E${D_FIRST}:E${lastDashRow + 50}`, rules: [
    { type: 'cellIs', operator: 'equal', formulae: ['"Completed"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } } } },
  ] })

  // ---------- Charts sheet ----------
  chartsWs.getCell('A1').value = 'Charts'
  chartsWs.getCell('A1').font = { bold: true, size: 16 }
  chartsWs.getCell('A2').value = 'These are real Excel charts. They update by themselves when you add a week to a project sheet (they read the grey "chart data" columns on the far right of each project sheet — leave those alone).'
  chartsWs.getCell('A2').font = { size: 10, color: { argb: 'FF6B7280' } }
  if (projects.length > 0) {
    const lastD = D_FIRST + projects.length - 1
    charts.unshift({
      kind: 'column', sheet: 'Charts', title: 'Latest progress by project (%)', seriesName: 'Latest progress %', color: 'D46A28', yMin: 0, yMax: 100,
      categories: ref('Dashboard', `$A$${D_FIRST}:$A$${lastD}`), values: ref('Dashboard', `$D$${D_FIRST}:$D$${lastD}`),
      from: { col: 0, row: 3 }, to: { col: 11, row: 23 },
    })
  }

  // ---------- README ----------
  const lines: [string, boolean][] = [
    ['Progress Platform — Excel version', true],
    [`Exported ${new Date().toISOString().slice(0, 10)}. A standalone copy of the platform's data, with the calculations rebuilt as live Excel formulas.`, false],
    ['', false],
    ['What is in this workbook', true],
    ['• Dashboard — every project on one page (progress, status, delay status, trend finish, days remaining). Click a project name to jump to its sheet.', false],
    ['• Projects — project details and ALL project dates (yellow cells = inputs). Contract start/finish here drive the "contract plan" line and the delay status.', false],
    ['• Charts — a bar chart of every project\'s progress, plus one "Works Progress" chart per project (cumulated and weekly progress, trend, contract plan). They are real Excel charts and update on their own.', false],
    ['• One sheet per project — weights row (yellow), one row per weekly report, one column per category, then the calculated columns. The light-grey columns on the far right feed the charts: leave them alone.', false],
    ['', false],
    ['How to keep using it in Excel', true],
    ['• New weekly report: on the project sheet, go to the first empty row, type Period start / Period end, then the progress % (0–100) of each category. All formulas are already filled in down to row 300.', false],
    ['• Change a weight: edit it in the yellow row 5 of the project sheet — every week recalculates, exactly like the platform.', false],
    ['• Rename/add a category: change the header (row 6) or insert a column inside the category block and copy the formulas from a neighbouring column.', false],
    ['• New project: copy an existing project sheet, rename it, add a line on Projects and on Dashboard.', false],
    ['', false],
    ['How the numbers are calculated (same as the platform)', true],
    ['• Weighted progress = sum of (category progress × category weight) / 100.   • Weekly progress = this week minus the previous week.', false],
    ['• Contract plan % = straight line from 0% at Contract start to 100% at Contract finish.   • Gap = weighted progress minus contract plan.', false],
    ['• Trend = straight-line (least squares) fit through all weeks; Trend finish = when that line reaches 100%.', false],
    ['• Delay status: On track if the gap is ≥ 0; otherwise "Behind, recovering" when the trend is faster than the pace needed to finish on time, else "falling further behind".', false],
    ['• Status: Completed when the latest weighted progress rounds to 100.0%, otherwise Ongoing.', false],
    ['', false],
    ['Not included (these need the platform)', true],
    ['• Photos and attachments, user accounts / permissions, the activity log, and the hover/zoom/expand features of the platform\'s chart.', false],
  ]
  if (skipped.length) {
    lines.push(['', false], ['Reports left out because their dates were invalid', true], ...skipped.map(s => [`• ${s}`, false] as [string, boolean]))
  }
  readme.getColumn(1).width = 150
  lines.forEach(([t, bold], i) => {
    const c = readme.getCell(i + 1, 1); c.value = t
    c.font = bold ? { bold: true, size: i === 0 ? 16 : 12 } : { size: 11 }
    c.alignment = { wrapText: true, vertical: 'top' }
  })

  return { wb, skipped, charts }
}

