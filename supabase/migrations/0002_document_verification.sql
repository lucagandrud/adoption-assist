-- Persist synthetic uploaded-document metadata and extracted facts.
-- File bytes are intentionally never stored by this prototype.

create table if not exists public.documents (
  id              text        primary key,
  case_id         text        not null references public.cases (id) on delete cascade,
  definition_id   text        not null,
  file_name       text        not null,
  mime_type       text        not null,
  issue_date      date,
  extraction_mode text        not null
                              check (extraction_mode in ('synthetic_cache', 'live_anthropic')),
  facts           jsonb       not null default '[]'::jsonb
                              check (jsonb_typeof(facts) = 'array'),
  uploaded_at     timestamptz not null default now(),
  unique (case_id, definition_id)
);

create index if not exists documents_case_idx
  on public.documents (case_id, uploaded_at);

alter table public.documents enable row level security;

drop policy if exists "caseworker reads documents on own cases" on public.documents;
create policy "caseworker reads documents on own cases"
  on public.documents for select
  using (
    exists (
      select 1 from public.cases c
      where c.id = documents.case_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "caseworker adds documents to own cases" on public.documents;
create policy "caseworker adds documents to own cases"
  on public.documents for insert
  with check (
    exists (
      select 1 from public.cases c
      where c.id = documents.case_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "caseworker updates documents on own cases" on public.documents;
create policy "caseworker updates documents on own cases"
  on public.documents for update
  using (
    exists (
      select 1 from public.cases c
      where c.id = documents.case_id
        and c.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cases c
      where c.id = documents.case_id
        and c.owner_user_id = auth.uid()
    )
  );

drop policy if exists "caseworker deletes documents on own cases" on public.documents;
create policy "caseworker deletes documents on own cases"
  on public.documents for delete
  using (
    exists (
      select 1 from public.cases c
      where c.id = documents.case_id
        and c.owner_user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.documents to authenticated;
