import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic()

// Model folosit pentru analiza de rutină — rapid, ieftin (CLAUDE.md §AI).
export const AI_MODEL_ANALYSIS = 'claude-haiku-4-5-20251001'
// Model folosit pentru chat-ul per client — calitate mai mare.
export const AI_MODEL_CHAT = 'claude-sonnet-5'

export const DAILY_LIMITS: Record<string, number> = { solo: 3, pro: 10, agency: 100 }
