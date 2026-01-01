-- ============================================
-- Storage Bucket Setup for FileSoldier
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the encrypted-files bucket for storing encrypted file blobs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'encrypted-files',
  'encrypted-files',
  true,  -- Public because files are encrypted and URL is the secret
  524288000,  -- 500MB limit (adjust as needed)
  ARRAY['application/octet-stream']  -- Only encrypted blobs
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies

-- Allow anyone to upload files (anonymous uploads supported)
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'encrypted-files');

-- Allow anyone to read files (files are encrypted, URL is the secret)
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT
USING (bucket_id = 'encrypted-files');

-- Allow deletion via service role (handled by API routes)
CREATE POLICY "Allow service role delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'encrypted-files');
