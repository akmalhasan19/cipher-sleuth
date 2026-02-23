create extension if not exists pgcrypto;

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  file_hash_sha256 text not null unique,
  filename_original text not null,
  filename_normalized text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  final_trust_score integer not null check (final_trust_score between 0 and 100),
  verdict text not null check (verdict in ('verified', 'suspicious', 'manipulated')),
  report_text text not null,
  agent_results_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists investigations_created_at_idx
  on public.investigations (created_at desc);

alter table public.investigations enable row level security;

drop policy if exists investigations_service_role_all on public.investigations;
create policy investigations_service_role_all
  on public.investigations
  for all
  to service_role
  using (true)
  with check (true);
