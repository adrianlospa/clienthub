// Seed-ul aplicat la crearea unui workspace nou — aceleași valori ca în
// supabase/seed.sql, ca un workspace nou să fie utilizabil imediat.

export const DEFAULT_STATUSES = [
  { name: 'Lead', color: '#94a3b8', sort_order: 10, phase: 'pre_sale', is_won: false, is_lost: false },
  { name: 'Contactat', color: '#60a5fa', sort_order: 20, phase: 'pre_sale', is_won: false, is_lost: false },
  { name: 'Ofertă trimisă', color: '#818cf8', sort_order: 30, phase: 'pre_sale', is_won: false, is_lost: false },
  { name: 'Follow-up', color: '#fbbf24', sort_order: 40, phase: 'pre_sale', is_won: false, is_lost: false },
  { name: 'Contract semnat', color: '#34d399', sort_order: 50, phase: 'post_sale', is_won: true, is_lost: false },
  { name: 'Activ', color: '#10b981', sort_order: 60, phase: 'post_sale', is_won: true, is_lost: false },
  { name: 'Recurent', color: '#059669', sort_order: 70, phase: 'post_sale', is_won: true, is_lost: false },
  { name: 'Inactiv', color: '#a8a29e', sort_order: 80, phase: 'post_sale', is_won: false, is_lost: false },
  { name: 'Pierdut', color: '#f87171', sort_order: 90, phase: 'post_sale', is_won: false, is_lost: true },
] as const

export const DEFAULT_ACTIVITY_TYPES = [
  { key: 'call', label: 'Telefon', color: '#60a5fa', sort_order: 10 },
  { key: 'email', label: 'Email', color: '#818cf8', sort_order: 20 },
  { key: 'whatsapp', label: 'WhatsApp', color: '#34d399', sort_order: 30 },
  { key: 'meeting', label: 'Întâlnire', color: '#f472b6', sort_order: 40 },
  { key: 'task', label: 'Task', color: '#94a3b8', sort_order: 50 },
  { key: 'note', label: 'Notiță', color: '#a8a29e', sort_order: 60 },
  { key: 'filming', label: 'Filmare', color: '#fb923c', sort_order: 70 },
  { key: 'editing', label: 'Montaj', color: '#f59e0b', sort_order: 80 },
  { key: 'campaign', label: 'Campanie', color: '#22d3ee', sort_order: 90 },
  { key: 'newsletter', label: 'Newsletter', color: '#c084fc', sort_order: 100 },
  { key: 'other', label: 'Altele', color: '#64748b', sort_order: 110 },
] as const

export const DEFAULT_PROJECT_TYPES = [
  { key: 'website', label: 'Website', color: '#60a5fa', sort_order: 10 },
  { key: 'video', label: 'Video', color: '#f472b6', sort_order: 20 },
  { key: 'course', label: 'Curs', color: '#34d399', sort_order: 30 },
  { key: 'campaign', label: 'Campanie', color: '#22d3ee', sort_order: 40 },
  { key: 'internal', label: 'Intern', color: '#94a3b8', sort_order: 50 },
] as const

export const DEFAULT_SETTINGS = {
  currency: 'RON',
  vat_rate: '0.21',
  date_format: 'DD.MM.YYYY',
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedWorkspaceDefaults(admin: any, workspaceId: string) {
  await admin.from('statuses').insert(DEFAULT_STATUSES.map((s) => ({ ...s, workspace_id: workspaceId })))
  await admin
    .from('activity_types')
    .insert(DEFAULT_ACTIVITY_TYPES.map((t) => ({ ...t, workspace_id: workspaceId })))
  await admin
    .from('project_types')
    .insert(DEFAULT_PROJECT_TYPES.map((t) => ({ ...t, workspace_id: workspaceId })))
  await admin
    .from('settings')
    .insert(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ workspace_id: workspaceId, key, value }))
    )
}
