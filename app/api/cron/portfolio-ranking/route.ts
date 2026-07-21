import { NextResponse, type NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { buildPortfolioCandidates, renderPortfolioContext } from '@/lib/portfolio'
import { anthropic, AI_MODEL_ANALYSIS } from '@/lib/anthropic'

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'prompts', 'portfolio-ranking.v1.txt'), 'utf-8')

const RANKING_SCHEMA = {
  type: 'object',
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          reasoning: { type: 'string' },
        },
        required: ['client_id', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  required: ['rankings'],
  additionalProperties: false,
} as const

// Rulează săptămânal (vezi vercel.json) — un singur apel AI per workspace,
// rezultatul cache-uit în portfolio_rankings și citit direct de dashboard,
// nu recalculat la fiecare vizualizare de pagină (spec §7.3).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const { data: workspaces, error } = await admin.from('workspaces').select('id')
  if (error) {
    console.error('[cron/portfolio-ranking]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  let ranked = 0
  let skipped = 0

  for (const workspace of workspaces ?? []) {
    try {
      const candidates = await buildPortfolioCandidates(admin, workspace.id)
      if (candidates.length === 0) {
        skipped++
        continue
      }

      const message = await anthropic.messages.create({
        model: AI_MODEL_ANALYSIS,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: RANKING_SCHEMA } },
        messages: [{ role: 'user', content: renderPortfolioContext(candidates) }],
      })

      const textBlock = message.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        skipped++
        continue
      }

      const parsed = JSON.parse(textBlock.text) as {
        rankings: { client_id: string; reasoning: string }[]
      }

      const validIds = new Set(candidates.map((c) => c.id))
      const computedAt = new Date().toISOString()
      const rows = parsed.rankings
        .filter((r) => validIds.has(r.client_id))
        .map((r, i) => ({
          workspace_id: workspace.id,
          client_id: r.client_id,
          rank: i + 1,
          reasoning: r.reasoning,
          computed_at: computedAt,
        }))

      if (rows.length > 0) {
        await admin.from('portfolio_rankings').delete().eq('workspace_id', workspace.id)
        await admin.from('portfolio_rankings').insert(rows)
        await admin.from('ai_analysis_log').insert({
          workspace_id: workspace.id,
          feature: 'portfolio_ranking',
          model: AI_MODEL_ANALYSIS,
          prompt_tokens: message.usage.input_tokens,
          completion_tokens: message.usage.output_tokens,
        })
        ranked++
      } else {
        skipped++
      }
    } catch (err) {
      console.error('[cron/portfolio-ranking] workspace', workspace.id, err)
    }
  }

  return NextResponse.json({ success: true, ranked, skipped })
}
