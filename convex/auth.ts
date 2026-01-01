import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";

const siteUrl = process.env.SITE_URL!;

// The component client has methods needed for integrating Convex with Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
    ctx: GenericCtx<DataModel>,
    { optionsOnly } = { optionsOnly: false }
) => {
    return betterAuth({
        logger: {
            disabled: optionsOnly
        },
        baseURL: siteUrl,
        database: authComponent.adapter(ctx),
        // Trust origins for CORS
        trustedOrigins: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            siteUrl, // Production URL from env
        ],
        // Advanced settings for cross-site cookie handling
        advanced: {
            defaultCookieAttributes: {
                sameSite: "none",
                secure: true,
                partitioned: true, // Required by modern browser standards
            },
        },
        // Email/password authentication
        emailAndPassword: {
            enabled: true,
            requireEmailVerification: false,
            minPasswordLength: 8,
            maxPasswordLength: 30,
        },
        plugins: [
            // Username plugin allows login with username OR email
            username(),
            // Convex plugin is required for Convex compatibility
            convex()
        ]
    });
};

// Get the current authenticated user
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        return {
            id: identity.subject,
            name: identity.name,
            email: identity.email,
        };
    },
});
