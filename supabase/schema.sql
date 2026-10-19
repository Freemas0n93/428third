-- 428third — database schema (Supabase / Postgres)
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  name        text,
  role        text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at  timestamptz not null default now()
);

-- Allow-list: only these emails may sign in. Rows are inserted by an owner.
create table if not exists public.allowed_emails (
  email  text primary key,
  role   text not null default 'editor' check (role in ('owner', 'editor', 'viewer'))
);

-- Auto-create a profile when an allowed user signs in the first time.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.allowed_emails where email = new.email;
  if r is null then
    raise exception 'email % is not on the allow-list', new.email;
  end if;
  insert into public.profiles (id, email, role) values (new.id, new.email, r)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.can_edit()
returns boolean language sql stable as $$
  select public.my_role() in ('owner', 'editor')
$$;

-- ---------------------------------------------------------------------------
-- Scene
-- ---------------------------------------------------------------------------
create table if not exists public.scenes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  model_url    text,
  calibration  jsonb not null default '{}'::jsonb,   -- {scale, rotY, offset:[x,y,z]}
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
  catalog_key  text not null references public.catalog_items (key),
  label        text not null,
  x            double precision not null default 0,
  y            double precision not null default 0,
  z            double precision not null default 0,
  rot_y        double precision not null default 0,
  scale        double precision not null default 1,
  hex          text not null,
  locked       boolean not null default false,
  notes        text,
  updated_by   uuid references public.profiles (id),
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
  updated_by  uuid references public.profiles (id),
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
  name  text not null,
  sort  integer not null default 0
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.task_lists (id) on delete cascade,
  title       text not null,
  status      text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  assignee    uuid references public.profiles (id),
  due         date,
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  object_id   uuid references public.objects (id) on delete set null,
  surface_id  uuid references public.surfaces (id) on delete set null,
  notes       text,
  sort        integer not null default 0,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_list_idx on public.tasks (list_id);

create table if not exists public.events (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  starts    timestamptz not null,
  ends      timestamptz not null,
  type      text not null default 'event' check (type in ('delivery', 'install', 'inspection', 'event', 'programming', 'other')),
  zone      text,
  task_id   uuid references public.tasks (id) on delete set null,
  notes     text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  title      text not null,
  url        text,
  file_path  text,          -- path in the 'resources' storage bucket
  notes      text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
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
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security: any signed-in allow-listed user reads; editors/owners write.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'scenes', 'catalog_items', 'objects', 'surfaces', 'finishes',
    'views', 'task_lists', 'tasks', 'events', 'resources'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s read" on public.%1$s', t);
    execute format('create policy "%1$s read" on public.%1$s for select using (auth.uid() is not null)', t);
    if t <> 'profiles' then
      execute format('drop policy if exists "%1$s write" on public.%1$s', t);
      execute format('create policy "%1$s write" on public.%1$s for all using (public.can_edit()) with check (public.can_edit())', t);
    end if;
  end loop;
end $$;

-- Profiles: users may update their own name only; owners manage roles.
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.allowed_emails enable row level security;
drop policy if exists "allowed_emails owner" on public.allowed_emails;
create policy "allowed_emails owner" on public.allowed_emails
  for all using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

-- Realtime: broadcast changes on the tables the UI subscribes to.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.objects, public.finishes, public.tasks, public.events;

-- Storage bucket for resources (private; RLS on storage.objects).
insert into storage.buckets (id, name, public) values ('resources', 'resources', false)
on conflict (id) do nothing;
drop policy if exists "resources read" on storage.objects;
create policy "resources read" on storage.objects for select
  using (bucket_id = 'resources' and auth.uid() is not null);
drop policy if exists "resources write" on storage.objects;
create policy "resources write" on storage.objects for all
  using (bucket_id = 'resources' and public.can_edit())
  with check (bucket_id = 'resources' and public.can_edit());

-- ---------------------------------------------------------------------------
-- Seed: the showroom scene and default task lists
-- ---------------------------------------------------------------------------
insert into public.scenes (id, name) values
  ('00000000-0000-0000-0000-000000000001', '428 3rd St — showroom')
on conflict (id) do nothing;

insert into public.task_lists (name, sort) values
  ('Build-out', 1), ('Launch event', 2), ('Vendors', 3), ('Punch list', 4)
on conflict do nothing;

-- Owner allow-list entry — replace with the real owner email before running.
-- insert into public.allowed_emails (email, role) values ('owner@example.com', 'owner') on conflict do nothing;
