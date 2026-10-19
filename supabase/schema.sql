-- 428third — database schema (Supabase / Postgres)
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste this ENTIRE file → Run.
-- Idempotent: safe to run again after a change. Takes a few seconds.
--
-- Access model: membership and role come from public.allowed_emails, matched against the
-- signed-in user's JWT email. No trigger on auth.users is needed. Someone who signs in but is
-- not on the list gets a session that can read nothing (every policy checks is_member()).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email       text primary key,                 -- stored lower-case
  role        text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  added_at    timestamptz not null default now()
);

-- Display info for members; each user upserts their own row on first sign-in.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text,
  created_at  timestamptz not null default now()
);

create or replace function public.jwt_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.allowed_emails where email = public.jwt_email()
$$;

create or replace function public.is_member()
returns boolean language sql stable as $$
  select public.my_role() is not null
$$;

create or replace function public.can_edit()
returns boolean language sql stable as $$
  select public.my_role() in ('owner', 'editor')
$$;

create or replace function public.is_owner()
returns boolean language sql stable as $$
  select public.my_role() = 'owner'
$$;

-- ---------------------------------------------------------------------------
-- Scene
-- ---------------------------------------------------------------------------
create table if not exists public.scenes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  model_url    text,
  calibration  jsonb not null default '{}'::jsonb,   -- {scale, rotY, offset:[x,y,z]} from the tape check
  floor_y      double precision not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.catalog_items (
  key          text primary key,
  name         text not null,
  category     text not null,
  w            double precision not null,
  d            double precision not null,
  h            double precision not null,
  default_hex  text not null,
  model_url    text
);

create table if not exists public.objects (
  id           uuid primary key default gen_random_uuid(),
  scene_id     uuid not null references public.scenes (id) on delete cascade,
  catalog_key  text not null,
  label        text not null,
  x            double precision not null default 0,
  y            double precision not null default 0,
  z            double precision not null default 0,
  rot_y        double precision not null default 0,
  scale        double precision not null default 1,
  hex          text not null,
  locked       boolean not null default false,
  notes        text,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index if not exists objects_scene_idx on public.objects (scene_id);

create table if not exists public.surfaces (
  id        uuid primary key default gen_random_uuid(),
  scene_id  uuid not null references public.scenes (id) on delete cascade,
  name      text not null,
  quad      jsonb not null   -- {corners:[[x,y,z]x4], normal:[x,y,z]}
);

create table if not exists public.finishes (
  id          uuid primary key default gen_random_uuid(),
  surface_id  uuid not null references public.surfaces (id) on delete cascade,
  hex         text not null,
  color_name  text,
  brand_code  text,
  sheen       text,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists finishes_surface_idx on public.finishes (surface_id);

create table if not exists public.views (
  id        uuid primary key default gen_random_uuid(),
  scene_id  uuid not null references public.scenes (id) on delete cascade,
  name      text not null,
  camera    jsonb not null   -- {position:[x,y,z], target:[x,y,z]}
);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table if not exists public.task_lists (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  sort  integer not null default 0
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.task_lists (id) on delete cascade,
  title       text not null,
  status      text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  assignee    uuid references public.profiles (id) on delete set null,
  due         date,
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  object_id   uuid references public.objects (id) on delete set null,
  surface_id  uuid references public.surfaces (id) on delete set null,
  notes       text,
  sort        integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_list_idx on public.tasks (list_id);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  starts      timestamptz not null,
  ends        timestamptz not null,
  type        text not null default 'event' check (type in ('delivery', 'install', 'inspection', 'event', 'programming', 'other')),
  zone        text,
  task_id     uuid references public.tasks (id) on delete set null,
  notes       text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  title       text not null,
  url         text,
  file_path   text,          -- path in the 'resources' storage bucket
  notes       text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at / updated_by maintenance (objects, finishes, tasks all have both columns)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['objects', 'finishes', 'tasks'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security: members read; editors/owners write; owners manage the allow-list.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'scenes', 'catalog_items', 'objects', 'surfaces', 'finishes',
    'views', 'task_lists', 'tasks', 'events', 'resources'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s read" on public.%1$s', t);
    execute format('create policy "%1$s read" on public.%1$s for select using (public.is_member())', t);
    execute format('drop policy if exists "%1$s write" on public.%1$s', t);
    execute format('create policy "%1$s write" on public.%1$s for all using (public.can_edit()) with check (public.can_edit())', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (public.is_member());
drop policy if exists "profiles self write" on public.profiles;
create policy "profiles self write" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid() and public.is_member());

alter table public.allowed_emails enable row level security;
drop policy if exists "allowed_emails owner" on public.allowed_emails;
create policy "allowed_emails owner" on public.allowed_emails
  for all using (public.is_owner()) with check (public.is_owner());

-- Keep emails lower-case so JWT matching is exact.
create or replace function public.lower_email()
returns trigger language plpgsql as $$
begin
  new.email = lower(new.email);
  return new;
end $$;
drop trigger if exists allowed_emails_lower on public.allowed_emails;
create trigger allowed_emails_lower before insert or update on public.allowed_emails
  for each row execute function public.lower_email();

-- ---------------------------------------------------------------------------
-- Realtime: broadcast changes on the tables the UI subscribes to (idempotent).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['objects', 'finishes', 'tasks', 'events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for resources (private). If this block reports a privilege notice,
-- create the bucket "resources" in Storage → New bucket (private) and add the two
-- policies there; everything above has still been applied.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public) values ('resources', 'resources', false)
  on conflict (id) do nothing;
  drop policy if exists "resources read" on storage.objects;
  create policy "resources read" on storage.objects for select
    using (bucket_id = 'resources' and public.is_member());
  drop policy if exists "resources write" on storage.objects;
  create policy "resources write" on storage.objects for all
    using (bucket_id = 'resources' and public.can_edit())
    with check (bucket_id = 'resources' and public.can_edit());
exception when insufficient_privilege then
  raise notice 'storage: insufficient privilege — create the "resources" bucket and its policies in the dashboard';
end $$;

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------
insert into public.scenes (id, name) values
  ('00000000-0000-0000-0000-000000000001', '428 3rd St — showroom')
on conflict (id) do nothing;

insert into public.task_lists (name, sort) values
  ('Build-out', 1), ('Launch event', 2), ('Vendors', 3), ('Punch list', 4)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- TEAM ALLOW-LIST — edit and run this part. Nobody can read anything until they are listed.
-- ---------------------------------------------------------------------------
-- insert into public.allowed_emails (email, role) values
--   ('you@example.com', 'owner'),
--   ('teammate@example.com', 'editor'),
--   ('viewer@example.com', 'viewer')
-- on conflict (email) do update set role = excluded.role;
