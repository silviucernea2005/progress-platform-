import type { SupabaseClient } from '@supabase/supabase-js'

// Every report keeps its own rows in report_activities (one per category), created when
// the report was made. So when a project's category list changes later (a category is
// added, deleted, or a shared default is hidden/restored), existing reports don't follow
// on their own. This reconciles ALL reports of a project with the project's current list:
//   - missing categories get a row with 0% progress
//   - categories that no longer apply to the project lose their row
// It's idempotent, so it's safe to call after any change (and to call again to repair).
export async function syncProjectReportActivities(supabase: SupabaseClient, projectId: string) {
  const [actsRes, settingsRes, reportsRes] = await Promise.all([
    supabase.from('activities').select('id').or(`project_id.is.null,project_id.eq.${projectId}`),
    supabase.from('project_settings').select('activity_overrides').eq('project_id', projectId).maybeSingle(),
    supabase.from('reports').select('id').eq('project_id', projectId),
  ])
  // If anything failed to load, change nothing — never delete based on partial data.
  if (actsRes.error || settingsRes.error || reportsRes.error || !actsRes.data || !reportsRes.data) return { added: 0, removed: 0 }

  const overrides: Record<string, { excluded?: boolean }> = settingsRes.data?.activity_overrides || {}
  const desired = new Set<number>(actsRes.data.filter((a: any) => !overrides[a.id]?.excluded).map((a: any) => a.id))
  if (desired.size === 0) return { added: 0, removed: 0 }
  const reportIds: string[] = reportsRes.data.map((r: any) => r.id)

  let added = 0, removed = 0
  for (let i = 0; i < reportIds.length; i += 25) {
    const chunk = reportIds.slice(i, i + 25)
    const { data: rows, error } = await supabase.from('report_activities').select('report_id, activity_id').in('report_id', chunk)
    if (error || !rows) continue

    const have = new Map<string, Set<number>>()
    for (const id of chunk) have.set(id, new Set())
    for (const r of rows) have.get(r.report_id)?.add(r.activity_id)

    const toInsert: { report_id: string; activity_id: number; progress: number }[] = []
    for (const id of chunk) {
      for (const actId of Array.from(desired)) {
        if (!have.get(id)!.has(actId)) toInsert.push({ report_id: id, activity_id: actId, progress: 0 })
      }
    }
    if (toInsert.length) {
      const { error: insErr } = await supabase.from('report_activities').upsert(toInsert, { onConflict: 'report_id,activity_id', ignoreDuplicates: true })
      if (!insErr) added += toInsert.length
    }

    const staleActivityIds = Array.from(new Set(rows.filter((r: any) => !desired.has(r.activity_id)).map((r: any) => r.activity_id)))
    if (staleActivityIds.length) {
      const { error: delErr } = await supabase.from('report_activities').delete().in('report_id', chunk).in('activity_id', staleActivityIds)
      if (!delErr) removed += rows.filter((r: any) => !desired.has(r.activity_id)).length
    }
  }
  return { added, removed }
}

