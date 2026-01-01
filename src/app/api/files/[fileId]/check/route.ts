import { NextRequest, NextResponse } from "next/server";
import { findFileById } from "@/lib/db/queries";

/**
 * Check if a file exists and is still valid
 * GET /api/files/[fileId]/check
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    try {
        const { fileId } = await params;

        if (!fileId) {
            return NextResponse.json(
                { exists: false, error: "File ID required" },
                { status: 400 }
            );
        }

        const file = await findFileById(fileId);

        if (!file) {
            return NextResponse.json({ exists: false, isExpired: false });
        }

        const now = new Date();
        const timeExpired = file.expiresAt ? file.expiresAt < now : false;
        const downloadLimitReached =
            file.maxDownloads !== null && (file.downloads || 0) >= file.maxDownloads;

        return NextResponse.json({
            exists: true,
            isExpired: timeExpired || downloadLimitReached,
            expiredReason: downloadLimitReached
                ? "download_limit"
                : timeExpired
                    ? "time_expired"
                    : null,
        });
    } catch (error) {
        console.error("Check file error:", error);
        return NextResponse.json(
            { exists: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
