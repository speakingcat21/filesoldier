import { NextRequest, NextResponse } from "next/server";
import { db, files, downloadTokens, downloadAttempts, fileHistory } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { lt, and, isNotNull, eq } from "drizzle-orm";

const STORAGE_BUCKET = "encrypted-files";

/**
 * Cleanup expired files and tokens
 * GET/POST /api/cron/cleanup
 * 
 * This endpoint can be called by:
 * - Supabase pg_cron via pg_net (POST with service_role_key)
 * - Direct HTTP request with CRON_SECRET
 * 
 * It handles:
 * 1. Delete expired files from storage and database
 * 2. Delete expired download tokens
 * 3. Delete old download attempts (>15 minutes)
 * 4. Update file history status for expired files
 */
async function handleCleanup(request: NextRequest) {
    try {
        // Verify authorization - accept either:
        // 1. CRON_SECRET (for manual/Vercel cron calls)
        // 2. Supabase service_role_key (for pg_cron via pg_net)
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const isAuthorized =
            (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
            (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) ||
            (!cronSecret && !serviceRoleKey); // Allow if no secrets configured (dev mode)

        if (!isAuthorized) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

        let deletedFiles = 0;
        let deletedTokens = 0;
        let deletedAttempts = 0;
        let updatedHistory = 0;
        let deletedHistory = 0;

        // 1. Find and delete expired files
        const expiredFiles = await db.query.files.findMany({
            where: and(
                isNotNull(files.expiresAt),
                lt(files.expiresAt, now)
            ),
        });

        for (const file of expiredFiles) {
            // Update history status first (mark as expired)
            if (file.userId) {
                const historyEntry = await db.query.fileHistory.findFirst({
                    where: eq(fileHistory.fileId, file.id),
                });

                if (historyEntry && historyEntry.status === "active") {
                    await db
                        .update(fileHistory)
                        .set({
                            status: "expired",
                            statusUpdatedAt: now,
                        })
                        .where(eq(fileHistory.id, historyEntry.id));
                    updatedHistory++;
                }
            }

            // Delete from storage
            await supabaseAdmin.storage
                .from(STORAGE_BUCKET)
                .remove([file.storageId]);

            // Delete from database (cascades to tokens/attempts via FK)
            await db.delete(files).where(eq(files.id, file.id));
            deletedFiles++;
        }

        // 2. Delete expired download tokens
        const expiredTokens = await db.query.downloadTokens.findMany({
            where: lt(downloadTokens.expiresAt, now),
        });

        for (const token of expiredTokens) {
            await db.delete(downloadTokens).where(eq(downloadTokens.id, token.id));
            deletedTokens++;
        }

        // 3. Delete old download attempts (older than 15 minutes)
        const oldAttempts = await db.query.downloadAttempts.findMany({
            where: lt(downloadAttempts.attemptTime, fifteenMinutesAgo),
        });

        for (const attempt of oldAttempts) {
            await db.delete(downloadAttempts).where(eq(downloadAttempts.id, attempt.id));
            deletedAttempts++;
        }

        // 4. Delete expired file history entries (older than retention period)
        const expiredHistory = await db.query.fileHistory.findMany({
            where: lt(fileHistory.historyExpiresAt, now),
        });

        for (const entry of expiredHistory) {
            await db.delete(fileHistory).where(eq(fileHistory.id, entry.id));
            deletedHistory++;
        }

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            deleted: {
                files: deletedFiles,
                tokens: deletedTokens,
                attempts: deletedAttempts,
                history: deletedHistory,
            },
            updated: {
                historyStatus: updatedHistory,
            },
        });
    } catch (error) {
        console.error("Cleanup cron error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Export GET and POST handlers (pg_cron uses POST via pg_net)
export async function GET(request: NextRequest) {
    return handleCleanup(request);
}

export async function POST(request: NextRequest) {
    return handleCleanup(request);
}
