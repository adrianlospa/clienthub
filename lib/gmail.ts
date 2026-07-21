import { decrypt, encrypt } from './encryption'
import { refreshAccessToken } from './google-oauth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

type ConnectionRow = {
  id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  expires_at: string
}

// Returnează un access token valid, reînnoindu-l automat dacă a expirat.
// Tokenul nu părăsește niciodată acest fișier — apelantul primește doar
// stringul de folosit imediat într-un header Authorization.
export async function getValidAccessToken(supabase: Db, connection: ConnectionRow): Promise<string> {
  const expiresAt = new Date(connection.expires_at)
  const bufferMs = 2 * 60_000 // reînnoiește cu 2 minute înainte de expirare
  if (expiresAt.getTime() - Date.now() > bufferMs) {
    return decrypt(connection.access_token_encrypted)
  }

  const refreshToken = decrypt(connection.refresh_token_encrypted)
  const tokens = await refreshAccessToken(refreshToken)
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase
    .from('gmail_connections')
    .update({
      access_token_encrypted: encrypt(tokens.access_token),
      expires_at: newExpiresAt,
    })
    .eq('id', connection.id)

  return tokens.access_token
}

type GmailMessage = {
  id: string
  from: string
  to: string
  subject: string
  snippet: string
  internalDate: string
}

function decodeHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

// Caută mesaje recente (ultimele 30 zile) care implică o adresă de email dată.
export async function fetchRecentMessagesForAddress(
  accessToken: string,
  email: string
): Promise<GmailMessage[]> {
  const query = `(from:${email} OR to:${email}) newer_than:30d`
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`)
  const list = await listRes.json()
  const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id)

  const messages: GmailMessage[] = []
  for (const id of ids) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!msgRes.ok) continue
    const msg = await msgRes.json()
    const headers = msg.payload?.headers ?? []
    messages.push({
      id: msg.id,
      from: decodeHeader(headers, 'From'),
      to: decodeHeader(headers, 'To'),
      subject: decodeHeader(headers, 'Subject'),
      snippet: msg.snippet ?? '',
      internalDate: msg.internalDate,
    })
  }
  return messages
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sendGmailMessage(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const raw = base64UrlEncode(
    `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  )
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`)
}
