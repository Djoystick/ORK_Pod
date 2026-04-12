create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_users_active_idx
  on admin_users(is_active);

create index if not exists admin_users_email_idx
  on admin_users(email);

drop trigger if exists admin_users_set_updated_at on admin_users;
create trigger admin_users_set_updated_at
before update on admin_users
for each row execute procedure set_updated_at();

alter table if exists comments
  add column if not exists author_user_id uuid;

alter table if exists reactions
  add column if not exists actor_user_id uuid;

create index if not exists comments_author_user_idx
  on comments(author_user_id);

create index if not exists reactions_actor_user_idx
  on reactions(actor_user_id);

create unique index if not exists reactions_actor_user_single_per_item_uidx
  on reactions(content_item_id, actor_user_id)
  where actor_user_id is not null;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.is_active = true
  );
$$;

alter table if exists categories enable row level security;
alter table if exists series enable row level security;
alter table if exists tags enable row level security;
alter table if exists platforms enable row level security;
alter table if exists content_items enable row level security;
alter table if exists external_links enable row level security;
alter table if exists comments enable row level security;
alter table if exists reactions enable row level security;
alter table if exists source_channels enable row level security;
alter table if exists content_sources enable row level security;
alter table if exists import_runs enable row level security;
alter table if exists import_run_items enable row level security;
alter table if exists content_item_tags enable row level security;

drop policy if exists categories_public_read on categories;
create policy categories_public_read
  on categories for select
  to anon, authenticated
  using (true);

drop policy if exists series_public_read on series;
create policy series_public_read
  on series for select
  to anon, authenticated
  using (true);

drop policy if exists tags_public_read on tags;
create policy tags_public_read
  on tags for select
  to anon, authenticated
  using (true);

drop policy if exists platforms_public_read on platforms;
create policy platforms_public_read
  on platforms for select
  to anon, authenticated
  using (true);

drop policy if exists content_items_public_read on content_items;
create policy content_items_public_read
  on content_items for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists external_links_public_read on external_links;
create policy external_links_public_read
  on external_links for select
  to anon, authenticated
  using (
    exists (
      select 1
      from content_items ci
      where ci.id = external_links.content_item_id
        and ci.status = 'published'
    )
  );

drop policy if exists comments_public_read_approved on comments;
create policy comments_public_read_approved
  on comments for select
  to anon, authenticated
  using (status = 'approved');

drop policy if exists comments_admin_read_all on comments;
create policy comments_admin_read_all
  on comments for select
  to authenticated
  using (public.is_admin_user());

drop policy if exists comments_authenticated_insert_pending on comments;
create policy comments_authenticated_insert_pending
  on comments for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and status = 'pending'
    and moderation_status = 'pending_review'
  );

drop policy if exists comments_admin_update on comments;
create policy comments_admin_update
  on comments for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists comments_admin_delete on comments;
create policy comments_admin_delete
  on comments for delete
  to authenticated
  using (public.is_admin_user());

drop policy if exists reactions_public_read on reactions;
create policy reactions_public_read
  on reactions for select
  to anon, authenticated
  using (true);

drop policy if exists reactions_authenticated_insert on reactions;
create policy reactions_authenticated_insert
  on reactions for insert
  to authenticated
  with check (actor_user_id = auth.uid());

drop policy if exists reactions_authenticated_update_own on reactions;
create policy reactions_authenticated_update_own
  on reactions for update
  to authenticated
  using (actor_user_id = auth.uid())
  with check (actor_user_id = auth.uid());

drop policy if exists reactions_authenticated_delete_own on reactions;
create policy reactions_authenticated_delete_own
  on reactions for delete
  to authenticated
  using (actor_user_id = auth.uid());

drop policy if exists content_items_admin_manage on content_items;
create policy content_items_admin_manage
  on content_items for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists external_links_admin_manage on external_links;
create policy external_links_admin_manage
  on external_links for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists content_item_tags_admin_manage on content_item_tags;
create policy content_item_tags_admin_manage
  on content_item_tags for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists source_channels_admin_manage on source_channels;
create policy source_channels_admin_manage
  on source_channels for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists content_sources_admin_manage on content_sources;
create policy content_sources_admin_manage
  on content_sources for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists import_runs_admin_manage on import_runs;
create policy import_runs_admin_manage
  on import_runs for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists import_run_items_admin_manage on import_run_items;
create policy import_run_items_admin_manage
  on import_run_items for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());
