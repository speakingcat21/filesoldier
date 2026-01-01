import { NextRequest, NextResponse } from "next/server";
import { db, downloadAttempts, downloadTokens } from "@/lib/db";
import { findFileById } from "@/lib/db/queries";
import { supabaseAdmin } from "@/lib/supabase/server";
import { eq, and, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { downloadTokenRequestSchema, validateInput } from "@/lib/validation";

const STORAGE_BUCKET = "encrypted-files";
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const TOKEN_TTL = 5 * 60 * 1000; // 5 minutes token validity

/**
 * Get download token (Phase 1 of two-phase download)
 * POST /api/files/download-token
 *
 * This endpoint:
 * 1. Validates file access (expiry, download limits)
 * 2. Rate limits password attempts
 * 3. Generates a time-limited download token
 * 4. Returns signed URL + token (counter NOT incremented yet)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate input with Zod
        const validation = validateInput(downloadTokenRequestSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: `Invalid request: ${validation.error}` },
                { status: 400 }
            );
        }

        const { fileId, sessionId } = validation.data;

        // Fetch file using prepared statement
        const file = await findFileById(fileId);

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const now = new Date();
        const nowMs = now.getTime();

        // Rate limiting for password-protected files
        if (file.passwordProtection && sessionId) {
            const windowStart = new Date(nowMs - RATE_LIMIT_WINDOW);

            const recentAttempts = await db.query.downloadAttempts.findMany({
                where: and(
                    eq(downloadAttempts.fileId, fileId),
                    eq(downloadAttempts.sessionId, sessionId),
                    gt(downloadAttempts.attemptTime, windowStart)
                ),
            });

            if (recentAttempts.length >= MAX_ATTEMPTS) {
                const oldestAttempt = Math.min(
                    ...recentAttempts.map((a) => a.attemptTime.getTime())
                );
                const retryAfter = Math.ceil(
                    (oldestAttempt + RATE_LIMIT_WINDOW - nowMs) / 1000 / 60
                );

                return NextResponse.json({
                    error: "RATE_LIMITED",
                    message: `Too many attempts. Please try again in ${retryAfter} minutes.`,
                    retryAfterMinutes: retryAfter,
                });
            }

            // Log this attempt
            await db.insert(downloadAttempts).values({
                fileId: fileId,
                attemptTime: now,
                sessionId: sessionId,
            });
        }

        // Check expiry
        if (file.expiresAt && file.expiresAt < now) {
            return NextResponse.json({ error: "File has expired" }, { status: 410 });
        }

        // Check max downloads (don't increment yet)
        if (
            file.maxDownloads !== null &&
            (file.downloads || 0) >= file.maxDownloads
        ) {
            return NextResponse.json(
                { error: "Download limit reached" },
                { status: 410 }
            );
        }

        // Generate download token
        const token = nanoid(32);
        const expiresAt = new Date(nowMs + TOKEN_TTL);

        await db.insert(downloadTokens).values({
            fileId: fileId,
            token: token,
            createdAt: now,
            used: false,
            expiresAt: expiresAt,
        });

        // Generate signed URL from Supabase Storage
        const { data: signedUrlData, error: signedUrlError } =
            await supabaseAdmin.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(file.storageId, 300); // 5 minute expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
            console.error("Signed URL error:", signedUrlError);
            return NextResponse.json(
                { error: "Failed to generate download URL" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            url: signedUrlData.signedUrl,
            token: token,
            expiresIn: TOKEN_TTL,
        });
    } catch (error) {
        console.error("Download token error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
