export type Status = {
  id: string
  workspace_id: string
  name: string
  color: string
  sort_order: number
  phase: 'pre_sale' | 'post_sale'
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export type Client = {
  id: string
  workspace_id: string
  name: string
  company_name: string | null
  contact_person: string | null
  phone: string | null
  phone_normalized: string | null
  email: string | null
  whatsapp: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  source: string | null
  tags: string[]
  current_status_id: string | null
  date_added: string
  date_first_contacted: string | null
  estimated_value: number | null
  currency: string
  owner_user_id: string | null
  next_step_date: string | null
  next_step_description: string | null
  ai_summary: string | null
  ai_summary_updated_at: string | null
  created_at: string
  updated_at: string
}

export type StatusHistoryEntry = {
  id: string
  client_id: string
  from_status_id: string | null
  to_status_id: string | null
  changed_by: string | null
  changed_at: string
  note: string | null
}

export type DuplicateMatch = {
  id: string
  name: string
  company_name: string | null
  email: string | null
  phone: string | null
  match_reason: 'email' | 'phone' | 'name'
  score: number
}

export type Interaction = {
  id: string
  client_id: string
  channel: 'email' | 'whatsapp' | 'phone' | 'instagram' | 'facebook' | 'linkedin' | 'in_person'
  direction: 'in' | 'out'
  occurred_at: string
  summary: string | null
  raw_content: string | null
  external_ref: string | null
  created_by: string | null
  created_at: string
}

export type Comment = {
  id: string
  parent_type: 'client' | 'project' | 'activity'
  parent_id: string
  user_id: string | null
  text: string
  is_ai: boolean
  created_at: string
}

export type ClientDocument = {
  id: string
  parent_type: 'client' | 'project' | 'activity'
  parent_id: string
  filename: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  uploaded_at: string
}

export type ActivityType = {
  id: string
  workspace_id: string
  key: string
  label: string
  color: string
  sort_order: number
}

export type Activity = {
  id: string
  workspace_id: string
  client_id: string | null
  project_id: string | null
  type: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done' | 'waiting_client'
  assigned_to: string | null
  created_by: string | null
  due_date: string | null
  done_date: string | null
  waiting_on: 'me' | 'client' | null
  created_at: string
  updated_at: string
}

export type Project = {
  id: string
  workspace_id: string
  name: string
  type: 'website' | 'video' | 'course' | 'campaign' | 'internal'
  status: 'active' | 'paused' | 'done' | 'cancelled'
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type WorkspaceMember = {
  userId: string
  email: string
  role: 'admin' | 'member'
}

export type PortfolioRanking = {
  id: string
  client_id: string
  rank: number
  reasoning: string | null
  computed_at: string
}

// Doar câmpurile sigure de expus în browser — tokenurile criptate rămân
// exclusiv server-side (vezi supabase/migrations/20260722000002_gmail_connections.sql).
export type GmailConnectionPublic = {
  id: string
  email: string
  created_at: string
}

export type Notification = {
  id: string
  workspace_id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}
