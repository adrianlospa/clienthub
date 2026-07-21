-- Cache pentru clasamentul săptămânal "Top oportunități" (spec §7.3).
-- Se rescrie complet la fiecare rulare de cron — nu se ține istoric, doar
-- ultima rundă per workspace.

create table if not exists portfolio_rankings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  rank integer not null,
  reasoning text,
  computed_at timestamptz not null default now(),
  unique (workspace_id, client_id, computed_at)
);

create index if not exists portfolio_rankings_workspace_idx
  on portfolio_rankings (workspace_id, computed_at desc, rank);

alter table portfolio_rankings enable row level security;

drop policy if exists portfolio_rankings_select on portfolio_rankings;
create policy portfolio_rankings_select on portfolio_rankings
  for select to authenticated
  using (workspace_id in (select get_user_workspace_ids()));

-- Scrierea vine doar din cron (admin client) — niciun user nu are voie să-și
-- scrie singur un clasament.
