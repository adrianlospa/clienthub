import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'
import { buildClientContext } from '@/lib/ai-context'
import { anthropic, AI_MODEL_ANALYSIS } from '@/lib/anthropic'

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'prompts', 'client-analysis.v1.txt'), 'utf-8')

// Streamează analiza token-cu-token către browser (text simplu, nu SSE — un
// fetch cu ReadableStream e suficient, EventSource nu suportă POST oricum).
// La final, salvează rezultatul complet ca un comentariu AI (is_ai = true).
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return new Response('Niciun workspace activ.', { status: 400 })

  const { clientId } = await req.json()
  if (typeof clientId !== 'string') {
    return new Response('Client lipsă.', { status: 400 })
  }

  const rateLimit = await checkAiRateLimit(supabase, workspaceId)
  if (!rateLimit.ok) {
    return new Response(rateLimit.error, { status: 429 })
  }

  const context = await buildClientContext(supabase, clientId)
  if (!context) {
    return new Response('Clientul nu există.', { status: 404 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullText = ''
      let promptTokens = 0
      let completionTokens = 0

      try {
        const claudeStream = anthropic.messages.stream({
          model: AI_MODEL_ANALYSIS,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: context }],
        })

        claudeStream.on('text', (delta) => {
          fullText += delta
          controller.enqueue(encoder.encode(delta))
        })

        const finalMessage = await claudeStream.finalMessage()
        promptTokens = finalMessage.usage.input_tokens
        completionTokens = finalMessage.usage.output_tokens
      } catch (err) {
        console.error('[ai-analysis]', err)
        controller.enqueue(encoder.encode('\n\n[Eroare la generarea analizei.]'))
      } finally {
        controller.close()
      }

      if (fullText) {
        await supabase.from('comments').insert({
          workspace_id: workspaceId,
          parent_type: 'client',
          parent_id: clientId,
          text: fullText,
          is_ai: true,
        })
        await supabase.from('ai_analysis_log').insert({
          workspace_id: workspaceId,
          user_id: user.id,
          feature: 'client_analysis',
          model: AI_MODEL_ANALYSIS,
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
