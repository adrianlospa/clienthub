// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export type Settings = {
  currency: string
  vatRate: number
  dateFormat: string
}

const SETTINGS_KEYS = ['currency', 'vat_rate', 'date_format']

// Single query for all settings — call this instead of adding per-key helpers.
export async function getAllSettings(supabase: Db, workspaceId: string): Promise<Settings> {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .eq('workspace_id', workspaceId)
    .in('key', SETTINGS_KEYS)

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return {
    currency: map.currency ?? 'RON',
    vatRate: map.vat_rate ? parseFloat(map.vat_rate) : 0.21,
    dateFormat: map.date_format ?? 'DD.MM.YYYY',
  }
}
