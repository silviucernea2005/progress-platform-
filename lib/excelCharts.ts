import JSZip from 'jszip'

// ExcelJS cannot create charts, so this adds real, native Excel charts to a finished .xlsx
// by writing the chart / drawing parts into the zip package and linking them to a sheet.
// The XML mirrors what XlsxWriter produces (a library whose charts open cleanly in Excel).
// The charts point at cell ranges, so they update by themselves when the data changes.

export type Anchor = { col: number; row: number }   // zero-based cell position

export type ScatterSeries = {
  name: string
  x: string            // range, already sheet-qualified, e.g. 'Sheet 1'!$AF$7:$AF$300
  y: string
  color: string        // 'D46A28'
  widthPt?: number
  dash?: 'solid' | 'sysDot' | 'dash'
  marker?: boolean
}

export type ChartSpec =
  | { kind: 'scatter'; sheet: string; title: string; from: Anchor; to: Anchor; series: ScatterSeries[]; yMin?: number; yMax?: number; yTitle?: string; xFormat?: string }
  | { kind: 'column'; sheet: string; title: string; from: Anchor; to: Anchor; seriesName: string; categories: string; values: string; color: string; yMin?: number; yMax?: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 'Sheet name' -> a sheet-qualified absolute reference like 'Sheet name'!$A$1:$A$5 */
export function ref(sheet: string, a1: string) {
  return `'${sheet.replace(/'/g, "''")}'!${a1}`
}

const NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

const titleXml = (text: string, rotated = false) =>
  `<c:title><c:tx><c:rich><a:bodyPr${rotated ? ' rot="-5400000" vert="horz"' : ''}/><a:lstStyle/><a:p><a:pPr><a:defRPr/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/></c:title>`

const tail = `<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>`

function scatterXml(spec: Extract<ChartSpec, { kind: 'scatter' }>, n: number) {
  const ax1 = 60000000 + n * 10 + 1, ax2 = 60000000 + n * 10 + 2
  const sers = spec.series.map((s, i) => {
    const w = Math.round((s.widthPt ?? 1.5) * 12700)
    const dash = s.dash && s.dash !== 'solid' ? `<a:prstDash val="${s.dash}"/>` : ''
    const marker = s.marker
      ? `<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></a:ln></c:spPr></c:marker>`
      : `<c:marker><c:symbol val="none"/></c:marker>`
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>`
      + `<c:spPr><a:ln w="${w}"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill>${dash}</a:ln></c:spPr>${marker}`
      + `<c:xVal><c:numRef><c:f>${esc(s.x)}</c:f></c:numRef></c:xVal><c:yVal><c:numRef><c:f>${esc(s.y)}</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>`
  }).join('')
  const scaling = `<c:scaling><c:orientation val="minMax"/>${spec.yMax !== undefined ? `<c:max val="${spec.yMax}"/>` : ''}${spec.yMin !== undefined ? `<c:min val="${spec.yMin}"/>` : ''}</c:scaling>`
  const angled = `<c:txPr><a:bodyPr rot="-2700000" vert="horz"/><a:lstStyle/><a:p><a:pPr><a:defRPr/></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace ${NS}><c:lang val="en-US"/><c:chart>${titleXml(spec.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>`
    + `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${sers}<c:axId val="${ax1}"/><c:axId val="${ax2}"/></c:scatterChart>`
    + `<c:valAx><c:axId val="${ax1}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="${esc(spec.xFormat || 'yyyy-mm-dd')}" sourceLinked="0"/><c:tickLblPos val="nextTo"/>${angled}<c:crossAx val="${ax2}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`
    + `<c:valAx><c:axId val="${ax2}"/>${scaling}<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>${spec.yTitle ? titleXml(spec.yTitle, true) : ''}<c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${ax1}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`
    + `</c:plotArea><c:legend><c:legendPos val="b"/><c:layout/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>${tail}</c:chartSpace>`
}

function columnXml(spec: Extract<ChartSpec, { kind: 'column' }>, n: number) {
  const ax1 = 60000000 + n * 10 + 1, ax2 = 60000000 + n * 10 + 2
  const scaling = `<c:scaling><c:orientation val="minMax"/>${spec.yMax !== undefined ? `<c:max val="${spec.yMax}"/>` : ''}${spec.yMin !== undefined ? `<c:min val="${spec.yMin}"/>` : ''}</c:scaling>`
  const labels = `<c:dLbls><c:numFmt formatCode="0.0" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace ${NS}><c:lang val="en-US"/><c:chart>${titleXml(spec.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>`
    + `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>`
    + `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${esc(spec.seriesName)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${spec.color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${labels}`
    + `<c:cat><c:strRef><c:f>${esc(spec.categories)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(spec.values)}</c:f></c:numRef></c:val></c:ser>`
    + `<c:gapWidth val="60"/><c:axId val="${ax1}"/><c:axId val="${ax2}"/></c:barChart>`
    + `<c:catAx><c:axId val="${ax1}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${ax2}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`
    + `<c:valAx><c:axId val="${ax2}"/>${scaling}<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${ax1}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
    + `</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>${tail}</c:chartSpace>`
}

const anchorXml = (spec: ChartSpec, rid: string, id: number) =>
  `<xdr:twoCellAnchor><xdr:from><xdr:col>${spec.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
  + `<xdr:to><xdr:col>${spec.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
  + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Chart ${id - 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
  + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`

export async function injectCharts(input: ArrayBuffer | Uint8Array | Buffer, specs: ChartSpec[]): Promise<Buffer> {
  if (!specs.length) return Buffer.from(input as any)
  const zip = await JSZip.loadAsync(input as any)
  const read = async (p: string) => { const f = zip.file(p); return f ? await f.async('string') : null }

  // sheet name -> worksheet part path
  const wbXml = (await read('xl/workbook.xml'))!
  const wbRels = (await read('xl/_rels/workbook.xml.rels'))!
  const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const relTarget = new Map<string, string>()
  for (const m of Array.from(wbRels.matchAll(/<Relationship\b[^>]*>/g))) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1], target = /\bTarget="([^"]+)"/.exec(m[0])?.[1]
    if (id && target) relTarget.set(id, target.replace(/^\/?(xl\/)?/, ''))
  }
  const sheetPath = new Map<string, string>()
  for (const m of Array.from(wbXml.matchAll(/<sheet\b[^>]*>/g))) {
    const name = /\bname="([^"]*)"/.exec(m[0])?.[1], rid = /\br:id="([^"]+)"/.exec(m[0])?.[1]
    if (name && rid && relTarget.has(rid)) sheetPath.set(unesc(name), 'xl/' + relTarget.get(rid)!)
  }

  const bySheet = new Map<string, ChartSpec[]>()
  specs.forEach(s => bySheet.set(s.sheet, [...(bySheet.get(s.sheet) || []), s]))

  let contentTypes = (await read('[Content_Types].xml'))!
  const addOverride = (part: string, type: string) => {
    if (!contentTypes.includes(`PartName="${part}"`)) contentTypes = contentTypes.replace('</Types>', `<Override PartName="${part}" ContentType="${type}"/></Types>`)
  }

  let chartNo = 0, drawingNo = 0
  for (const [sheet, list] of Array.from(bySheet.entries())) {
    const path = sheetPath.get(sheet)
    if (!path) throw new Error(`injectCharts: sheet "${sheet}" not found`)
    let sheetXml = (await read(path))!
    if (/<drawing\b/.test(sheetXml)) throw new Error(`injectCharts: sheet "${sheet}" already has a drawing`)
    drawingNo++
    const drawingPath = `xl/drawings/drawing${drawingNo}.xml`

    let anchors = '', drawingRels = ''
    list.forEach((spec, i) => {
      chartNo++
      const chartPath = `xl/charts/chart${chartNo}.xml`
      zip.file(chartPath, spec.kind === 'scatter' ? scatterXml(spec, chartNo) : columnXml(spec, chartNo))
      addOverride(`/${chartPath}`, 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml')
      drawingRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNo}.xml"/>`
      anchors += anchorXml(spec, `rId${i + 1}`, i + 2)
    })
    zip.file(drawingPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`)
    zip.file(`xl/drawings/_rels/drawing${drawingNo}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRels}</Relationships>`)
    addOverride(`/${drawingPath}`, 'application/vnd.openxmlformats-officedocument.drawing+xml')

    // link the drawing from the sheet: add to (or create) the sheet's relationships part
    const relsPath = path.replace('worksheets/', 'worksheets/_rels/') + '.rels'
    let rels = await read(relsPath)
    if (!rels) rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    const used = Array.from(rels.matchAll(/\bId="rId(\d+)"/g)).map(m => Number(m[1]))
    const newId = `rId${(used.length ? Math.max(...used) : 0) + 1}`
    rels = rels.replace('</Relationships>', `<Relationship Id="${newId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingNo}.xml"/></Relationships>`)
    zip.file(relsPath, rels)

    if (!/<worksheet\b[^>]*xmlns:r=/.test(sheetXml)) sheetXml = sheetXml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ')
    // <drawing> must come after pageMargins/pageSetup/headerFooter and before legacyDrawing/tableParts/extLst
    const before = ['<legacyDrawing', '<legacyDrawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>']
    const at = Math.min(...before.map(t => { const i = sheetXml.indexOf(t); return i < 0 ? Infinity : i }))
    sheetXml = sheetXml.slice(0, at) + `<drawing r:id="${newId}"/>` + sheetXml.slice(at)
    zip.file(path, sheetXml)
  }
  zip.file('[Content_Types].xml', contentTypes)
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

