import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { db, files, fileHistory } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { containsExplicitContent } from "@/utils/contentFilter";
import { z } from "zod";
import { validateInput, uploadMetadataSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "encrypted-files";
const HISTORY_RETENTION_DAYS = 14;
const LIMIT_ANONYMOUS = 10 * 1024 * 1024; // 10MB
const LIMIT_USER = 50 * 1024 * 1024; // 50MB

/**
 * Confirm upload request schema
 */
const confirmRequestSchema = z.object({
    fileId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    userId: z.string().nullable().optional(),
    metadata: uploadMetadataSchema.omit({ turnstileToken: true }),
});

/**
 * Confirm upload and save metadata
 * POST /api/upload/confirm
 * 
 * This endpoint:
 * 1. Verifies the file was uploaded to storage
 * 2. Saves file metadata to database
 * 3. Creates history entry for authenticated users
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
        const body = await request.json();
        const validation = validateInput(confirmRequestSchema, body);

        if (!validation.success) {
            return NextResponse.json(
                { error: `Invalid request: ${validation.error}` },
                { status: 400 }
            );
        }

        const { fileId, metadata } = validation.data;
        const storagePath = `uploads/${fileId}.enc`;

        // Verify file exists in storage
        const { data: fileData, error: checkError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .list("uploads", {
                search: `${fileId}.enc`,
            });

        if (checkError || !fileData || fileData.length === 0) {
            return NextResponse.json(
                { error: "File not found in storage. Upload may have failed." },
                { status: 404 }
            );
        }

        // Validate file size limits (defense-in-depth - presign also checks this)
        const limit = userId ? LIMIT_USER : LIMIT_ANONYMOUS;
        if (metadata.size > limit) {
            // Remove the uploaded file since it exceeds limits
            await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
            return NextResponse.json(
                { error: `File too large. Max ${userId ? "50MB" : "10MB"}.` },
                { status: 400 }
            );
        }

        // Content moderation
        if (metadata.originalFilename && containsExplicitContent(metadata.originalFilename)) {
            // Delete the uploaded file
            await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
            return NextResponse.json(
                { error: "Filename contains inappropriate content" },
                { status: 400 }
            );
        }
        if (metadata.passwordHint && containsExplicitContent(metadata.passwordHint)) {
            await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
            return NextResponse.json(
                { error: "Password hint contains inappropriate content" },
                { status: 400 }
            );
        }

        // Save metadata to database
        const [insertedFile] = await db
            .insert(files)
            .values({
                storageId: storagePath,
                userId: userId || null,
                publicName: metadata.publicName,
                size: metadata.size,
                encryptedMetadata: metadata.encryptedMetadata,
                iv: metadata.iv,
                expiresAt: metadata.expiresAt
                    ? new Date(metadata.expiresAt)
                    : null,
                maxDownloads: metadata.maxDownloads || null,
                downloads: 0,
                passwordProtection: metadata.passwordProtection || null,
                passwordHint: metadata.passwordHint || null,
                maskFilename: metadata.maskFilename || false,
                originalFilename: metadata.originalFilename || null,
                senderMessage: metadata.senderMessage || null,
            })
            .returning();

        // Create history entry for authenticated users
        if (userId) {
            const now = new Date();
            const historyExpiresAt = new Date(
                now.getTime() + HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000
            );

            await db.insert(fileHistory).values({
                userId: userId,
                fileId: insertedFile.id,
                publicName: metadata.publicName,
                originalFilename: metadata.originalFilename || null,
                size: metadata.size,
                uploadedAt: now,
                expiresAt: metadata.expiresAt ? new Date(metadata.expiresAt) : null,
                maxDownloads: metadata.maxDownloads || null,
                downloads: 0,
                wasPasswordProtected: !!metadata.passwordProtection,
                status: "active",
                historyExpiresAt: historyExpiresAt,
            });
        }

        return NextResponse.json({
            fileId: insertedFile.id,
            success: true,
        });
    } catch (error) {
        console.error("Confirm upload error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
