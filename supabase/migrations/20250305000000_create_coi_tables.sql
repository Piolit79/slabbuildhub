-- COIs table
create table if not exists public.cois (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  vendor_id text,
  insured_name text not null,
  company text,
  carrier text,
  policy_number text,
  effective_date date,
  expiration_date date not null,
  gl_policy_number text,
  gl_carrier text,
  gl_effective_date date,
  gl_expiration_date date,
  gl_coverage_limit text,
  gl_per_occurrence_limit text,
  gl_aggregate_limit text,
  gl_provisions jsonb default '[]'::jsonb,
  wc_policy_number text,
  wc_carrier text,
  wc_effective_date date,
  wc_expiration_date date,
  umbrella_policy_number text,
  umbrella_carrier text,
  umbrella_limit text,
  umbrella_effective_date date,
  umbrella_expiration_date date,
  additional_insured text,
  certificate_holder text,
  is_active boolean default true,
  contact_email1 text,
  contact_email2 text,
  created_at timestamptz default now()
);

-- COI files table (metadata; actual files stored in Supabase Storage)
create table if not exists public.coi_files (
  id uuid primary key default gen_random_uuid(),
  coi_id uuid references public.cois(id) on delete set null,
  project_id text not null,
  file_name text not null,
  file_path text not null,
  file_size integer,
  uploaded_at timestamptz default now()
);

-- Enable RLS
alter table public.cois enable row level security;
alter table public.coi_files enable row level security;

-- Open policies (add auth-scoped policies later when auth is added)
create policy "Allow all on cois" on public.cois for all using (true) with check (true);
create policy "Allow all on coi_files" on public.coi_files for all using (true) with check (true);
