-- Tipuri de proiect configurabile per workspace, în locul listei fixe
-- (website/video/curs/campanie/intern). Oglindește exact activity_types
-- (key/label/color/sort_order) — același tipar, aceeași politică RLS.

create table if not exists project_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default '#64748b',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);

alter table project_types enable row level security;

drop policy if exists project_types_all on project_types;
create policy project_types_all on project_types
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

-- projects.type devine text liber (validat la nivel de aplicație prin
-- project_types.key, la fel ca activities.type față de activity_types).
alter table projects drop constraint if exists projects_type_check;

-- Seed pentru workspace-urile existente, ca proiectele curente să rămână valide.
insert into project_types (workspace_id, key, label, color, sort_order)
select w.id, t.key, t.label, t.color, t.sort_order
from workspaces w
cross join (values
  ('website', 'Website', '#60a5fa', 10),
  ('video', 'Video', '#f472b6', 20),
  ('course', 'Curs', '#34d399', 30),
  ('campaign', 'Campanie', '#22d3ee', 40),
  ('internal', 'Intern', '#94a3b8', 50)
) as t(key, label, color, sort_order)
on conflict (workspace_id, key) do nothing;
