const WRITABLE_FIELDS = [
  'name', 'company_name', 'contact_person', 'phone', 'email', 'whatsapp',
  'instagram', 'facebook', 'linkedin', 'source', 'tags', 'current_status_id',
  'estimated_value', 'date_first_contacted', 'next_step_date',
  'next_step_description', 'currency',
] as const

// Allowlist explicit de coloane — payload-ul nu ajunge niciodată direct în insert,
// altfel un client poate seta workspace_id sau ai_summary.
export function pickWritable(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of WRITABLE_FIELDS) {
    if (key in body) out[key] = body[key]
  }
  return out
}
