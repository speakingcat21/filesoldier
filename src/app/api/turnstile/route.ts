import { NextRequest, NextResponse } from "next/server";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    "error-codes"?: string[];
}

/**
 * Verify Cloudflare Turnstile token
 * POST /api/turnstile
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Token is required" },
                { status: 400 }
            );
        }

        if (!TURNSTILE_SECRET_KEY) {
            console.error("TURNSTILE_SECRET_KEY not configured");
            // Fail open in development, fail closed in production
            if (process.env.NODE_ENV === "development") {
                return NextResponse.json({
                    success: true,
                    warning: "Turnstile not configured - dev mode",
                });
            }
            return NextResponse.json(
                { success: false, error: "Turnstile not configured" },
                { status: 500 }
            );
        }

        const formData = new FormData();
        formData.append("secret", TURNSTILE_SECRET_KEY);
        formData.append("response", token);

        const response = await fetch(TURNSTILE_VERIFY_URL, {
            method: "POST",
            body: formData,
        });

        const result: TurnstileVerifyResponse = await response.json();

        if (result.success) {
            return NextResponse.json({
                success: true,
                hostname: result.hostname,
                challengeTs: result.challenge_ts,
            });
        } else {
            console.error("Turnstile verification failed:", result["error-codes"]);
            return NextResponse.json({
                success: false,
                error: "Verification failed",
                errorCodes: result["error-codes"],
            });
        }
    } catch (error) {
        console.error("Turnstile API error:", error);
        return NextResponse.json(
            { success: false, error: "Verification service unavailable" },
            { status: 500 }
        );
    }
}
