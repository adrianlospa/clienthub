-- Seed pentru un mediu nou. Rulează DUPĂ cele trei migrări baseline.
-- Idempotent: se poate re-rula fără efecte secundare.
--
-- Pasul manual: creează userul în Supabase Auth (email/parolă), apoi pune
-- UUID-ul lui mai jos înainte de a rula fișierul.

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- ⚠️ înlocuiește
  v_ws_id uuid;
  v_slug text;
  v_name text;
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'Userul % nu există în auth.users — creează-l întâi în Supabase Auth.', v_user_id;
  end if;

  foreach v_slug in array array['invataexcel', 'lucreazacuai', 'funnels'] loop
    v_name := case v_slug
      when 'invataexcel' then 'Învață Excel'
      when 'lucreazacuai' then 'Lucrează cu AI'
      else 'Funnels'
    end;

    insert into workspaces (name, slug)
    values (v_name, v_slug)
    on conflict (slug) do update set name = excluded.name
    returning id into v_ws_id;

    insert into workspace_members (workspace_id, user_id, role)
    values (v_ws_id, v_user_id, 'admin')
    on conflict (workspace_id, user_id) do nothing;

    -- Statusuri implicite (spec §4). Editabile din Setări.
    insert into statuses (workspace_id, name, color, sort_order, phase, is_won, is_lost) values
      (v_ws_id, 'Lead',            '#94a3b8', 10, 'pre_sale',  false, false),
      (v_ws_id, 'Contactat',       '#60a5fa', 20, 'pre_sale',  false, false),
      (v_ws_id, 'Ofertă trimisă',  '#818cf8', 30, 'pre_sale',  false, false),
      (v_ws_id, 'Follow-up',       '#fbbf24', 40, 'pre_sale',  false, false),
      (v_ws_id, 'Contract semnat', '#34d399', 50, 'post_sale', true,  false),
      (v_ws_id, 'Activ',           '#10b981', 60, 'post_sale', true,  false),
      (v_ws_id, 'Recurent',        '#059669', 70, 'post_sale', true,  false),
      (v_ws_id, 'Inactiv',         '#a8a29e', 80, 'post_sale', false, false),
      (v_ws_id, 'Pierdut',         '#f87171', 90, 'post_sale', false, true)
    on conflict (workspace_id, name) do nothing;

    -- Tipuri de activitate implicite (spec §4). Editabile din Setări.
    insert into activity_types (workspace_id, key, label, color, sort_order) values
      (v_ws_id, 'call',       'Telefon',    '#60a5fa', 10),
      (v_ws_id, 'email',      'Email',      '#818cf8', 20),
      (v_ws_id, 'whatsapp',   'WhatsApp',   '#34d399', 30),
      (v_ws_id, 'meeting',    'Întâlnire',  '#f472b6', 40),
      (v_ws_id, 'task',       'Task',       '#94a3b8', 50),
      (v_ws_id, 'note',       'Notiță',     '#a8a29e', 60),
      (v_ws_id, 'filming',    'Filmare',    '#fb923c', 70),
      (v_ws_id, 'editing',    'Montaj',     '#f59e0b', 80),
      (v_ws_id, 'campaign',   'Campanie',   '#22d3ee', 90),
      (v_ws_id, 'newsletter', 'Newsletter', '#c084fc', 100),
      (v_ws_id, 'other',      'Altele',     '#64748b', 110)
    on conflict (workspace_id, key) do nothing;

    insert into settings (workspace_id, key, value) values
      (v_ws_id, 'currency', 'RON'),
      (v_ws_id, 'vat_rate', '0.21'),
      (v_ws_id, 'date_format', 'DD.MM.YYYY')
    on conflict (workspace_id, key) do nothing;
  end loop;

  insert into allowed_emails (email) values ('adrian.lospa@gmail.com')
  on conflict (email) do nothing;
end $$;
