import { DAILY_LIMITS } from './anthropic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; rpc: (fn: string, args: unknown) => any }

export type RateLimitResult = { ok: true } | { ok: false; error: string }

// Rate limiting AI prin RPC atomic — pattern identic cu AdProfit
// (increment_ai_analysis_count, vezi CONVENTIONS.md §4).
export async function checkAiRateLimit(supabase: Db, workspaceId: string): Promise<RateLimitResult> {
  const today = new Date().toISOString().split('T')[0]
  const { data: workspace } = await supabase.from('workspaces').select('plan').eq('id', workspaceId).maybeSingle()

  const plan = workspace?.plan ?? 'solo'
  const dailyLimit = DAILY_LIMITS[plan] ?? 3

  const { data: counterData, error: counterError } = await supabase.rpc('increment_ai_analysis_count', {
    p_workspace_id: workspaceId,
    p_today: today,
    p_limit: dailyLimit,
  })

  if (counterError) {
    console.error('[ai-rate-limit]', counterError.message)
    return { ok: false, error: 'Server error' }
  }
  if (counterData === -1) {
    return {
      ok: false,
      error: `Limita zilnică de ${dailyLimit} analize AI a fost atinsă pentru planul ${plan}. Se resetează la miezul nopții.`,
    }
  }
  return { ok: true }
}
