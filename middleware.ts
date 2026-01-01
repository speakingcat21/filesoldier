import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security middleware for Next.js
 * Adds security headers and CSRF protection to all responses
 */
export function middleware(request: NextRequest) {
    // CSRF Protection for mutating requests
    // Verify Origin header matches host for POST/PUT/DELETE/PATCH
    const mutatingMethods = ["POST", "PUT", "DELETE", "PATCH"];
    if (mutatingMethods.includes(request.method)) {
        const origin = request.headers.get("origin");
        const host = request.headers.get("host");

        // Allow requests without origin (same-origin form submissions)
        // or where origin matches host
        if (origin) {
            const originHost = new URL(origin).host;
            if (originHost !== host) {
                // API routes handle CORS themselves, so skip CSRF for /api/*
                // This prevents blocking legitimate API calls from trusted origins
                if (!request.nextUrl.pathname.startsWith("/api/")) {
                    return new NextResponse("Forbidden - CSRF", { status: 403 });
                }
            }
        }
    }

    const response = NextResponse.next();

    // Supabase domains for CSP
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseDomain = supabaseUrl
        ? new URL(supabaseUrl).hostname
        : "*.supabase.co";

    // Content Security Policy
    const csp = [
        "default-src 'self'",
        // Scripts: self, inline for Next.js hydration, Cloudflare Turnstile
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
        "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com",
        // Styles: self and inline for styled components
        "style-src 'self' 'unsafe-inline'",
        // Images: self, data for base64, blob for preview, https for external
        "img-src 'self' data: blob: https:",
        // Connect: API calls to Supabase, Turnstile, Vercel Analytics
        `connect-src 'self' https://${supabaseDomain} wss://${supabaseDomain} https://challenges.cloudflare.com https://vitals.vercel-insights.com`,
        // Fonts: self and Google Fonts
        "font-src 'self' https://fonts.gstatic.com",
        // Frames: only Cloudflare Turnstile
        "frame-src https://challenges.cloudflare.com",
        // Prevent embedding this site in frames
        "frame-ancestors 'none'",
        // Prevent form submissions to external sites
        "form-action 'self'",
        // Upgrade insecure requests in production
        "upgrade-insecure-requests",
    ].join("; ");

    // Set security headers
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
    );
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), browsing-topics=()"
    );

    // Additional security headers
    response.headers.set("X-Download-Options", "noopen");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    response.headers.set("X-DNS-Prefetch-Control", "off");

    // SEO: X-Robots-Tag for programmatic indexing control
    // Prevent Bing and other crawlers from indexing private routes
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith("/d/") || pathname.startsWith("/my-files") || pathname.startsWith("/api/")) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }

    return response;
}

// Apply middleware to all routes except static files
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
    ],
};
