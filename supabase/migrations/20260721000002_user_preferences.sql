-- Preferințe per user (nu per workspace) — digest zilnic on/off. Tabela
-- `settings` e KV per workspace, nu se pretează la o valoare per membru.

create table if not exists user_preferences (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table user_preferences enable row level security;

drop trigger if exists user_preferences_touch_updated_at on user_preferences;
create trigger user_preferences_touch_updated_at
  before update on user_preferences
  for each row execute function touch_updated_at();

-- Userul își vede/editează doar propriul rând.
drop policy if exists user_preferences_own_row on user_preferences;
create policy user_preferences_own_row on user_preferences
  for all to authenticated
  using (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()))
  with check (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()));

-- ---------------------------------------------------------- notifications

-- Notificări in-app (handoff de activități etc.). Append-only din perspectiva
-- userului — doar `read_at` se actualizează.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx on notifications (user_id, workspace_id, read_at);

alter table notifications enable row level security;

drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select to authenticated
  using (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()));

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
  for update to authenticated
  using (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()))
  with check (user_id = auth.uid() and workspace_id in (select get_user_workspace_ids()));

-- Insertul vine din trigger-ul de handoff (security definer) sau din cron
-- (admin client) — niciun user nu are voie să-și scrie singur notificări.

-- Trigger de handoff: la reasignarea unei activități, notifică noul responsabil.
create or replace function activities_notify_handoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_project_name text;
  v_context text;
begin
  if new.assigned_to is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  -- Nu te notifica singur când îți asignezi ție o activitate nouă.
  if new.assigned_to = new.created_by and tg_op = 'INSERT' then
    return new;
  end if;
  if new.assigned_to = coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
     and tg_op = 'UPDATE' then
    return new;
  end if;

  if new.client_id is not null then
    select name into v_client_name from clients where id = new.client_id;
    v_context := v_client_name;
  elsif new.project_id is not null then
    select name into v_project_name from projects where id = new.project_id;
    v_context := v_project_name;
  end if;

  insert into notifications (workspace_id, user_id, type, title, body, link)
  values (
    new.workspace_id,
    new.assigned_to,
    'activity_handoff',
    'Ți-a fost asignată o activitate',
    new.title || case when v_context is not null then ' — ' || v_context else '' end,
    case when new.client_id is not null then '/clienti/' || new.client_id
         when new.project_id is not null then '/proiecte/' || new.project_id
         else null end
  );

  return new;
end;
$$;

drop trigger if exists activities_notify_handoff on activities;
create trigger activities_notify_handoff
  after insert or update of assigned_to on activities
  for each row execute function activities_notify_handoff();
