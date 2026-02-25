create table if not exists public.analysis_sessions (
  analysis_id text primary key,
  owner_user_id text,
  owner_guest_id text,
  filename_original text not null,
  filename_normalized text not null,
  file_hash_sha256 text not null,
  final_trust_score integer not null check (final_trust_score between 0 and 100),
  verdict text not null check (verdict in ('verified', 'suspicious', 'manipulated')),
  trust_score_breakdown_json jsonb not null,
  forensic_breakdown_json jsonb not null,
  generated_at timestamptz not null,
  report_text text not null,
  agent_results_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (owner_user_id is not null and owner_guest_id is null)
    or (owner_user_id is null and owner_guest_id is not null)
  )
);

create index if not exists analysis_sessions_generated_at_idx
  on public.analysis_sessions (generated_at desc);

create index if not exists analysis_sessions_owner_user_id_idx
  on public.analysis_sessions (owner_user_id)
  where owner_user_id is not null;

create index if not exists analysis_sessions_owner_guest_id_idx
  on public.analysis_sessions (owner_guest_id)
  where owner_guest_id is not null;

alter table public.analysis_sessions enable row level security;

drop policy if exists analysis_sessions_service_role_all on public.analysis_sessions;
create policy analysis_sessions_service_role_all
  on public.analysis_sessions
  for all
  to service_role
  using (true)
  with check (true);
