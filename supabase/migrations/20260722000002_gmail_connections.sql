-- Conexiuni Gmail per user (spec §8 Phase 2). Tokenurile sunt criptate
-- aplicativ (AES-256-GCM, vezi lib/encryption.ts) înainte de a ajunge în DB —
-- coloanele stochează doar text cifrat, niciodată tokenul brut.

create table if not exists gmail_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table gmail_connections enable row level security;

drop trigger if exists gmail_connections_touch_updated_at on gmail_connections;
create trigger gmail_connections_touch_updated_at
  before update on gmail_connections
  for each row execute function touch_updated_at();

-- Userul își vede/gestionează doar propria conexiune. Niciun token nu ajunge
-- vreodată la client — RLS permite select, dar rutele API nu returnează
-- coloanele criptate către browser (vezi app/api/gmail/*).
drop policy if exists gmail_connections_own_row on gmail_connections;
create policy gmail_connections_own_row on gmail_connections
  for all to authenticated
  using (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()))
  with check (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()));
