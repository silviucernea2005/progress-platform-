export type Role = 'admin' | 'pm' | 'viewer'
export type ProjectStatus = 'active' | 'completed' | 'paused'
export interface User { id: string; name: string; email: string; role: Role; must_change_pin: boolean; created_at: string }
export interface Project { id: string; name: string; location?: string; client?: string; pm_id?: string; status: ProjectStatus; created_at: string }
export interface Activity { id: number; name: string; default_weight: number; sort_order: number }
export interface ReportActivity { report_id: string; activity_id: number; activity?: Activity; progress: number }
export interface ReportPayment { id: number; report_id: string; transa_name: string; semnat: boolean; agreat_doc: boolean; platit: boolean }
export interface Report { id: string; project_id: string; project?: Project; period_start: string; period_end: string; works_done?: string; works_planned?: string; created_at: string; activities?: ReportActivity[]; payments?: ReportPayment[] }
