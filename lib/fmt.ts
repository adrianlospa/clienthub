// Toate sumele sunt nete, fără TVA. Datele se afișează DD.MM.YYYY (CLAUDE.md).

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

export function formatMoney(amount: number | null | undefined, currency = 'RON'): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Zile întregi scurse de la `value` până azi. Negativ = în viitor. */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return null
  const ms = Date.now() - then.getTime()
  return Math.floor(ms / 86_400_000)
}

/** „acum 3 zile" / „azi" / „peste 2 zile" */
export function relativeDays(value: string | null | undefined): string {
  const d = daysSince(value)
  if (d === null) return '—'
  if (d === 0) return 'azi'
  if (d === 1) return 'ieri'
  if (d === -1) return 'mâine'
  if (d > 1) return `acum ${d} zile`
  return `peste ${Math.abs(d)} zile`
}

/** wa.me acceptă doar cifre, cu prefix de țară. */
export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('0') ? `40${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

export function mailtoLink(email: string | null | undefined, subject?: string): string | null {
  if (!email) return null
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  return `mailto:${email}${q}`
}
