import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM. ENCRYPTION_KEY trebuie să fie 32 octeți, codificați base64
// (generează cu: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))").
// Folosit exclusiv server-side pentru tokenurile Gmail — niciodată expus.
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY nu este setat')
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY trebuie să fie exact 32 octeți (base64)')
  return buf
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, 'base64')
  const iv = raw.subarray(0, 12)
  const authTag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
