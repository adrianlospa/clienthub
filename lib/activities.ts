const WRITABLE_FIELDS = [
  'client_id', 'project_id', 'type', 'title', 'description', 'status',
  'assigned_to', 'due_date', 'done_date', 'waiting_on',
] as const

export function pickActivityFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of WRITABLE_FIELDS) {
    if (key in body) out[key] = body[key]
  }
  return out
}
