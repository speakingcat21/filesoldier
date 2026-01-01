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
    console.log("🔒 Adding username column to user table...");

    try {
        await sql`
            ALTER TABLE "user" 
            ADD COLUMN IF NOT EXISTS username TEXT;
        `;

        console.log("✅ 'username' column added successfully.");

    } catch (error) {
        console.error("❌ Error adding column:", error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

main();
