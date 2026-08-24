-- Pulso: core schema
-- Single-studio MVP (no multi-gym support: add a gym_id column later if the
-- business ever expands to more than one location).
--
-- No separate profiles table: display name/avatar live in InsForge's
-- built-in auth.users.profile JSONB (set via insforge.auth.setProfile()).
-- Admin status lives in its own `admins` table below instead of a
-- client-writable role column -- there's no self-escalation vector to guard
-- against because there's no client-writable role field anywhere.

-- ---------------------------------------------------------------------------
-- admins: presence of a row = admin. Populated only via migration/db query
-- or an admin-only RPC -- never via a client-facing insert/update policy.
-- ---------------------------------------------------------------------------
CREATE TABLE admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- memberships (one active membership per user)
-- ---------------------------------------------------------------------------
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'Standard',
  credits_per_cycle INT NOT NULL DEFAULT 10,
  weekly_goal INT NOT NULL DEFAULT 3,
  cycle_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX one_active_membership_per_user ON memberships (user_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- credit_transactions: append-only ledger, source of truth for balance
-- ---------------------------------------------------------------------------
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('grant', 'booking', 'cancel_refund', 'no_show_penalty', 'admin_adjustment')),
  reference_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON credit_transactions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- bikes: fixed studio inventory
-- ---------------------------------------------------------------------------
CREATE TABLE bikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  trainer_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  capacity INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON classes (starts_at);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bike_id UUID NOT NULL REFERENCES bikes(id),
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'attended', 'no_show')),
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- a bike can only be actively booked by one reservation per class
CREATE UNIQUE INDEX one_bike_per_class ON reservations (class_id, bike_id) WHERE status = 'booked';
-- a user can only hold one active booking per class
CREATE UNIQUE INDEX one_booking_per_user_per_class ON reservations (class_id, user_id) WHERE status = 'booked';
CREATE INDEX ON reservations (user_id, created_at DESC);
CREATE INDEX ON reservations (class_id);

-- ---------------------------------------------------------------------------
-- waitlist_entries
-- ---------------------------------------------------------------------------
CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bike_id UUID REFERENCES bikes(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'claimed', 'expired', 'cancelled')),
  offer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX one_waitlist_entry_per_user_per_class ON waitlist_entries (class_id, user_id) WHERE status IN ('waiting', 'offered');
CREATE INDEX ON waitlist_entries (class_id, status, created_at);

-- ---------------------------------------------------------------------------
-- xp_transactions: append-only ledger, source of truth for XP
-- ---------------------------------------------------------------------------
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('class_completed', 'streak_bonus', 'weekly_goal', 'achievement', 'bonus_class')),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON xp_transactions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- user_stats: denormalized cache for fast reads (Home screen). Rebuilt by
-- triggers -- never written to directly by clients.
-- ---------------------------------------------------------------------------
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  current_level INT NOT NULL DEFAULT 1,
  current_streak_weeks INT NOT NULL DEFAULT 0,
  max_streak_weeks INT NOT NULL DEFAULT 0,
  classes_completed INT NOT NULL DEFAULT 0,
  credits_balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- achievements catalog + unlocks
-- ---------------------------------------------------------------------------
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 100
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

INSERT INTO achievements (code, name, description, xp_reward) VALUES
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
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON notifications (user_id, created_at DESC);
CREATE INDEX ON notifications (sent_at) WHERE sent_at IS NULL;
