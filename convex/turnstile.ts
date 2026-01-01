import { mutation, action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side Turnstile token verification
 * Called before sensitive operations to ensure human user
 */
export const verifyToken = action({
    args: {
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const secretKey = process.env.TURNSTILE_SECRET_KEY;

        if (!secretKey) {
            console.error("TURNSTILE_SECRET_KEY not configured");
            // Fail open in development, fail closed in production
            if (process.env.NODE_ENV === "development") {
                return { success: true, warning: "Turnstile not configured - dev mode" };
            }
            return { success: false, error: "Turnstile not configured" };
        }

        try {
            const formData = new FormData();
            formData.append('secret', secretKey);
            formData.append('response', args.token);

            const response = await fetch(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                {
                    method: 'POST',
                    body: formData,
                }
            );

            const result = await response.json();

            if (result.success) {
                return {
                    success: true,
                    hostname: result.hostname,
                    challengeTs: result.challenge_ts,
                };
            } else {
                console.error("Turnstile verification failed:", result['error-codes']);
                return {
                    success: false,
                    error: "Verification failed",
                    errorCodes: result['error-codes'],
                };
            }
        } catch (error) {
            console.error("Turnstile API error:", error);
            return {
                success: false,
                error: "Verification service unavailable"
            };
        }
    },
});
