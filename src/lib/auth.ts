import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { db } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * better-auth server configuration
 * Uses Drizzle adapter with PostgreSQL (Supabase)
 */
export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),

    // Base URL for auth endpoints
    baseURL: siteUrl,

    // Trust origins for CORS
    trustedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        siteUrl,
    ],

    // Cookie settings for secure sessions
    advanced: {
        defaultCookieAttributes: {
            httpOnly: true, // Prevent XSS access to cookies
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        },
    },

    // Email/password authentication
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 30,
    },

    // Plugins
    plugins: [
        // Username plugin allows login with username OR email
        username(),
    ],

    // Session configuration
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // Update session every 24 hours
    },
});

// Export auth types for use in API routes
export type Session = typeof auth.$Infer.Session;
