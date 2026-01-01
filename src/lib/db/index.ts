import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
}

// Create postgres client with a single connection for serverless
const client = postgres(process.env.DATABASE_URL, {
    max: 1, // Single connection for serverless environments
    idle_timeout: 20,
    connect_timeout: 10,
});

/**
 * Drizzle database instance
 * Use this for all database queries in API routes
 */
export const db = drizzle(client, { schema });

// Re-export schema for convenient imports
export * from "./schema";

// Note: Prepared queries are NOT re-exported here to avoid circular dependencies.
// Import directly from "./queries" when needed.
