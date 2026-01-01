import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { containsExplicitContent } from "@/utils/contentFilter";
import { z } from "zod";
import { validateInput, turnstileTokenSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "encrypted-files";
const LIMIT_ANONYMOUS = 10 * 1024 * 1024; // 10MB
const LIMIT_USER = 50 * 1024 * 1024; // 50MB

/**
 * Presign request schema
 */
const presignRequestSchema = z.object({
    size: z.number().int().min(0).max(524288000), // Max 500MB
    originalFilename: z.string().max(500).optional().nullable(),
    turnstileToken: turnstileTokenSchema,
});

/**
 * Generate a presigned URL for direct-to-Supabase upload
 * POST /api/upload/presign
 * 
 * This endpoint:
 * 1. Validates user session and file size limits
 * 2. Verifies Turnstile for anonymous users
 * 3. Generates a signed upload URL from Supabase Storage
 * 
 * Returns { token, path, fileId } for client-side upload
 */
export async function POST(request: NextRequest) {
    try {
        // Get authenticated user (if any)
        const headersList = await headers();
        const session = await auth.api.getSession({
            headers: headersList,
        });
        const userId = session?.user?.id;

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error("Failed to parse request body:", parseError);
            return NextResponse.json(
                { error: "Invalid JSON in request body" },
                { status: 400 }
            );
        }

        const validation = validateInput(presignRequestSchema, body);

        if (!validation.success) {
            return NextResponse.json(
                { error: `Invalid request: ${validation.error}` },
                { status: 400 }
            );
        }

        const { size, originalFilename, turnstileToken } = validation.data;

        // Validate file size limits
        const limit = userId ? LIMIT_USER : LIMIT_ANONYMOUS;
        if (size > limit) {
            return NextResponse.json(
                { error: `File too large. Max ${userId ? "50MB" : "10MB"}.` },
                { status: 400 }
            );
        }

        // Content moderation on filename
        if (originalFilename && containsExplicitContent(originalFilename)) {
            return NextResponse.json(
                { error: "Filename contains inappropriate content" },
                { status: 400 }
            );
        }

        // Turnstile verification for anonymous users
        if (!userId && turnstileToken) {
            try {
                const turnstileResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_SITE_URL}/api/turnstile`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token: turnstileToken }),
                    }
                );
                const turnstileResult = await turnstileResponse.json();

                if (!turnstileResult.success) {
                    return NextResponse.json(
                        { error: "CAPTCHA verification failed" },
                        { status: 403 }
                    );
                }
            } catch (turnstileError) {
                console.error("Turnstile verification error:", turnstileError);
                return NextResponse.json(
                    { error: "CAPTCHA verification service unavailable" },
                    { status: 503 }
                );
            }
        } else if (!userId && process.env.NODE_ENV === "production") {
            return NextResponse.json(
                { error: "CAPTCHA verification required" },
                { status: 403 }
            );
        }

        // Generate file ID and storage path
        const fileId = nanoid(10);
        const storagePath = `uploads/${fileId}.enc`;

        // Create signed upload URL
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUploadUrl(storagePath);

        if (error || !data) {
            console.error("Failed to create signed upload URL:", error);
            return NextResponse.json(
                { error: "Failed to create upload URL. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            token: data.token,
            path: data.path,
            fileId,
            userId: userId || null,
        });
    } catch (error) {
        console.error("Presign error:", error);
        // Return more specific error message based on error type
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: `Internal server error: ${errorMessage}` },
            { status: 500 }
        );
    }
}

