import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'
import { buildClientContext } from '@/lib/ai-context'
import { anthropic, AI_MODEL_CHAT } from '@/lib/anthropic'

const SYSTEM_PROMPT_BASE = readFileSync(join(process.cwd(), 'prompts', 'client-chat.v1.txt'), 'utf-8')

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// Chat liber per client, grounded în contextul complet (concatenat, fără
// vector DB — spec §7.2). Nu persistă conversația; e efemeră per sesiune de
// UI. Fiecare mesaj consumă din aceeași limită zilnică AI ca analiza.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return new Response('Niciun workspace activ.', { status: 400 })

  const { clientId, messages } = await req.json()
  if (typeof clientId !== 'string' || !Array.isArray(messages) || messages.length === 0) {
    return new Response('Date invalide.', { status: 400 })
  }

  const rateLimit = await checkAiRateLimit(supabase, workspaceId)
  if (!rateLimit.ok) {
    return new Response(rateLimit.error, { status: 429 })
  }

  const context = await buildClientContext(supabase, clientId)
  if (!context) {
    return new Response('Clientul nu există.', { status: 404 })
  }

  const conversation: ChatMessage[] = messages
    .filter((m: unknown): m is ChatMessage => {
      const msg = m as ChatMessage
      return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string'
    })
    .slice(-20)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullText = ''
      let promptTokens = 0
      let completionTokens = 0

      try {
        const claudeStream = anthropic.messages.stream({
          model: AI_MODEL_CHAT,
          max_tokens: 1024,
          system: `${SYSTEM_PROMPT_BASE}\n\n${context}`,
          messages: conversation,
        })

        claudeStream.on('text', (delta) => {
          fullText += delta
          controller.enqueue(encoder.encode(delta))
        })

        const finalMessage = await claudeStream.finalMessage()
        promptTokens = finalMessage.usage.input_tokens
        completionTokens = finalMessage.usage.output_tokens
      } catch (err) {
        console.error('[ai-chat]', err)
        controller.enqueue(encoder.encode('\n\n[Eroare la generarea răspunsului.]'))
      } finally {
        controller.close()
      }

      if (fullText) {
        await supabase.from('ai_analysis_log').insert({
          workspace_id: workspaceId,
          user_id: user.id,
          feature: 'client_chat',
          model: AI_MODEL_CHAT,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
        })
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
