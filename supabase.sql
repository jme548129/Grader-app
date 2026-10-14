-- I-run sa Supabase: SQL Editor > New query > Run

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  email text, full_name text, school text,
  created_at timestamptz default now(),
  last_seen timestamptz default now(),
  scans int default 0
);
create table results(
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users on delete cascade,
  exam_type text, exam_title text, student_id text, student_name text,
  score int, total int, answers jsonb,
  created_at timestamptz default now()
);
create table admins(user_id uuid primary key references auth.users on delete cascade);

alter table profiles enable row level security;
alter table results enable row level security;
alter table admins enable row level security;

create function is_admin() returns boolean language sql security definer stable set search_path=public
as $$ select exists(select 1 from admins where user_id=auth.uid()) $$;

create policy "profiles: sarili o admin" on profiles for select using (id=auth.uid() or is_admin());
create policy "results: sarili o admin" on results for select using (user_id=auth.uid() or is_admin());
create policy "results: insert sarili" on results for insert with check (user_id=auth.uid());

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into profiles(id,email,full_name,school)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'school');
  return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function touch() returns void language sql security definer set search_path=public
as $$ update profiles set last_seen=now() where id=auth.uid() $$;
create function bump_scan() returns void language sql security definer set search_path=public
as $$ update profiles set scans=scans+1, last_seen=now() where id=auth.uid() $$;

-- Gawing admin ang sarili mo (palitan ang email, i-run pagkatapos mong mag-sign up sa app):
-- insert into admins select id from auth.users where email='iyong-email@example.com';
