import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

/**
 * better-auth client configuration
 * Used in React components for authentication
 */
export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    plugins: [usernameClient()],
});

// Export convenience hooks and methods
export const { signIn, signUp, signOut, useSession, getSession } = authClient;
