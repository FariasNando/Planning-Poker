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
          'voterIds', coalesce(vote_summary.voter_ids, '[]'::jsonb),
          'voteCount', coalesce(vote_summary.vote_count, 0),
          'finalScore', task.value->'finalScore'
        ) order by task.ordinality
      )
      from jsonb_array_elements(room_row.tasks) with ordinality as task(value, ordinality)
      left join lateral (
        select
          jsonb_object_agg(vote.player_id, vote.score) as vote_map,
          jsonb_object_agg(vote.player_id, vote.card_label) as vote_label_map,
          jsonb_agg(vote.player_id) as voter_ids,
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
  stored_player_hash text;
begin
  if length(trim(p_player_name)) not between 1 and 28 then raise exception 'Invalid name.'; end if;
  if length(p_player_token) < 32 then raise exception 'Invalid player token.'; end if;
  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if exists (
    select 1 from jsonb_array_elements(room_row.players) player
    where player->>'id' = p_player_id
  ) then
    select secret_hash into stored_player_hash
    from public.planning_poker_player_auth
    where room_id = p_room_id and player_id = p_player_id;
    if stored_player_hash is null or stored_player_hash <> encode(digest(convert_to(p_player_token, 'UTF8'), 'sha256'), 'hex') then
      raise exception 'Invalid player session.';
    end if;
    return public.get_planning_poker_room(p_room_id);
  end if;
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

  perform 1 from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;

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
  room_row.tasks := jsonb_set(room_row.tasks, array[active_task_index::text, 'finalizedAt'], to_jsonb(extract(epoch from now())::bigint), true);

  update public.planning_poker_rooms
  set tasks = room_row.tasks,
      revealed = true,
      updated_at = now()
  where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.advance_planning_poker_task(
  p_room_id text,
  p_admin_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  room_row public.planning_poker_rooms%rowtype;
  next_task_id text;
begin
  select secret_hash into stored_hash from public.planning_poker_room_admin where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can advance to the next task.';
  end if;

  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if room_row.active_task_id is null then raise exception 'There is no active task to advance from.'; end if;
  if not exists (
    select 1 from jsonb_array_elements(room_row.tasks) task
    where task->>'id' = room_row.active_task_id and (task ? 'finalScore')
  ) then raise exception 'The current task must be finalized before advancing.'; end if;

  select task.value->>'id' into next_task_id
  from jsonb_array_elements(room_row.tasks) with ordinality as task(value, ordinality)
  where not (task.value ? 'finalScore')
  order by task.ordinality
  limit 1;

  update public.planning_poker_rooms
  set active_task_id = next_task_id,
      revealed = false,
      updated_at = now()
  where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.reset_planning_poker_room(
  p_room_id text,
  p_admin_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select secret_hash into stored_hash
  from public.planning_poker_room_admin
  where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can reset this room.';
  end if;

  perform 1 from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;

  delete from public.planning_poker_votes where room_id = p_room_id;
  update public.planning_poker_rooms
  set tasks = '[]'::jsonb,
      active_task_id = null,
      revealed = false,
      updated_at = now()
  where id = p_room_id;

  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.remove_planning_poker_player(
  p_room_id text,
  p_admin_token text,
  p_player_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  room_row public.planning_poker_rooms%rowtype;
begin
  select secret_hash into stored_hash
  from public.planning_poker_room_admin
  where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can remove players.';
  end if;

  select * into room_row from public.planning_poker_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if p_player_id = room_row.admin_id then raise exception 'The admin cannot be removed.'; end if;
  if not exists (
    select 1 from jsonb_array_elements(room_row.players) player
    where player->>'id' = p_player_id
  ) then raise exception 'Player not found.'; end if;

  delete from public.planning_poker_votes
  where room_id = p_room_id and player_id = p_player_id;
  delete from public.planning_poker_player_auth
  where room_id = p_room_id and player_id = p_player_id;
  update public.planning_poker_rooms
  set players = coalesce((
        select jsonb_agg(player.value order by player.ordinality)
        from jsonb_array_elements(room_row.players) with ordinality as player(value, ordinality)
        where player.value->>'id' <> p_player_id
      ), '[]'::jsonb),
      updated_at = now()
  where id = p_room_id;
  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.leave_planning_poker_room(
  p_room_id text,
  p_player_id text,
  p_player_token text
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
  select * into room_row
  from public.planning_poker_rooms
  where id = p_room_id
  for update;
  if not found then raise exception 'Room not found.'; end if;
  if p_player_id = room_row.admin_id then raise exception 'The admin must close the room instead of leaving.'; end if;
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

  update public.planning_poker_rooms
  set players = coalesce((
        select jsonb_agg(player.value order by player.ordinality)
        from jsonb_array_elements(room_row.players) with ordinality as player(value, ordinality)
        where player.value->>'id' <> p_player_id
      ), '[]'::jsonb),
      updated_at = now()
  where id = p_room_id;
  delete from public.planning_poker_player_auth
  where room_id = p_room_id and player_id = p_player_id;

  return public.get_planning_poker_room(p_room_id);
end;
$$;

create or replace function public.close_planning_poker_room(
  p_room_id text,
  p_admin_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  deleted_room_id text;
begin
  select secret_hash into stored_hash
  from public.planning_poker_room_admin
  where room_id = p_room_id;
  if stored_hash is null or stored_hash <> encode(digest(convert_to(p_admin_token, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Only the admin can close this room.';
  end if;

  delete from public.planning_poker_rooms
  where id = p_room_id
  returning id into deleted_room_id;
  if deleted_room_id is null then raise exception 'Room not found.'; end if;

  return jsonb_build_object('closed', true, 'roomId', deleted_room_id);
end;
$$;

revoke all on function public.get_planning_poker_room(text) from public;
revoke all on function public.create_planning_poker_room(text, text, text, text) from public;
revoke all on function public.join_planning_poker_room(text, text, text, text) from public;
revoke all on function public.add_planning_poker_task(text, text, text, text) from public;
revoke all on function public.select_planning_poker_task(text, text, text) from public;
revoke all on function public.vote_planning_poker(text, text, text, text, numeric, text) from public;
revoke all on function public.reveal_planning_poker_votes(text, text, boolean) from public;
revoke all on function public.reset_planning_poker_room(text, text) from public;
revoke all on function public.remove_planning_poker_player(text, text, text) from public;
revoke all on function public.leave_planning_poker_room(text, text, text) from public;
revoke all on function public.advance_planning_poker_task(text, text) from public;
revoke all on function public.close_planning_poker_room(text, text) from public;
grant execute on function public.get_planning_poker_room(text) to anon, authenticated;
grant execute on function public.create_planning_poker_room(text, text, text, text) to anon, authenticated;
grant execute on function public.join_planning_poker_room(text, text, text, text) to anon, authenticated;
grant execute on function public.add_planning_poker_task(text, text, text, text) to anon, authenticated;
grant execute on function public.select_planning_poker_task(text, text, text) to anon, authenticated;
grant execute on function public.vote_planning_poker(text, text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.reveal_planning_poker_votes(text, text, boolean) to anon, authenticated;
grant execute on function public.reset_planning_poker_room(text, text) to anon, authenticated;
grant execute on function public.remove_planning_poker_player(text, text, text) to anon, authenticated;
grant execute on function public.leave_planning_poker_room(text, text, text) to anon, authenticated;
grant execute on function public.advance_planning_poker_task(text, text) to anon, authenticated;
grant execute on function public.close_planning_poker_room(text, text) to anon, authenticated;

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

-- Cleanup function: removes rooms inactive for 7+ days and finalized tasks older than 3 days
create or replace function public.cleanup_planning_poker_data()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  room_rec record;
  cleaned_tasks jsonb;
  task_ids_to_clean text[];
begin
  -- Delete rooms with no activity for more than 7 days
  delete from public.planning_poker_rooms
  where updated_at < now() - interval '7 days';

  -- Remove finalized tasks older than 3 days from each remaining room
  for room_rec in
    select id, tasks from public.planning_poker_rooms
    where tasks != '[]'::jsonb
  loop
    select array_agg(task->>'id')
    into task_ids_to_clean
    from jsonb_array_elements(room_rec.tasks) as task
    where (task ? 'finalizedAt')
      and to_timestamp((task->>'finalizedAt')::bigint) < now() - interval '3 days';

    continue when task_ids_to_clean is null;

    select coalesce(jsonb_agg(t.task order by t.task_ord), '[]'::jsonb)
    into cleaned_tasks
    from jsonb_array_elements(room_rec.tasks) with ordinality as t(task, task_ord)
    where not (t.task->>'id' = any(task_ids_to_clean));

    delete from public.planning_poker_votes
    where room_id = room_rec.id and task_id = any(task_ids_to_clean);

    update public.planning_poker_rooms
    set tasks = cleaned_tasks,
        updated_at = now()
    where id = room_rec.id;
  end loop;
end;
$$;

revoke all on function public.cleanup_planning_poker_data() from public;

-- pg_cron: run cleanup every day at 03:00 UTC
-- Requires pg_cron extension enabled in Supabase dashboard
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cleanup-planning-poker-data',
  '0 3 * * *',
  $$ select public.cleanup_planning_poker_data(); $$
)
where not exists (
  select 1 from cron.job where jobname = 'cleanup-planning-poker-data'
);
