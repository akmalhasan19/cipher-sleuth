create table if not exists public.guest_ip_daily_usage (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null,
  ip_hash text not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (usage_date, ip_hash)
);

create index if not exists guest_ip_daily_usage_usage_date_idx
  on public.guest_ip_daily_usage (usage_date desc);

alter table public.guest_ip_daily_usage enable row level security;

drop policy if exists guest_ip_daily_usage_service_role_all on public.guest_ip_daily_usage;
create policy guest_ip_daily_usage_service_role_all
  on public.guest_ip_daily_usage
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.increment_guest_ip_daily_usage(
  p_usage_date date,
  p_ip_hash text,
  p_limit integer
)
returns table (request_count integer, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.guest_ip_daily_usage (
    usage_date,
    ip_hash,
    request_count,
    updated_at
  )
  values (
    p_usage_date,
    p_ip_hash,
    1,
    timezone('utc', now())
  )
  on conflict (usage_date, ip_hash)
  do update
    set request_count = public.guest_ip_daily_usage.request_count + 1,
        updated_at = timezone('utc', now())
  returning public.guest_ip_daily_usage.request_count into v_count;

  return query
  select v_count, v_count <= p_limit;
end;
$$;

grant execute on function public.increment_guest_ip_daily_usage(date, text, integer)
  to service_role;
