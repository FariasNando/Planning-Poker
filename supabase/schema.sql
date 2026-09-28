create extension if not exists pgcrypto with schema extensions;

create table if not exists public.planning_poker_rooms (
  id text primary key check (id ~ '^[A-Z0-9]{6}$'),
  admin_id text not null,
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array'),
  tasks jsonb not null default '[]'::jsonb check (jsonb_typeof(tasks) = 'array'),
  active_task_id text,
  revealed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_poker_room_admin (
  room_id text primary key references public.planning_poker_rooms(id) on delete cascade,
  secret_hash text not null
);

create table if not exists public.planning_poker_player_auth (
  room_id text not null references public.planning_poker_rooms(id) on delete cascade,
  player_id text not null,
  secret_hash text not null,
  primary key (room_id, player_id)
);

create table if not exists public.planning_poker_votes (
  room_id text not null references public.planning_poker_rooms(id) on delete cascade,
  task_id text not null,
  player_id text not null,
  score numeric not null,
  card_label text not null,
  primary key (room_id, task_id, player_id)
);

alter table public.planning_poker_votes alter column score type numeric using score::numeric;
alter table public.planning_poker_votes add column if not exists card_label text;
update public.planning_poker_votes set card_label = score::text where card_label is null;
alter table public.planning_poker_votes alter column card_label set not null;
alter table public.planning_poker_votes drop constraint if exists planning_poker_votes_score_check;
alter table public.planning_poker_votes drop constraint if exists planning_poker_votes_card_check;
alter table public.planning_poker_votes add constraint planning_poker_votes_card_check
  check (score in (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5) and card_label = score::text) not valid;

alter table public.planning_poker_rooms enable row level security;
revoke all on public.planning_poker_rooms from anon, authenticated;
grant select on public.planning_poker_rooms to anon, authenticated;
drop policy if exists "Rooms are readable by invite link" on public.planning_poker_rooms;
create policy "Rooms are readable by invite link" on public.planning_poker_rooms
  for select to anon, authenticated using (true);

alter table public.planning_poker_room_admin enable row level security;
revoke all on public.planning_poker_room_admin from anon, authenticated;
alter table public.planning_poker_player_auth enable row level security;
revoke all on public.planning_poker_player_auth from anon, authenticated;
alter table public.planning_poker_votes enable row level security;
revoke all on public.planning_poker_votes from anon, authenticated;

create or replace function public.get_planning_poker_room(p_room_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  room_row public.planning_poker_rooms%rowtype;
begin
  select * into room_row from public.planning_poker_rooms where id = p_room_id;
  if not found then raise exception 'Room not found.'; end if;
  return jsonb_build_object(
    'id', room_row.id,
    'adminId', room_row.admin_id,
    'players', room_row.players,
    'tasks', coalesce((
      select jsonb_agg(
        task.value || jsonb_build_object(
          'votes', case when room_row.revealed or (task.value ? 'finalScore') then coalesce(vote_summary.vote_map, '{}'::jsonb) else '{}'::jsonb end,
          'voteLabels', case when room_row.revealed or (task.value ? 'finalScore') then coalesce(vote_summary.vote_label_map, '{}'::jsonb) else '{}'::jsonb end,
          'voteCount', coalesce(vote_summary.vote_count, 0),
          'finalScore', task.value->'finalScore'
        ) order by task.ordinality
      )
      from jsonb_array_elements(room_row.tasks) with ordinality as task(value, ordinality)
      left join lateral (
        select
          jsonb_object_agg(vote.player_id, vote.score) as vote_map,
          jsonb_object_agg(vote.player_id, vote.card_label) as vote_label_map,
          count(*) as vote_count
        from public.planning_poker_votes vote
        where vote.room_id = room_row.id and vote.task_id = task.value->>'id'
      ) vote_summary on true
    ), '[]'::jsonb),
    'activeTaskId', room_row.active_task_id,
    'revealed', room_row.revealed
  );
end;
$$;

create or replace function public.create_planning_poker_room(
  p_room_id text,
  p_admin_id text,
  p_admin_name text,
  p_admin_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_room_id !~ '^[A-Z0-9]{6}$' then raise exception 'Invalid room code.'; end if;
  if length(trim(p_admin_name)) not between 1 and 28 then raise exception 'Invalid name.'; end if;
  if length(p_admin_token) < 32 then raise exception 'Invalid admin token.'; end if;

  insert into public.planning_poker_rooms (id, admin_id, players)
  values (
    p_room_id,
    p_admin_id,
    jsonb_build_array(jsonb_build_object('id', p_admin_id, 'name', trim(p_admin_name)))
  );
  insert into public.planning_poker_room_admin (room_id, secret_hash)
  values (p_room_id, encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex'));
  insert into public.planning_poker_player_auth (room_id, player_id, secret_hash)
  values (p_room_id, p_admin_id, encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex'));

  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.join_planning_poker_room(
  p_room_id text,
  p_player_id text,
  p_player_name text,
  p_player_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  room_row public.planning_poker_rooms%rowtype;
begin
  if length(trim(p_player_name)) not between 1 and 28 then raise exception 'Invalid name.'; end if;
  if length(p_player_token) < 32 then raise exception 'Invalid player token.'; end if;
  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if exists (
    select 1 from jsonb_array_elements(room_row.players) player
    where player->>'id' = p_player_id
  ) then return public.get_planning_poker_room(p_room_id); end if;
  if jsonb_array_length(room_row.players) >= 10 then raise exception 'This room has reached the 10-player limit.'; end if;

  update public.planning_poker_rooms
  set players = players || jsonb_build_array(jsonb_build_object('id', p_player_id, 'name', trim(p_player_name))),
      updated_at = now()
  where id = p_room_id;
  insert into public.planning_poker_player_auth (room_id, player_id, secret_hash)
  values (p_room_id, p_player_id, encode(digest(convert_to(p_player_token, 'UTF8'), 'sha256'), 'hex'));
  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.add_planning_poker_task(
  p_room_id text,
  p_admin_token text,
  p_task_id text,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select secret_hash into stored_hash from public.planning_poker_room_admin where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can add tasks.';
  end if;
  if length(trim(p_title)) not between 1 and 80 then raise exception 'Invalid task title.'; end if;

  update public.planning_poker_rooms
  set tasks = tasks || jsonb_build_array(jsonb_build_object('id', p_task_id, 'title', trim(p_title))),
      active_task_id = p_task_id,
      revealed = false,
      updated_at = now()
  where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.select_planning_poker_task(
  p_room_id text,
  p_admin_token text,
  p_task_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  room_row public.planning_poker_rooms%rowtype;
  stored_hash text;
begin
  select secret_hash into stored_hash from public.planning_poker_room_admin where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can select a task.';
  end if;
  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if not exists (
    select 1 from jsonb_array_elements(room_row.tasks) task
    where task->>'id' = p_task_id and not (task ? 'finalScore')
  ) then
    raise exception 'Task not found.';
  end if;

  update public.planning_poker_rooms set active_task_id = p_task_id, revealed = false, updated_at = now() where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

drop function if exists public.vote_planning_poker(text, text, text, text, integer);

create or replace function public.vote_planning_poker(
  p_room_id text,
  p_player_id text,
  p_player_token text,
  p_task_id text,
  p_score numeric,
  p_card_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  room_row public.planning_poker_rooms%rowtype;
  stored_player_hash text;
begin
  if p_score not in (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
    or p_card_label not in ('1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5')
    or p_score::text <> p_card_label then
    raise exception 'Invalid card value.';
  end if;
  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if room_row.active_task_id <> p_task_id then raise exception 'This task is not active.'; end if;
  if not exists (
    select 1 from jsonb_array_elements(room_row.players) player
    where player->>'id' = p_player_id
  ) then raise exception 'Player not found.'; end if;
  select secret_hash into stored_player_hash
  from public.planning_poker_player_auth
  where room_id = p_room_id and player_id = p_player_id;
  if stored_player_hash is null or stored_player_hash <> encode(digest(convert_to(p_player_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Invalid player session.';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(room_row.tasks) task
    where task->>'id' = p_task_id and not (task ? 'finalScore')
  ) then
    raise exception 'Task not found.';
  end if;
  insert into public.planning_poker_votes (room_id, task_id, player_id, score, card_label)
  values (p_room_id, p_task_id, p_player_id, p_score, p_card_label)
  on conflict (room_id, task_id, player_id) do update set score = excluded.score, card_label = excluded.card_label;
  update public.planning_poker_rooms
  set revealed = false, updated_at = now()
  where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.reveal_planning_poker_votes(
  p_room_id text,
  p_admin_token text,
  p_revealed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  room_row public.planning_poker_rooms%rowtype;
  active_task_index integer;
  next_task_id text;
  final_score numeric;
begin
  select secret_hash into stored_hash from public.planning_poker_room_admin where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can reveal the votes.';
  end if;
  if not p_revealed then raise exception 'A finalized task cannot be reopened.'; end if;

  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if room_row.active_task_id is null then raise exception 'There is no active task to finalize.'; end if;
  if not exists (
    select 1 from jsonb_array_elements(room_row.tasks) task
    where task->>'id' = room_row.active_task_id and not (task ? 'finalScore')
  ) then raise exception 'This task has already been finalized.'; end if;

  select avg(score) into final_score
  from public.planning_poker_votes
  where room_id = p_room_id and task_id = room_row.active_task_id;
  if final_score is null then raise exception 'At least one vote is required to finalize a task.'; end if;

  select task.ordinality - 1 into active_task_index
  from jsonb_array_elements(room_row.tasks) with ordinality as task(value, ordinality)
  where task.value->>'id' = room_row.active_task_id;

  room_row.tasks := jsonb_set(room_row.tasks, array[active_task_index::text, 'finalScore'], to_jsonb(final_score), true);

  select task.value->>'id' into next_task_id
  from jsonb_array_elements(room_row.tasks) with ordinality as task(value, ordinality)
  where not (task.value ? 'finalScore')
  order by task.ordinality
  limit 1;

  update public.planning_poker_rooms
  set tasks = room_row.tasks,
      active_task_id = next_task_id,
      revealed = false,
      updated_at = now()
  where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

revoke all on function public.get_planning_poker_room(text) from public;
revoke all on function public.create_planning_poker_room(text, text, text, text) from public;
revoke all on function public.join_planning_poker_room(text, text, text, text) from public;
revoke all on function public.add_planning_poker_task(text, text, text, text) from public;
revoke all on function public.select_planning_poker_task(text, text, text) from public;
revoke all on function public.vote_planning_poker(text, text, text, text, numeric, text) from public;
revoke all on function public.reveal_planning_poker_votes(text, text, boolean) from public;
grant execute on function public.get_planning_poker_room(text) to anon, authenticated;
grant execute on function public.create_planning_poker_room(text, text, text, text) to anon, authenticated;
grant execute on function public.join_planning_poker_room(text, text, text, text) to anon, authenticated;
grant execute on function public.add_planning_poker_task(text, text, text, text) to anon, authenticated;
grant execute on function public.select_planning_poker_task(text, text, text) to anon, authenticated;
grant execute on function public.vote_planning_poker(text, text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.reveal_planning_poker_votes(text, text, boolean) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'planning_poker_rooms'
  ) then
    alter publication supabase_realtime add table public.planning_poker_rooms;
  end if;
end;
$$;
