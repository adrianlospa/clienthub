const WRITABLE_FIELDS = ['name', 'type', 'status', 'description'] as const

export function pickProjectFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of WRITABLE_FIELDS) {
    if (key in body) out[key] = body[key]
  }
  return out
}
