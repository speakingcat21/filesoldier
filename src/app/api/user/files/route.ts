import { NextResponse } from "next/server";
import { db, files } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

/**
 * Get user's files for dashboard
 * GET /api/user/files
 */
export async function GET() {
    try {
        // Get authenticated user
        const headersList = await headers();
        const session = await auth.api.getSession({
            headers: headersList,
        });

        if (!session?.user?.id) {
            return NextResponse.json([], { status: 200 }); // Return empty array if not authenticated
        }

        const userFiles = await db.query.files.findMany({
            where: eq(files.userId, session.user.id),
        });

        const now = new Date();

        // Return files with computed expiry status
        const filesWithStatus = userFiles.map((f) => {
            const timeExpired = f.expiresAt ? f.expiresAt < now : false;
            const downloadLimitReached =
                f.maxDownloads !== null && (f.downloads || 0) >= f.maxDownloads;

            let expiredReason: string | null = null;
            if (downloadLimitReached) {
                expiredReason = "download_limit";
            } else if (timeExpired) {
                expiredReason = "time_expired";
            }

            return {
                id: f.id,
                createdAt: f.createdAt?.toISOString(),
                publicName: f.publicName,
                originalFilename: f.originalFilename,
                size: f.size,
                expiresAt: f.expiresAt?.getTime() || null,
                maxDownloads: f.maxDownloads,
                downloads: f.downloads || 0,
                lastDownloadAt: f.lastDownloadAt?.getTime() || null,
                passwordProtection: !!f.passwordProtection,
                maskFilename: f.maskFilename || false,
                isExpired: timeExpired || downloadLimitReached,
                expiredReason,
            };
        });

        return NextResponse.json(filesWithStatus);
    } catch (error) {
        console.error("Get user files error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
