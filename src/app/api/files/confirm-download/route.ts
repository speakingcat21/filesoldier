import { NextRequest, NextResponse } from "next/server";
import { db, files, downloadTokens, fileHistory } from "@/lib/db";
import { findFileById, findDownloadToken } from "@/lib/db/queries";
import { eq } from "drizzle-orm";

interface ConfirmDownloadRequest {
    token: string;
}

/**
 * Confirm download (Phase 2 of two-phase download)
 * POST /api/files/confirm-download
 *
 * This endpoint:
 * 1. Validates the download token
 * 2. Marks the token as used
 * 3. Increments the download counter (the actual commit)
 * 4. Updates file history download count
 */
export async function POST(request: NextRequest) {
    try {
        const body: ConfirmDownloadRequest = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: "Token required" }, { status: 400 });
        }

        const now = new Date();

        // Find the token using prepared statement
        const tokenRecord = await findDownloadToken(token);

        if (!tokenRecord) {
            return NextResponse.json(
                { error: "INVALID_TOKEN", message: "Invalid or expired download token." },
                { status: 400 }
            );
        }

        // Check if token is expired
        if (tokenRecord.expiresAt < now) {
            // Cleanup expired token
            await db.delete(downloadTokens).where(eq(downloadTokens.id, tokenRecord.id));
            return NextResponse.json(
                { error: "TOKEN_EXPIRED", message: "Download token has expired." },
                { status: 400 }
            );
        }

        // Check if token was already used
        if (tokenRecord.used) {
            return NextResponse.json(
                { error: "TOKEN_USED", message: "Download already confirmed." },
                { status: 400 }
            );
        }

        // Get the file using prepared statement
        const file = await findFileById(tokenRecord.fileId);

        if (!file) {
            await db.delete(downloadTokens).where(eq(downloadTokens.id, tokenRecord.id));
            return NextResponse.json(
                { error: "FILE_NOT_FOUND", message: "File no longer exists." },
                { status: 404 }
            );
        }

        // Re-check max downloads (in case it was exhausted while downloading)
        if (
            file.maxDownloads !== null &&
            (file.downloads || 0) >= file.maxDownloads
        ) {
            await db.delete(downloadTokens).where(eq(downloadTokens.id, tokenRecord.id));
            return NextResponse.json(
                { error: "LIMIT_REACHED", message: "Download limit reached." },
                { status: 410 }
            );
        }

        // Mark token as used
        await db
            .update(downloadTokens)
            .set({ used: true })
            .where(eq(downloadTokens.id, tokenRecord.id));

        // NOW increment the download counter (the actual commit)
        const newDownloads = (file.downloads || 0) + 1;
        await db
            .update(files)
            .set({
                downloads: newDownloads,
                lastDownloadAt: now,
            })
            .where(eq(files.id, tokenRecord.fileId));

        // Also update the history entry's download count
        if (file.userId) {
            const historyEntry = await db.query.fileHistory.findFirst({
                where: eq(fileHistory.fileId, tokenRecord.fileId),
            });

            if (historyEntry) {
                await db
                    .update(fileHistory)
                    .set({ downloads: newDownloads })
                    .where(eq(fileHistory.id, historyEntry.id));
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Confirm download error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
