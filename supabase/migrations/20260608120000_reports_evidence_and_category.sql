-- Add category and evidence fields to reports
alter table public.reports
  add column category text not null default 'other',
  add column evidence_urls text[] not null default '{}'::text[],
  add column evidence_count integer not null default 0;

-- Grant update/select to authenticated (admins will need access via policies)
grant select, update on public.reports to authenticated;
