-- ============================================================
-- revauniversity.online — Cron Jobs
-- Run AFTER enabling pg_cron in Supabase Dashboard:
--   Database → Extensions → pg_cron → Enable
-- Then: npx supabase db push
-- ============================================================

-- 11.1 Semester auto-bump — daily at 00:00 IST (18:30 UTC)
SELECT cron.schedule(
  'semester-auto-bump',
  '30 18 * * *',
  $$
    UPDATE users
      SET semester_current        = LEAST(semester_current + 1, 8),
          semester_auto_update_at = semester_auto_update_at + interval '4.5 months'
      WHERE semester_auto_update_at <= NOW()
        AND semester_current < 8;
  $$
);

-- 11.2 Mock paper release — every hour
SELECT cron.schedule(
  'mock-paper-release',
  '0 * * * *',
  $$
    UPDATE mock_papers
      SET released = true
      WHERE released = false AND release_at <= NOW();
  $$
);

-- 11.3 Q&A usage reset — daily at midnight IST (18:30 UTC)
SELECT cron.schedule(
  'qa-usage-reset',
  '30 18 * * *',
  $$
    DELETE FROM qa_usage WHERE date < CURRENT_DATE;
  $$
);
