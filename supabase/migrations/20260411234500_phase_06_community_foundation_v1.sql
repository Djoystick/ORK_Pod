alter table if exists comments
  add column if not exists identity_mode text not null default 'guest_cookie_v1';

alter table if exists comments
  add column if not exists author_fingerprint text;

alter table if exists comments
  add constraint comments_identity_mode_check
  check (identity_mode in ('guest_cookie_v1'));

create index if not exists comments_identity_fingerprint_idx
  on comments(content_item_id, author_fingerprint);

create index if not exists comments_status_updated_idx
  on comments(status, updated_at desc);

create index if not exists reactions_actor_item_idx
  on reactions(content_item_id, actor_fingerprint);
