-- The whole memory layer: identity, the cached chart, reading history, and the vector index.
--
-- Two invariants are enforced by the schema rather than by application code, because a promise
-- that lives in a comment is a promise that gets broken during a refactor:
--   1. charts.user_id is the primary key, so a natal chart can exist exactly once per account.
--   2. profiles and charts have no update or delete policy, so birth data and the chart computed
--      from it cannot drift apart after onboarding.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  birth_date date not null,
  birth_time time not null,
  birth_place text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone text not null,
  tone_preset text not null default 'warm',
  created_at timestamptz not null default now()
);

comment on column public.profiles.timezone is
  'IANA identifier, never a numeric offset. The offset in force on a birth date is not the offset in force today.';

alter table public.profiles enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "a person creates only their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- charts
-- ---------------------------------------------------------------------------

create table public.charts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  natal jsonb not null,
  computed_at timestamptz not null default now()
);

comment on table public.charts is
  'One natal chart per account, for the life of the account. The primary key on user_id is what makes a second calculation impossible rather than merely discouraged.';

alter table public.charts enable row level security;

create policy "charts are readable by their owner"
  on public.charts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "a person stores only their own chart"
  on public.charts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- readings
-- ---------------------------------------------------------------------------

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  data jsonb not null,
  shown text not null,
  created_at timestamptz not null default now()
);

create index readings_user_created_idx on public.readings (user_id, created_at desc);

alter table public.readings enable row level security;

create policy "readings are readable by their owner"
  on public.readings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "a person appends only their own readings"
  on public.readings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "a person may erase their own readings"
  on public.readings for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- memories
-- ---------------------------------------------------------------------------

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reading_id uuid references public.readings (id) on delete cascade,
  content text not null,
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now()
);

comment on column public.memories.embedding is
  '768 dimensions. Every supported embedding model is asked for exactly this width, so changing it means changing the column, the index, and match_memories together.';

create index memories_user_created_idx on public.memories (user_id, created_at desc);
create index memories_embedding_idx on public.memories
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.memories enable row level security;

create policy "memories are readable by their owner"
  on public.memories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "a person appends only their own memories"
  on public.memories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "a person may erase their own memories"
  on public.memories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- semantic recall
-- ---------------------------------------------------------------------------

-- security invoker is load bearing. A security definer function would run as its owner and skip
-- every policy above, which would hand any signed in caller the whole table through one call.
-- Invoker keeps the caller identity, so the select policy on memories still applies inside the
-- body, and the explicit auth.uid() filter lets the planner use the index instead of scanning.
--
-- search_path is emptied to pin every name, which is why the distance operator is written in its
-- fully qualified form.
create function public.match_memories(
  query_embedding extensions.vector(768),
  match_count int
)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.content,
    m.created_at,
    1 - (m.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.memories m
  where m.user_id = (select auth.uid())
  order by m.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

grant execute on function public.match_memories(extensions.vector(768), int) to authenticated;
