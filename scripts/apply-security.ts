import dotenv from "dotenv";
import postgres from "postgres";

// Load environment variables
dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function main() {
    console.log("🔒 Securing database tables...");

    try {
        // 1. Enable RLS on all tables
        console.log("Enabling RLS...");
        await sql`ALTER TABLE files ENABLE ROW LEVEL SECURITY`;
        await sql`ALTER TABLE download_attempts ENABLE ROW LEVEL SECURITY`;
        await sql`ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY`;
        await sql`ALTER TABLE file_history ENABLE ROW LEVEL SECURITY`;
        console.log("✅ RLS enabled on all tables.");

        // 2. FILES Policies
        console.log("Applying policies for 'files'...");

        // Drop existing to avoid conflicts
        await sql`DROP POLICY IF EXISTS "Anyone can read files" ON files`;
        await sql`DROP POLICY IF EXISTS "Anyone can insert files" ON files`;
        await sql`DROP POLICY IF EXISTS "Owners can update their files" ON files`;
        await sql`DROP POLICY IF EXISTS "Owners can delete their files" ON files`;

        // Public read (files are encrypted, so public access is acceptable for downloading via ID)
        await sql`CREATE POLICY "Anyone can read files" ON files FOR SELECT USING (true)`;

        // Public insert (Anonymous uploads)
        await sql`CREATE POLICY "Anyone can insert files" ON files FOR INSERT WITH CHECK (true)`;

        // Update/Delete restricted to owner
        // Using current_setting to get the JWT subject (user_id)
        await sql`CREATE POLICY "Owners can update their files" ON files FOR UPDATE 
                 USING (user_id IS NOT NULL AND user_id = current_setting('request.jwt.claims', true)::json->>'sub')`;

        await sql`CREATE POLICY "Owners can delete their files" ON files FOR DELETE 
                 USING (user_id IS NOT NULL AND user_id = current_setting('request.jwt.claims', true)::json->>'sub')`;

        console.log("✅ Policies applied for 'files'.");

        // 3. FILE HISTORY Policies
        console.log("Applying policies for 'file_history'...");

        await sql`DROP POLICY IF EXISTS "Users see own history" ON file_history`;
        await sql`DROP POLICY IF EXISTS "Insert file history" ON file_history`; // Removed allowing public insert

        // Users can only see their own history
        await sql`CREATE POLICY "Users see own history" ON file_history FOR SELECT 
                 USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')`;

        // Note: We DO NOT add an INSERT policy for file_history.
        // History is created by the Server (Service Role) only.
        // This prevents users from fabricating history entries via the API.
        console.log("✅ Policies applied for 'file_history'.");

        // 4. DOWNLOAD ATTEMPTS & TOKENS (Backend only)
        console.log("Securing backend-only tables...");

        // Remove any permissive policies if they exist (cleanup from setup.sql if previously run)
        await sql`DROP POLICY IF EXISTS "Service role manages attempts" ON download_attempts`;
        await sql`DROP POLICY IF EXISTS "Service role manages tokens" ON download_tokens`;

        // We DO NOT create any policies for these tables.
        // With RLS enabled and no policies, ONLY the Service Role (superuser/admin) 
        // can access these tables. This is the desired behavior for security.
        // Anonymous/Authenticated users cannot read/write these tables via the Data API.

        console.log("✅ Backend-only tables secured (No public access).");

        console.log("\n✨ Security measurements successfully applied!");

    } catch (error) {
        console.error("❌ Error applying security policies:", error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

main();
