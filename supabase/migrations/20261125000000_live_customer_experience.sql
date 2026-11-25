create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  subject text not null check (char_length(subject) between 3 and 160),
  details text not null check (char_length(details) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

create policy "users read own support tickets"
  on public.support_tickets for select using (auth.uid() = user_id);

create policy "users create own support tickets"
  on public.support_tickets for insert with check (auth.uid() = user_id and status = 'open');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Mova Verify User'),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance_naira)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name, email)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(email, '@', 1), 'Mova Verify User'),
  coalesce(email, '')
from auth.users
on conflict (id) do nothing;

insert into public.wallets (user_id, balance_naira)
select id, 0 from auth.users
on conflict (user_id) do nothing;
