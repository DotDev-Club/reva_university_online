-- ============================================================
-- 004_scheme_aware_curriculum.sql
-- Adds batch/scheme-aware curriculum support.
-- All changes are additive (new tables + nullable columns).
-- Safe to apply on a live database — no destructive operations
-- except replacing the subjects unique constraint (safe if no
-- duplicate subject_code values exist across depts, which is
-- true for the current empty-ish DB).
-- ============================================================

-- ============================================================
-- 1. SUBJECTS — make globally unique by subject_code
-- Same subject_code = same content regardless of branch.
-- dept_id becomes nullable (legacy compat — still used by
-- existing upload admin form until it's updated).
-- ============================================================
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_dept_id_semester_subject_code_key;
ALTER TABLE subjects ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);
ALTER TABLE subjects ALTER COLUMN dept_id DROP NOT NULL;

-- course_type from the handbook (HC / SC / OE / POE / DC)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS course_type text
  CHECK (course_type IN ('HC', 'SC', 'OE', 'POE', 'DC'));

-- ============================================================
-- 2. SCHEMES — one row per branch × batch plan
-- e.g. "CSE 2022 Scheme" for the 2022–2026 CSE batch
-- batch_start = regulation year (e.g. 22 → 2022)
-- ============================================================
CREATE TABLE IF NOT EXISTS schemes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id      uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  name         text NOT NULL,           -- e.g. "CSE 2022 Scheme"
  batch_start  integer NOT NULL,        -- regulation start year, e.g. 2022
  batch_end    integer NOT NULL,        -- expected graduation year, e.g. 2026
  is_active    boolean NOT NULL DEFAULT true,
  is_default   boolean NOT NULL DEFAULT false,  -- one legacy default per dept
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dept_id, batch_start)
);

ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

-- Students need this at signup to pick their batch year
CREATE POLICY "public_read_active_schemes"
  ON schemes FOR SELECT
  USING (is_active = true);

-- Only one default scheme per dept (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS schemes_one_default_per_dept
  ON schemes (dept_id)
  WHERE is_default = true;

-- ============================================================
-- 3. SCHEME_SUBJECTS — join table
-- Which subject appears at which semester in which scheme.
-- Multiple rows can share (scheme_id, semester, elective_group)
-- — these are the valid options for that elective slot.
-- ============================================================
CREATE TABLE IF NOT EXISTS scheme_subjects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id      uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  subject_id     uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  semester       integer NOT NULL CHECK (semester BETWEEN 1 AND 8),
  course_type    text NOT NULL DEFAULT 'HC'
                   CHECK (course_type IN ('HC', 'SC', 'OE', 'POE', 'DC')),
  is_elective    boolean NOT NULL DEFAULT false,
  elective_group text,                  -- e.g. "PE-1", "OE-2" (NULL for HC/DC)
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_id, subject_id),
  -- elective_group must be set when is_elective is true
  CHECK (is_elective = false OR elective_group IS NOT NULL)
);

ALTER TABLE scheme_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_active_scheme_subjects"
  ON scheme_subjects FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- 4. USER_ELECTIVE_CHOICES
-- One row per student per elective slot per scheme.
-- UNIQUE (user_id, scheme_id, elective_group) enforces one pick.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_elective_choices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheme_id      uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  elective_group text NOT NULL,
  subject_id     uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheme_id, elective_group)
);

ALTER TABLE user_elective_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_elective_choices"
  ON user_elective_choices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_elective_choices"
  ON user_elective_choices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_elective_choices"
  ON user_elective_choices FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 5. Add scheme_id to users (nullable — assigned by migration below)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheme_id
  uuid REFERENCES schemes(id) ON DELETE SET NULL;

-- ============================================================
-- DATA MIGRATION (idempotent — all ON CONFLICT DO NOTHING)
-- Creates one "Legacy Scheme" per active dept and links all
-- existing subjects and users into it. Zero user-facing impact.
-- ============================================================

-- Step 1: Create a default legacy scheme per active dept
INSERT INTO schemes (dept_id, name, batch_start, batch_end, is_active, is_default)
SELECT
  d.id,
  d.name || ' Legacy Scheme',
  2020,
  2028,
  true,
  true
FROM departments d
WHERE d.is_active = true
ON CONFLICT (dept_id, batch_start) DO NOTHING;

-- Step 2: Link all existing active subjects into their dept's default scheme
INSERT INTO scheme_subjects (scheme_id, subject_id, semester, course_type, is_elective)
SELECT
  s.id,
  sub.id,
  sub.semester,
  'HC',
  false
FROM schemes s
JOIN subjects sub ON sub.dept_id = s.dept_id AND sub.is_active = true
WHERE s.is_default = true
ON CONFLICT (scheme_id, subject_id) DO NOTHING;

-- Step 3: Assign all existing users (with a dept) to their dept's default scheme
UPDATE users u
SET scheme_id = s.id
FROM schemes s
WHERE s.dept_id = u.dept_id
  AND s.is_default = true
  AND u.scheme_id IS NULL
  AND u.dept_id IS NOT NULL;
