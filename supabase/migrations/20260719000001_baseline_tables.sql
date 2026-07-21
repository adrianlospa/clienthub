-- ClientHub baseline: tabele, constrângeri, indexuri
-- Ordinea fișierelor: 000001 tabele → 000002 funcții → 000003 RLS

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- workspaces

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'solo' check (plan in ('solo', 'pro', 'agency')),
  ai_analysis_count integer not null default 0,
  ai_analysis_date date,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on workspace_members (user_id);

-- Allowlist verificat pre-sesiune de admin client la signup.
create table if not exists allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

-- KV per workspace. PK compus — bug-ul latent din AdProfit (PK doar pe `key`)
-- este corectat aici intenționat.
create table if not exists settings (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

-- ----------------------------------------------------------- config per-workspace

create table if not exists statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  sort_order integer not null default 0,
  phase text not null default 'pre_sale' check (phase in ('pre_sale', 'post_sale')),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists statuses_workspace_order_idx on statuses (workspace_id, sort_order);

create table if not exists activity_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default '#64748b',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);

-- ------------------------------------------------------------------- projects

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'internal'
    check (type in ('website', 'video', 'course', 'campaign', 'internal')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'done', 'cancelled')),
  description text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_workspace_idx on projects (workspace_id);

-- -------------------------------------------------------------------- clients

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  company_name text,
  contact_person text,
  phone text,
  phone_normalized text,
  email text,
  whatsapp text,
  instagram text,
  facebook text,
  linkedin text,
  source text,
  tags text[] not null default '{}',
  current_status_id uuid references statuses(id) on delete set null,
  date_added date not null default current_date,
  date_first_contacted date,
  -- Sume nete, fără TVA (vezi CLAUDE.md).
  estimated_value numeric(14, 2),
  currency text not null default 'RON',
  owner_user_id uuid references auth.users(id) on delete set null,
  next_step_date date,
  next_step_description text,
  ai_summary text,
  ai_summary_updated_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_workspace_idx on clients (workspace_id);
create index if not exists clients_status_idx on clients (workspace_id, current_status_id);
create index if not exists clients_owner_idx on clients (workspace_id, owner_user_id);
create index if not exists clients_next_step_idx on clients (workspace_id, next_step_date);
create index if not exists clients_email_idx on clients (workspace_id, lower(email));
create index if not exists clients_phone_idx on clients (workspace_id, phone_normalized);
-- Trigram pentru detecția de duplicate pe nume (vezi find_duplicate_clients).
create index if not exists clients_name_trgm_idx on clients using gin (name gin_trgm_ops);

create table if not exists status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  from_status_id uuid references statuses(id) on delete set null,
  to_status_id uuid references statuses(id) on delete set null,
  changed_by uuid default auth.uid() references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index if not exists status_history_client_idx on status_history (client_id, changed_at desc);

-- ----------------------------------------------------------------- activities

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  type text not null default 'task',
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done', 'waiting_client')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  due_date date,
  done_date timestamptz,
  waiting_on text check (waiting_on in ('me', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_workspace_due_idx on activities (workspace_id, due_date);
create index if not exists activities_client_idx on activities (client_id);
create index if not exists activities_project_idx on activities (project_id);
create index if not exists activities_assigned_idx on activities (workspace_id, assigned_to, status);

-- Log de handoff: reasignarea unei activități lasă urmă (Phase 2 trimite notificarea).
create table if not exists activity_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  changed_by uuid default auth.uid() references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists activity_assignments_activity_idx on activity_assignments (activity_id, changed_at desc);

-- ------------------------------------------------------ comments / documents

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_type text not null check (parent_type in ('client', 'project', 'activity')),
  parent_id uuid not null,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  text text not null,
  is_ai boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_parent_idx on comments (parent_type, parent_id, created_at desc);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  parent_type text not null check (parent_type in ('client', 'project', 'activity')),
  parent_id uuid not null,
  filename text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists documents_parent_idx on documents (parent_type, parent_id);

-- --------------------------------------------------------------- interactions

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null check (channel in
    ('email', 'whatsapp', 'phone', 'instagram', 'facebook', 'linkedin', 'in_person')),
  direction text not null check (direction in ('in', 'out')),
  occurred_at timestamptz not null default now(),
  summary text,
  raw_content text,
  external_ref text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Idempotență pentru sync-ul automat din Phase 3.
  unique (workspace_id, external_ref)
);

create index if not exists interactions_client_idx on interactions (client_id, occurred_at desc);

-- ------------------------------------------------------------------------ AI

create table if not exists ai_analysis_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  feature text not null,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_analysis_log_workspace_idx on ai_analysis_log (workspace_id, created_at desc);
