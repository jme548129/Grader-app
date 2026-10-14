-- GradeScan / Grader backend schema for Supabase.
-- Safe to run on an existing project: creates missing objects and adds new columns.

create table if not exists public.profiles(
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  school text,
  created_at timestamptz default now(),
  last_seen timestamptz default now(),
  scans int not null default 0
);

create table if not exists public.results(
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id text,
  exam_type text,
  exam_title text,
  student_id text,
  student_name text,
  score int,
  total int,
  answers jsonb not null default '[]'::jsonb,
  answer_key jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Add fields when upgrading an existing version of the app.
alter table public.results add column if not exists client_id text;
alter table public.results add column if not exists answer_key jsonb not null default '[]'::jsonb;
alter table public.results add column if not exists answers jsonb not null default '[]'::jsonb;
alter table public.results add column if not exists created_at timestamptz not null default now();
create unique index if not exists results_user_client_unique on public.results(user_id, client_id);
create index if not exists results_user_exam_created_idx on public.results(user_id, exam_type, exam_title, created_at desc);

create table if not exists public.admins(
  user_id uuid primary key references auth.users on delete cascade
);

alter table public.profiles enable row level security;
alter table public.results enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

-- Only own profile or admins can read profile rows.
drop policy if exists "profiles: sarili o admin" on public.profiles;
create policy "profiles: sarili o admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Teachers can only read their own results; admins can read all.
drop policy if exists "results: sarili o admin" on public.results;
create policy "results: sarili o admin" on public.results
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Inserts and upserts must always stay within the signed-in user's account.
drop policy if exists "results: insert sarili" on public.results;
create policy "results: insert sarili" on public.results
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "results: update sarili" on public.results;
create policy "results: update sarili" on public.results
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,email,full_name,school)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'school')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch()
returns void language sql security definer set search_path = public
as $$ update public.profiles set last_seen=now() where id=auth.uid(); $$;

-- Count scans only when a new result row is inserted (not when an upsert updates it).
create or replace function public.count_result_scan()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set scans=scans+1, last_seen=now() where id=new.user_id;
  return new;
end;
$$;
drop trigger if exists result_insert_count_scan on public.results;
create trigger result_insert_count_scan after insert on public.results
  for each row execute function public.count_result_scan();

insert into public.profiles(id,email,full_name,school)
select id,email,raw_user_meta_data->>'full_name',raw_user_meta_data->>'school'
from auth.users
on conflict (id) do nothing;

-- Optional initial admin seed. Change the email before running if needed.
insert into public.admins(user_id)
select id from auth.users where email = 'jme548129@gmail.com'
on conflict do nothing;
