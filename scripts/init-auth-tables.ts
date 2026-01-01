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
    console.log("🔒 Initializing Better Auth tables...");

    try {
        // 1. User Table
        console.log("Creating table 'user'...");
        await sql`
            CREATE TABLE IF NOT EXISTS "user" (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                email_verified BOOLEAN NOT NULL,
                image TEXT,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );
        `;

        // 2. Session Table
        console.log("Creating table 'session'...");
        await sql`
            CREATE TABLE IF NOT EXISTS session (
                id TEXT PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL,
                token TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
            );
        `;

        // 3. Account Table
        console.log("Creating table 'account'...");
        await sql`
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
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );
        `;

        // 4. Verification Table
        console.log("Creating table 'verification'...");
        await sql`
            CREATE TABLE IF NOT EXISTS verification (
                id TEXT PRIMARY KEY,
                identifier TEXT NOT NULL,
                value TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ
            );
        `;

        console.log("✅ All Better Auth tables created successfully.");

    } catch (error) {
        console.error("❌ Error creating auth tables:", error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

main();
