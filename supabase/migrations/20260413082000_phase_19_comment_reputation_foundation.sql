alter table if exists comments
  add column if not exists author_reputation_coefficient numeric(10, 3);

alter table if exists comments
  add column if not exists trust_decision text;

alter table if exists comments
  drop constraint if exists comments_trust_decision_check;

alter table if exists comments
  add constraint comments_trust_decision_check
  check (
    trust_decision is null
    or trust_decision in ('auto_publish', 'moderation_required', 'neutral_pending')
  );

create table if not exists comment_feedback (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  content_item_id uuid not null references content_items(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('up', 'down')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_fingerprint text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists comment_feedback_actor_user_per_comment_uidx
  on comment_feedback(comment_id, actor_user_id)
  where actor_user_id is not null;

create unique index if not exists comment_feedback_actor_fingerprint_per_comment_uidx
  on comment_feedback(comment_id, actor_fingerprint);

create index if not exists comment_feedback_comment_type_idx
  on comment_feedback(comment_id, feedback_type);

create index if not exists comment_feedback_content_item_idx
  on comment_feedback(content_item_id);

drop trigger if exists comment_feedback_set_updated_at on comment_feedback;
create trigger comment_feedback_set_updated_at
before update on comment_feedback
for each row execute procedure set_updated_at();

alter table if exists comment_feedback enable row level security;

drop policy if exists comment_feedback_public_read on comment_feedback;
create policy comment_feedback_public_read
  on comment_feedback for select
  using (true);

drop policy if exists comment_feedback_authenticated_insert on comment_feedback;
create policy comment_feedback_authenticated_insert
  on comment_feedback for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

drop policy if exists comment_feedback_authenticated_update_own on comment_feedback;
create policy comment_feedback_authenticated_update_own
  on comment_feedback for update
  to authenticated
  using (actor_user_id is null or actor_user_id = auth.uid())
  with check (actor_user_id is null or actor_user_id = auth.uid());

drop policy if exists comment_feedback_authenticated_delete_own on comment_feedback;
create policy comment_feedback_authenticated_delete_own
  on comment_feedback for delete
  to authenticated
  using (actor_user_id is null or actor_user_id = auth.uid());
