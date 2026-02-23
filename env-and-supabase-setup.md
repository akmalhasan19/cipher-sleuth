# Env Vars and Supabase Setup

## 1) Required Environment Variables

Copy `.env.example` to `.env`, then fill these values:

- `MAX_UPLOAD_MB` (default `5`)
- `ANALYZE_TIMEOUT_MS` (default `45000`)
- `GUEST_FREE_ANALYSIS_LIMIT` (default `1`)
- `GUEST_IP_DAILY_LIMIT` (default `15`)
- `GUEST_IP_HASH_SALT` (recommended random secret string)
- `ENABLE_LLM_ORCHESTRATOR` (`true`/`false`)
- `ENABLE_DUPLICATE_DETECTION` (`true`/`false`)
- `ENABLE_GUEST_CAPTCHA` (`true`/`false`)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (required if guest captcha enabled)
- `TURNSTILE_SECRET_KEY` (required if guest captcha enabled)
- `ENABLE_GUEST_IP_RATE_LIMIT` (`true`/`false`)
- `OPENAI_API_KEY` (optional if orchestrator enabled)
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `OPENAI_BASE_URL` (default `https://api.openai.com/v1`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default `evidence-assets`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2) Supabase Database Setup

Run migrations from:

- `supabase/migrations/202602230001_create_investigations.sql`
- `supabase/migrations/202602230002_guest_ip_daily_usage.sql`

It creates:

- table `public.investigations`
- unique key on `file_hash_sha256` (duplicate detection)
- index on `created_at`
- RLS enabled
- policy `investigations_service_role_all` for `service_role`
- table `public.guest_ip_daily_usage`
- RPC `public.increment_guest_ip_daily_usage(...)` for atomic per-IP daily counter
- RLS policy `guest_ip_daily_usage_service_role_all`

If migration was already applied before RLS patch, run these manually in SQL Editor:

```sql
alter table public.investigations enable row level security;

drop policy if exists investigations_service_role_all on public.investigations;
create policy investigations_service_role_all
  on public.investigations
  for all
  to service_role
  using (true)
  with check (true);
```

## 3) Supabase Storage Setup

Create bucket named by `SUPABASE_STORAGE_BUCKET` (default: `evidence-assets`).

- recommended visibility: private
- upload path format used by API: `<userId>/<fileHash>.<ext>`

## 4) Verification Checklist

Run:

```bash
npm test
npm run lint
npm run build
```

Then verify:

- First upload returns `source: "computed"`
- Second identical upload returns `source: "cache"`
- Report endpoint returns `application/pdf`
- If guest captcha enabled, request without token is rejected
- If guest daily limit exceeded, API returns `429`
