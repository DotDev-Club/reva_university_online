-- ============================================================
-- Storage buckets — private (signed URLs only, Rule A4 / G3)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('materials',    'materials',    false, 52428800, ARRAY['application/pdf']),
  ('mock-papers',  'mock-papers',  false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage: only service_role can INSERT (via admin client).
-- Students access files only via signed URLs generated server-side.

CREATE POLICY "service_role_upload_materials"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'materials');

CREATE POLICY "service_role_read_materials"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'materials');

CREATE POLICY "service_role_upload_mock_papers"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'mock-papers');

CREATE POLICY "service_role_read_mock_papers"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'mock-papers');
