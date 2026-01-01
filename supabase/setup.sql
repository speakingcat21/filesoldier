-- ============================================
-- FileSoldier Database Setup for Supabase
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable pg_cron extension for scheduled jobs (if not already enabled)
-- Note: This requires Supabase Pro plan or self-hosted
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- TABLES
-- ============================================

-- Files table - stores encrypted file metadata
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_id TEXT NOT NULL,
    user_id TEXT,
    public_name TEXT NOT NULL,
    size BIGINT NOT NULL,
    encrypted_metadata TEXT NOT NULL,
    iv TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    max_downloads INTEGER,
    downloads INTEGER DEFAULT 0,
    last_download_at TIMESTAMPTZ,
    password_protection JSONB,
    password_hint TEXT,
    mask_filename BOOLEAN DEFAULT FALSE,
    original_filename TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Download attempts - rate limiting for password-protected files
CREATE TABLE IF NOT EXISTS download_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    attempt_time TIMESTAMPTZ NOT NULL,
    session_id TEXT NOT NULL
);

-- Download tokens - two-phase download protection
CREATE TABLE IF NOT EXISTS download_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL
);

-- File history - audit log (persists after file deletion)
CREATE TABLE IF NOT EXISTS file_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    public_name TEXT NOT NULL,
    original_filename TEXT,
    size BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    max_downloads INTEGER,
    downloads INTEGER DEFAULT 0,
    was_password_protected BOOLEAN NOT NULL,
    status TEXT NOT NULL,
    status_updated_at TIMESTAMPTZ,
    history_expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_storage_id ON files(storage_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);

CREATE INDEX IF NOT EXISTS idx_download_attempts_file_session ON download_attempts(file_id, session_id);
CREATE INDEX IF NOT EXISTS idx_download_attempts_time ON download_attempts(attempt_time);

CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_file ON download_tokens(file_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires ON download_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_file_history_user ON file_history(user_id);
CREATE INDEX IF NOT EXISTS idx_file_history_file ON file_history(file_id);
CREATE INDEX IF NOT EXISTS idx_file_history_expires ON file_history(history_expires_at);

-- ============================================
-- REALTIME
-- ============================================

-- Enable Realtime on files table for live updates
-- This allows clients to subscribe to changes (INSERT, UPDATE, DELETE)
ALTER PUBLICATION supabase_realtime ADD TABLE files;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_history ENABLE ROW LEVEL SECURITY;

-- FILES: Public read for downloads (since files are encrypted, URL is the secret)
CREATE POLICY "Anyone can read files"
    ON files FOR SELECT
    USING (true);

-- FILES: Anyone can insert (anonymous uploads allowed)
CREATE POLICY "Anyone can insert files"
    ON files FOR INSERT
    WITH CHECK (true);

-- FILES: Only file owner can update
CREATE POLICY "Owners can update their files"
    ON files FOR UPDATE
    USING (user_id IS NOT NULL AND user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- FILES: Only file owner can delete
CREATE POLICY "Owners can delete their files"
    ON files FOR DELETE
    USING (user_id IS NOT NULL AND user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- DOWNLOAD ATTEMPTS: Allow via service role only (managed by API routes)
-- For API routes using service key, RLS is bypassed automatically.
-- We DO NOT add a policy here, which means NO public access (Secure).
/*
CREATE POLICY "Service role manages attempts"
    ON download_attempts
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);
*/

-- DOWNLOAD TOKENS: Allow via service role only
-- We DO NOT add a policy here, which means NO public access (Secure).
/*
CREATE POLICY "Service role manages tokens"
    ON download_tokens
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);
*/

-- FILE HISTORY: Users can only see their own history
CREATE POLICY "Users see own history"
    ON file_history FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- FILE HISTORY: Insert managed by API (Service Role)
-- We DO NOT add an INSERT policy. Service Role bypasses RLS.
-- This prevents users from inserting fake history entries.
/*
CREATE POLICY "Insert file history"
    ON file_history FOR INSERT
    WITH CHECK (TRUE);
*/

-- ============================================
-- SCHEDULED CLEANUP (pg_cron)
-- ============================================
-- Note: pg_cron requires Supabase Pro or self-hosted
-- Uncomment below if you have pg_cron enabled:

/*
SELECT cron.schedule(
    'cleanup-expired-files',
    '*/15 * * * *',
    $$
    -- Delete expired files
    DELETE FROM files WHERE expires_at < NOW();
    
    -- Delete expired download tokens
    DELETE FROM download_tokens WHERE expires_at < NOW();
    
    -- Delete old download attempts (older than 15 minutes)
    DELETE FROM download_attempts 
    WHERE attempt_time < NOW() - INTERVAL '15 minutes';
    
    -- Delete old file history entries (older than 14 days)
    DELETE FROM file_history 
    WHERE history_expires_at < NOW();
    $$
);
*/

-- ============================================
-- BETTER-AUTH TABLES
-- These will be created automatically by better-auth
-- on first run, but here's the schema for reference:
-- ============================================

/*
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- ============================================
-- BETTER-AUTH RLS POLICIES
-- These tables are managed by better-auth via service role
-- Enable RLS to secure them (service role bypasses RLS)
-- ============================================

-- Enable RLS on auth tables
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification ENABLE ROW LEVEL SECURITY;

-- USER: Users can only read their own data
CREATE POLICY "Users can read own data"
    ON "user" FOR SELECT
    USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

-- SESSION: Users can only read their own sessions  
CREATE POLICY "Users can read own sessions"
    ON session FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ACCOUNT: Users can only read their own accounts
CREATE POLICY "Users can read own accounts"
    ON account FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- VERIFICATION: No public access (managed by service role only)
-- No policy means no public access, which is correct for verification tokens

-- ============================================
-- PG_CRON SCHEDULED CLEANUP JOBS
-- Automatically clean up expired data
-- ============================================

-- Enable required extensions (available on all Supabase tiers)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres (required for scheduling)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a function to cleanup expired database records
-- Note: This handles DB cleanup. Storage cleanup is done via the API endpoint.
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_file RECORD;
    deleted_files_count INTEGER := 0;
    deleted_tokens_count INTEGER := 0;
    deleted_attempts_count INTEGER := 0;
    updated_history_count INTEGER := 0;
BEGIN
    -- Log start of cleanup
    RAISE LOG 'Starting scheduled cleanup: %', NOW();

    -- 1. Update file_history status for expired files (before deleting)
    UPDATE file_history
    SET status = 'expired', status_updated_at = NOW()
    WHERE file_id IN (
        SELECT id FROM files 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
    )
    AND status = 'active';
    
    GET DIAGNOSTICS updated_history_count = ROW_COUNT;

    -- 2. Delete expired files from database
    -- Storage files are deleted via the API endpoint called by invoke_cleanup_api()
    FOR expired_file IN 
        SELECT id, storage_id FROM files 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
    LOOP
        DELETE FROM files WHERE id = expired_file.id;
        deleted_files_count := deleted_files_count + 1;
    END LOOP;

    -- 3. Delete expired download tokens
    DELETE FROM download_tokens WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_tokens_count = ROW_COUNT;

    -- 4. Delete old download attempts (older than 15 minutes)
    DELETE FROM download_attempts WHERE attempt_time < NOW() - INTERVAL '15 minutes';
    GET DIAGNOSTICS deleted_attempts_count = ROW_COUNT;

    -- 5. Delete expired file history entries
    DELETE FROM file_history WHERE history_expires_at IS NOT NULL AND history_expires_at < NOW();

    -- Log completion
    RAISE LOG 'Cleanup completed: deleted % files, % tokens, % attempts, updated % history entries', 
        deleted_files_count, deleted_tokens_count, deleted_attempts_count, updated_history_count;
END;
$$;

-- Create a function to call the cleanup API endpoint (for storage cleanup)
-- This requires setting up project URL and service key in Supabase Vault
-- To set up:
-- 1. Go to Supabase Dashboard > Project Settings > Vault
-- 2. Add secrets: 'project_url' (your Supabase URL) and 'service_role_key' (your service role key)
CREATE OR REPLACE FUNCTION invoke_cleanup_api()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    project_url TEXT;
    service_key TEXT;
BEGIN
    -- Try to get secrets from vault (optional - fallback to just DB cleanup)
    BEGIN
        SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name = 'project_url';
        SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
        
        IF project_url IS NOT NULL AND service_key IS NOT NULL THEN
            -- Call the cleanup API endpoint to handle storage cleanup
            PERFORM net.http_post(
                url := project_url || '/api/cron/cleanup',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_key
                ),
                body := jsonb_build_object('source', 'pg_cron')
            );
            RAISE LOG 'Cleanup API invoked successfully';
        ELSE
            RAISE LOG 'Vault secrets not configured, running DB-only cleanup';
            PERFORM cleanup_expired_data();
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to DB-only cleanup if vault is not set up
        RAISE LOG 'Vault not available (%), running DB-only cleanup', SQLERRM;
        PERFORM cleanup_expired_data();
    END;
END;
$$;

-- Schedule the cleanup to run every 15 minutes
-- First, unschedule if it already exists (for idempotency)
DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-expired-data');
EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END;
$$;

-- Schedule the cleanup job using the DB-only cleanup function
-- If you want to use the API endpoint for storage cleanup, change to:
-- SELECT cron.schedule('cleanup-expired-data', '*/15 * * * *', 'SELECT invoke_cleanup_api();');
SELECT cron.schedule(
    'cleanup-expired-data',          -- Job name
    '*/15 * * * *',                  -- Every 15 minutes
    'SELECT cleanup_expired_data();' -- SQL to execute
);

-- Optional: View scheduled jobs
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
