-- Run this in Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → paste this → Run

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  bio text default '',
  avatar_url text default '',
  tools_used integer default 0,
  chats_sent integer default 0,
  images_generated integer default 0,
  created_at timestamp with time zone default now()
);

-- Allow users to read/write only their own profile
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow username uniqueness check (public read for username only)
create policy "Anyone can check username availability"
  on public.profiles for select
  using (true);

-- Storage bucket for avatars
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
