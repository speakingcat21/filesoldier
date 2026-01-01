import { NextResponse } from "next/server";
import { db, fileHistory } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";

/**
 * Get user's file upload history
 * GET /api/user/history
 */
export async function GET() {
    try {
        // Get authenticated user
        const headersList = await headers();
        const session = await auth.api.getSession({
            headers: headersList,
        });

        if (!session?.user?.id) {
            return NextResponse.json([], { status: 200 });
        }

        const history = await db.query.fileHistory.findMany({
            where: eq(fileHistory.userId, session.user.id),
            orderBy: [desc(fileHistory.uploadedAt)],
        });

        const now = new Date();

        // Compute status dynamically
        const historyWithStatus = history.map((h) => {
            let computedStatus = h.status;
            if (h.status === "active" && h.expiresAt && h.expiresAt < now) {
                computedStatus = "expired";
            }

            return {
                id: h.id,
                publicName: h.publicName,
                originalFilename: h.originalFilename,
                size: h.size,
                uploadedAt: h.uploadedAt.getTime(),
                expiresAt: h.expiresAt?.getTime() || null,
                maxDownloads: h.maxDownloads,
                downloads: h.downloads || 0,
                wasPasswordProtected: h.wasPasswordProtected,
                status: computedStatus,
                statusUpdatedAt: h.statusUpdatedAt?.getTime() || null,
            };
        });

        return NextResponse.json(historyWithStatus);
    } catch (error) {
        console.error("Get user history error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
