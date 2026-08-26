-- Pulso: core schema
-- Single-studio MVP (no multi-gym support: add a gym_id column later if the
-- business ever expands to more than one location).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users). Supabase has no built-in profile JSONB
-- (unlike InsForge), so display name/avatar live here, populated by a
-- trigger on auth.users insert (see access-control migration).
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- admins: presence of a row = admin. Populated only via SQL editor/migration
-- or an admin-only RPC -- never via a client-facing insert/update policy.
-- No client-writable role field anywhere, so there's no escalation vector.
-- ---------------------------------------------------------------------------
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- memberships (one active membership per user)
-- ---------------------------------------------------------------------------
create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text not null default 'Standard',
  credits_per_cycle int not null default 10,
  weekly_goal int not null default 3,
  cycle_start date not null default date_trunc('month', now())::date,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at timestamptz not null default now()
);
create unique index one_active_membership_per_user on memberships (user_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- credit_transactions: append-only ledger, source of truth for balance
-- ---------------------------------------------------------------------------
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  type text not null check (type in ('grant', 'booking', 'cancel_refund', 'no_show_penalty', 'admin_adjustment')),
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index on credit_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- bikes: fixed studio inventory
-- ---------------------------------------------------------------------------
create table bikes (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  trainer_name text not null,
  starts_at timestamptz not null,
  duration_minutes int not null default 45,
  capacity int not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);
create index on classes (starts_at);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
create table reservations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bike_id uuid not null references bikes(id),
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'attended', 'no_show')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
-- a bike can only be actively booked by one reservation per class
create unique index one_bike_per_class on reservations (class_id, bike_id) where status = 'booked';
-- a user can only hold one active booking per class
create unique index one_booking_per_user_per_class on reservations (class_id, user_id) where status = 'booked';
create index on reservations (user_id, created_at desc);
create index on reservations (class_id);

-- ---------------------------------------------------------------------------
-- waitlist_entries
-- ---------------------------------------------------------------------------
create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bike_id uuid references bikes(id),
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'claimed', 'expired', 'cancelled')),
  offer_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_waitlist_entry_per_user_per_class on waitlist_entries (class_id, user_id) where status in ('waiting', 'offered');
create index on waitlist_entries (class_id, status, created_at);

-- ---------------------------------------------------------------------------
-- xp_transactions: append-only ledger, source of truth for XP
-- ---------------------------------------------------------------------------
create table xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  type text not null check (type in ('class_completed', 'streak_bonus', 'weekly_goal', 'achievement', 'bonus_class')),
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index on xp_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- user_stats: denormalized cache for fast reads (Home screen). Rebuilt by
-- triggers -- never written to directly by clients.
-- ---------------------------------------------------------------------------
create table user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp int not null default 0,
  current_level int not null default 1,
  current_streak_weeks int not null default 0,
  max_streak_weeks int not null default 0,
  classes_completed int not null default 0,
  credits_balance int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- achievements catalog + unlocks
-- ---------------------------------------------------------------------------
create table achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  xp_reward int not null default 100
);

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

insert into achievements (code, name, description, xp_reward) values
  ('first_ride', 'First Ride', 'Completa tu primera clase', 100),
  ('ten_rides', '10 Rides', 'Completa 10 clases', 100),
  ('fifty_rides', '50 Rides', 'Completa 50 clases', 100),
  ('on_fire', 'On Fire', 'Manten 7 semanas de streak', 100),
  ('consistent', 'Consistent', 'Cumple tu objetivo semanal 4 semanas seguidas', 100),
  ('top_3', 'Top 3', 'Termina una temporada en el Top 3', 100),
  ('early_bird', 'Early Bird', 'Completa 5 clases antes de las 09:00', 100),
  ('night_rider', 'Night Rider', 'Completa 5 clases despues de las 19:00', 100);

-- ---------------------------------------------------------------------------
-- notifications: log of push notifications (sent_at null = pending send)
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);
create index on notifications (sent_at) where sent_at is null;
