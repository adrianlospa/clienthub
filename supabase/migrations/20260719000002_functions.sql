-- ClientHub baseline: funcții + RPC-uri
-- Rulează DUPĂ 000001_baseline_tables.sql, ÎNAINTE de 000003_rls_policies.sql.

-- Granița reală de multi-tenancy. security definer ca să nu intre în recursiune
-- cu politica RLS de pe workspace_members.
create or replace function get_user_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from workspace_members where user_id = auth.uid()
$$;

revoke all on function get_user_workspace_ids() from public;
grant execute on function get_user_workspace_ids() to authenticated;

-- Rol în workspace, pentru gating-ul de admin (invitații, ștergeri).
create or replace function user_has_workspace_role(p_workspace_id uuid, p_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where user_id = auth.uid()
      and workspace_id = p_workspace_id
      and role = p_role
  )
$$;

revoke all on function user_has_workspace_role(uuid, text) from public;
grant execute on function user_has_workspace_role(uuid, text) to authenticated;

-- updated_at pe tabelele mutabile.
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on clients;
create trigger clients_touch_updated_at
  before update on clients
  for each row execute function touch_updated_at();

drop trigger if exists activities_touch_updated_at on activities;
create trigger activities_touch_updated_at
  before update on activities
  for each row execute function touch_updated_at();

drop trigger if exists projects_touch_updated_at on projects;
create trigger projects_touch_updated_at
  before update on projects
  for each row execute function touch_updated_at();

drop trigger if exists settings_touch_updated_at on settings;
create trigger settings_touch_updated_at
  before update on settings
  for each row execute function touch_updated_at();

-- Normalizare telefon pentru match de duplicate: doar cifre, prefix RO 0 → 40.
create or replace function normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    when left(regexp_replace(p_phone, '\D', '', 'g'), 1) = '0'
      then '40' || substr(regexp_replace(p_phone, '\D', '', 'g'), 2)
    else regexp_replace(p_phone, '\D', '', 'g')
  end
$$;

create or replace function clients_set_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized = normalize_phone(coalesce(new.phone, new.whatsapp));
  return new;
end;
$$;

drop trigger if exists clients_normalize_phone on clients;
create trigger clients_normalize_phone
  before insert or update of phone, whatsapp on clients
  for each row execute function clients_set_phone_normalized();

-- Detecție duplicate: email exact, telefon normalizat exact, nume prin trigram.
-- security invoker — RLS de pe clients filtrează deja la workspace-urile userului.
create or replace function find_duplicate_clients(
  p_workspace_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_exclude_id uuid default null
)
returns table (id uuid, name text, company_name text, email text, phone text, match_reason text, score real)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.company_name,
    c.email,
    c.phone,
    case
      when p_email is not null and lower(c.email) = lower(p_email) then 'email'
      when p_phone is not null and c.phone_normalized = normalize_phone(p_phone) then 'phone'
      else 'name'
    end as match_reason,
    similarity(c.name, coalesce(p_name, '')) as score
  from clients c
  where c.workspace_id = p_workspace_id
    and (p_exclude_id is null or c.id <> p_exclude_id)
    and (
      (p_email is not null and btrim(p_email) <> '' and lower(c.email) = lower(p_email))
      or (normalize_phone(p_phone) is not null and c.phone_normalized = normalize_phone(p_phone))
      or (p_name is not null and btrim(p_name) <> '' and similarity(c.name, p_name) > 0.4)
    )
  order by
    case
      when p_email is not null and lower(c.email) = lower(p_email) then 0
      when p_phone is not null and c.phone_normalized = normalize_phone(p_phone) then 1
      else 2
    end,
    score desc
  limit 10
$$;

revoke all on function find_duplicate_clients(uuid, text, text, text, uuid) from public;
grant execute on function find_duplicate_clients(uuid, text, text, text, uuid) to authenticated;

-- Schimbarea de status scrie automat în status_history — istoricul nu depinde
-- de disciplina call site-urilor.
create or replace function clients_log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.current_status_id is not null then
      insert into status_history (workspace_id, client_id, from_status_id, to_status_id)
      values (new.workspace_id, new.id, null, new.current_status_id);
    end if;
  elsif new.current_status_id is distinct from old.current_status_id then
    insert into status_history (workspace_id, client_id, from_status_id, to_status_id)
    values (new.workspace_id, new.id, old.current_status_id, new.current_status_id);
  end if;
  return new;
end;
$$;

drop trigger if exists clients_log_status_change on clients;
create trigger clients_log_status_change
  after insert or update of current_status_id on clients
  for each row execute function clients_log_status_change();

-- Handoff: reasignarea unei activități lasă urmă în activity_assignments.
create or replace function activities_log_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if new.assigned_to is null then
    return new;
  end if;
  insert into activity_assignments (workspace_id, activity_id, from_user_id, to_user_id)
  values (
    new.workspace_id,
    new.id,
    case when tg_op = 'UPDATE' then old.assigned_to else null end,
    new.assigned_to
  );
  return new;
end;
$$;

drop trigger if exists activities_log_assignment on activities;
create trigger activities_log_assignment
  after insert or update of assigned_to on activities
  for each row execute function activities_log_assignment();

-- Helper folosit de RPC-ul de mai jos: increment_ai_analysis_count e security
-- definer și ocolește RLS, deci apartenența se verifică explicit.
create or replace function workspace_id_is_visible(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where user_id = auth.uid() and workspace_id = p_workspace_id
  )
$$;

-- Rate limit AI atomic. Returnează noul count, sau -1 dacă limita e depășită.
-- Contorul se resetează la 1 când data stocată diferă de p_today.
create or replace function increment_ai_analysis_count(
  p_workspace_id uuid,
  p_today date,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update workspaces
     set ai_analysis_count = case when ai_analysis_date is distinct from p_today
                                  then 1
                                  else ai_analysis_count + 1 end,
         ai_analysis_date = p_today
   where id = p_workspace_id
     and workspace_id_is_visible(p_workspace_id)
     and (ai_analysis_date is distinct from p_today or ai_analysis_count < p_limit)
  returning ai_analysis_count into v_count;

  if v_count is null then
    return -1;
  end if;
  return v_count;
end;
$$;

revoke all on function increment_ai_analysis_count(uuid, date, integer) from public;
grant execute on function increment_ai_analysis_count(uuid, date, integer) to authenticated;

-- Acceptarea unei invitații: validează tokenul și adaugă membrul. Apelat
-- post-login din route handler.
create or replace function accept_workspace_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite workspace_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite
    from workspace_invites
   where token = p_token
     and accepted_at is null
     and expires_at > now()
   for update;

  if not found then
    return null;
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, auth.uid(), v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update workspace_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

revoke all on function accept_workspace_invite(uuid) from public;
grant execute on function accept_workspace_invite(uuid) to authenticated;
