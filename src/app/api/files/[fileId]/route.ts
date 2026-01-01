import { NextRequest, NextResponse } from "next/server";
import { findFileById } from "@/lib/db/queries";

interface RouteParams {
    params: Promise<{ fileId: string }>;
}

/**
 * Get file metadata for download page
 * GET /api/files/[fileId]
 *
 * Returns encrypted metadata that client will decrypt with key from URL hash
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { fileId } = await params;

        if (!fileId) {
            return NextResponse.json({ error: "File ID required" }, { status: 400 });
        }

        // Fetch file from database using prepared statement
        const file = await findFileById(fileId);

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const now = new Date();

        // Check expiry
        if (file.expiresAt && file.expiresAt < now) {
            return NextResponse.json({ error: "File has expired" }, { status: 410 });
        }

        // Check max downloads
        if (
            file.maxDownloads !== null &&
            (file.downloads || 0) >= file.maxDownloads
        ) {
            return NextResponse.json(
                { error: "Download limit reached" },
                { status: 410 }
            );
        }

        // Return file metadata (encrypted metadata requires key from URL hash)
        return NextResponse.json({
            id: file.id,
            publicName: file.publicName,
            size: file.size,
            encryptedMetadata: file.encryptedMetadata,
            iv: file.iv,
            expiresAt: file.expiresAt?.getTime() || null,
            maxDownloads: file.maxDownloads,
            downloads: file.downloads || 0,
            passwordProtection: file.passwordProtection,
            passwordHint: file.passwordHint,
            maskFilename: file.maskFilename || false,
            senderMessage: file.senderMessage || null,
        });
    } catch (error) {
        console.error("Get file meta error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
