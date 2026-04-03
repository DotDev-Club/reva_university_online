-- ============================================================
-- revauniversity.online — Initial Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable pg_cron (request from Supabase dashboard if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  full_name   text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_departments"
  ON departments FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 2. SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id       uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  semester      integer NOT NULL CHECK (semester BETWEEN 1 AND 8),
  subject_code  text NOT NULL,
  name          text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dept_id, semester, subject_code)
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_subjects"
  ON subjects FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 3. MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  unit_no         integer NOT NULL CHECK (unit_no IN (1, 2, 3, 4)),
  title           text NOT NULL,
  file_url        text NOT NULL,          -- Supabase Storage path, never raw-exposed
  extracted_text  text,
  needs_ocr       boolean NOT NULL DEFAULT false,
  topics          text[] NOT NULL DEFAULT '{}',
  is_free         boolean NOT NULL DEFAULT false,  -- Set by upload API, not admin
  is_active       boolean NOT NULL DEFAULT true,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Students never query materials directly; access goes through API routes.
-- Authenticated users can read metadata (not file_url — that is served via signed URL API).
CREATE POLICY "auth_read_active_materials_metadata"
  ON materials FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- 4. MOCK PAPERS
-- ============================================================
CREATE TABLE IF NOT EXISTS mock_papers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  exam_date   date NOT NULL,
  release_at  timestamptz NOT NULL,    -- Computed at insert: exam_date - mock_paper_release_hours
  released    boolean NOT NULL DEFAULT false,
  file_url    text NOT NULL,           -- Supabase Storage path
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mock_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_released_mock_papers"
  ON mock_papers FOR SELECT
  TO authenticated
  USING (released = true);

-- ============================================================
-- 5. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                      uuid PRIMARY KEY,  -- Matches Supabase Auth user id
  email                   text NOT NULL,
  full_name               text NOT NULL,
  dept_id                 uuid REFERENCES departments(id) ON DELETE RESTRICT,
  semester_current        integer CHECK (semester_current BETWEEN 1 AND 8),
  semester_auto_update_at timestamptz,
  is_early_user           boolean NOT NULL DEFAULT false,
  subscription_semester   integer CHECK (subscription_semester BETWEEN 1 AND 8),
  subscription_expires_at timestamptz,
  email_verified          boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own row (except subscription_semester — trigger protects it)
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- CRITICAL: subscription_semester IMMUTABILITY TRIGGER
-- Prevents any UPDATE to subscription_semester after it is first set.
-- No application code, admin override, or RLS policy can bypass this.
-- The ONLY way to clear it is a direct service_role query documented
-- in the refund process (Appendix P §6.3).
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_subscription_semester_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If old value was already set (not null) and new value differs, block it
  IF OLD.subscription_semester IS NOT NULL
     AND NEW.subscription_semester IS DISTINCT FROM OLD.subscription_semester THEN
    RAISE EXCEPTION
      'subscription_semester is immutable after first write. '
      'Attempted to change from % to % for user %.',
      OLD.subscription_semester, NEW.subscription_semester, OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_subscription_semester_immutable
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_subscription_semester_update();

-- ============================================================
-- 6. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  razorpay_order_id   text NOT NULL UNIQUE,
  amount_paise        integer NOT NULL,
  currency            text NOT NULL DEFAULT 'INR',
  semester            integer NOT NULL CHECK (semester BETWEEN 1 AND 8),
  status              text NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'paid', 'failed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No client-side INSERT/UPDATE — all writes via service_role in API routes

-- ============================================================
-- 7. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  razorpay_payment_id   text NOT NULL UNIQUE,   -- Idempotency key
  razorpay_order_id     text NOT NULL,
  razorpay_signature    text NOT NULL,
  amount_paise          integer NOT NULL,
  method                text CHECK (method IN ('upi', 'card', 'netbanking', 'wallet')),
  status                text NOT NULL DEFAULT 'captured'
                          CHECK (status IN ('captured', 'failed', 'refunded')),
  first_access_at       timestamptz,              -- NULL until first paid content opened
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No client-side INSERT/UPDATE — all writes via service_role in API routes

-- ============================================================
-- 8. QA USAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS qa_usage (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      date NOT NULL,
  count     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE qa_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_qa_usage"
  ON qa_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 9. APP CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
  key    text PRIMARY KEY,
  value  text NOT NULL
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Public read for safe config keys (price, limits) — never expose secrets
CREATE POLICY "public_read_config"
  ON app_config FOR SELECT
  USING (true);

-- Seed default config values
INSERT INTO app_config (key, value) VALUES
  ('early_user_cap',               '150'),
  ('early_user_count',             '0'),
  ('subscription_price_inr',       '159'),
  ('subscription_duration_months', '6'),
  ('semester_auto_bump_months',    '4.5'),
  ('mock_paper_release_hours',     '24'),
  ('free_unit2_page_pct',          '30'),
  ('qa_daily_limit',               '20'),
  ('claude_model',                 'claude-sonnet-4-20250514')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 10. SEED DEPARTMENTS (Phase 1 — CSE & CNIT)
-- ============================================================
INSERT INTO departments (name, full_name, is_active) VALUES
  ('CSE',  'Computer Science & Engineering',          false),
  ('CNIT', 'Computer Networks & Information Technology', false)
ON CONFLICT (name) DO NOTHING;

-- Cron jobs are in 002_cron_jobs.sql — requires pg_cron extension.
-- Enable pg_cron in Supabase Dashboard → Database → Extensions first.

-- ============================================================
-- HELPER FUNCTION: atomic early user counter
-- Returns true if slot was claimed, false if cap reached.
-- ============================================================
CREATE OR REPLACE FUNCTION claim_early_user_slot()
RETURNS boolean AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE app_config
    SET value = (value::int + 1)::text
    WHERE key = 'early_user_count'
      AND value::int < (
        SELECT value::int FROM app_config WHERE key = 'early_user_cap'
      )
  RETURNING value::int INTO updated_count;

  RETURN (updated_count IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
