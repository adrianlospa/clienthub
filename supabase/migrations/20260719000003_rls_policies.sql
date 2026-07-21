-- ClientHub baseline: RLS pe toate tabelele.
-- Rulează DUPĂ 000002_functions.sql (politicile apelează get_user_workspace_ids()).
-- Regulă: nicio tabelă fără RLS activ. Tabelele fără politică sunt deny-all
-- intenționat și se accesează doar prin admin client (service role).

alter table workspaces           enable row level security;
alter table workspace_members    enable row level security;
alter table workspace_invites    enable row level security;
alter table allowed_emails       enable row level security;
alter table settings             enable row level security;
alter table statuses             enable row level security;
alter table activity_types       enable row level security;
alter table projects             enable row level security;
alter table clients              enable row level security;
alter table status_history       enable row level security;
alter table activities           enable row level security;
alter table activity_assignments enable row level security;
alter table comments             enable row level security;
alter table documents            enable row level security;
alter table interactions         enable row level security;
alter table ai_analysis_log      enable row level security;

-- allowed_emails: deny-all pentru useri. Citit doar de admin client la signup.

-- ------------------------------------------------------------- workspaces

drop policy if exists workspaces_select on workspaces;
create policy workspaces_select on workspaces
  for select to authenticated
  using (id in (select get_user_workspace_ids()));

-- Update doar de admin; insert/delete de workspace trec prin admin client.
drop policy if exists workspaces_update on workspaces;
create policy workspaces_update on workspaces
  for update to authenticated
  using (user_has_workspace_role(id, 'admin'))
  with check (user_has_workspace_role(id, 'admin'));

-- -------------------------------------------------------- workspace_members

drop policy if exists workspace_members_select on workspace_members;
create policy workspace_members_select on workspace_members
  for select to authenticated
  using (workspace_id in (select get_user_workspace_ids()));

-- Adăugarea de membri se face prin accept_workspace_invite() (security definer),
-- nu prin insert direct. Adminul poate schimba rolul sau scoate un membru.
drop policy if exists workspace_members_update on workspace_members;
create policy workspace_members_update on workspace_members
  for update to authenticated
  using (user_has_workspace_role(workspace_id, 'admin'))
  with check (user_has_workspace_role(workspace_id, 'admin'));

drop policy if exists workspace_members_delete on workspace_members;
create policy workspace_members_delete on workspace_members
  for delete to authenticated
  using (user_has_workspace_role(workspace_id, 'admin'));

-- -------------------------------------------------------- workspace_invites

-- Lookup-ul după token la accept se face prin RPC security definer / admin
-- client — tokenul nu e citibil de alți useri.
drop policy if exists workspace_invites_admin_all on workspace_invites;
create policy workspace_invites_admin_all on workspace_invites
  for all to authenticated
  using (user_has_workspace_role(workspace_id, 'admin'))
  with check (user_has_workspace_role(workspace_id, 'admin'));

-- ------------------------------------------- tabele standard scoped pe workspace
-- Toate au aceeași formă: membru al workspace-ului → acces complet.

drop policy if exists settings_all on settings;
create policy settings_all on settings
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists statuses_all on statuses;
create policy statuses_all on statuses
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists activity_types_all on activity_types;
create policy activity_types_all on activity_types
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists projects_all on projects;
create policy projects_all on projects
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists clients_all on clients;
create policy clients_all on clients
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists activities_all on activities;
create policy activities_all on activities
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists comments_all on comments;
create policy comments_all on comments
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists documents_all on documents;
create policy documents_all on documents
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists interactions_all on interactions;
create policy interactions_all on interactions
  for all to authenticated
  using (workspace_id in (select get_user_workspace_ids()))
  with check (workspace_id in (select get_user_workspace_ids()));

-- ------------------------------------------------------------ append-only
-- Istoricul se citește, se scrie prin trigger, dar nu se rescrie: fără
-- politici de update/delete.

drop policy if exists status_history_select on status_history;
create policy status_history_select on status_history
  for select to authenticated
  using (workspace_id in (select get_user_workspace_ids()));

drop policy if exists status_history_insert on status_history;
create policy status_history_insert on status_history
  for insert to authenticated
  with check (workspace_id in (select get_user_workspace_ids()));

drop policy if exists activity_assignments_select on activity_assignments;
create policy activity_assignments_select on activity_assignments
  for select to authenticated
  using (workspace_id in (select get_user_workspace_ids()));

drop policy if exists ai_analysis_log_select on ai_analysis_log;
create policy ai_analysis_log_select on ai_analysis_log
  for select to authenticated
  using (workspace_id in (select get_user_workspace_ids()));

drop policy if exists ai_analysis_log_insert on ai_analysis_log;
create policy ai_analysis_log_insert on ai_analysis_log
  for insert to authenticated
  with check (workspace_id in (select get_user_workspace_ids()));
