import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { db, files, fileHistory } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { containsExplicitContent } from "@/utils/contentFilter";
import { uploadMetadataSchema, validateInput } from "@/lib/validation";

// Route segment config for large file uploads
// See: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const maxDuration = 60; // 60 seconds timeout (Vercel Pro/Enterprise can go higher)
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "encrypted-files";
const HISTORY_RETENTION_DAYS = 14;

/**
 * Upload a file
 * POST /api/upload
 *
 * This endpoint handles:
 * 1. Turnstile verification (for anonymous users)
 * 2. Receiving the encrypted file blob
 * 3. Uploading to Supabase Storage
 * 4. Saving metadata to database
 */
export async function POST(request: NextRequest) {
    try {
        // Get authenticated user (if any)
        const headersList = await headers();
        const session = await auth.api.getSession({
            headers: headersList,
        });
        const userId = session?.user?.id;

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const metadataStr = formData.get("metadata") as string | null;

        if (!file || !metadataStr) {
            return NextResponse.json(
                { error: "File and metadata are required" },
                { status: 400 }
            );
        }

        // Parse and validate metadata with Zod
        let rawMetadata;
        try {
            rawMetadata = JSON.parse(metadataStr);
        } catch {
            return NextResponse.json(
                { error: "Invalid metadata JSON" },
                { status: 400 }
            );
        }

        const validation = validateInput(uploadMetadataSchema, rawMetadata);
        if (!validation.success) {
            return NextResponse.json(
                { error: `Invalid metadata: ${validation.error}` },
                { status: 400 }
            );
        }

        const metadata = validation.data;

        // Content moderation
        if (metadata.originalFilename && containsExplicitContent(metadata.originalFilename)) {
            return NextResponse.json(
                { error: "Filename contains inappropriate content" },
                { status: 400 }
            );
        }
        if (metadata.passwordHint && containsExplicitContent(metadata.passwordHint)) {
            return NextResponse.json(
                { error: "Password hint contains inappropriate content" },
                { status: 400 }
            );
        }

        // Turnstile verification for anonymous users
        if (!userId && metadata.turnstileToken) {
            const turnstileResponse = await fetch(
                `${process.env.NEXT_PUBLIC_SITE_URL}/api/turnstile`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: metadata.turnstileToken }),
                }
            );
            const turnstileResult = await turnstileResponse.json();

            if (!turnstileResult.success) {
                return NextResponse.json(
                    { error: "CAPTCHA verification failed" },
                    { status: 403 }
                );
            }
        } else if (!userId && process.env.NODE_ENV === "production") {
            // In production, require Turnstile for anonymous uploads
            return NextResponse.json(
                { error: "CAPTCHA verification required" },
                { status: 403 }
            );
        }

        // Ensure storage bucket exists
        const { error: bucketError } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET);
        if (bucketError) {
            // Bucket doesn't exist or other error, try to create it
            // We ignore the error here and let the upload fail if creation fails
            // ensuring we don't block on transient retrieve errors if the bucket actually exists
            await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
                public: true,
                fileSizeLimit: 524288000,
                allowedMimeTypes: ["application/octet-stream"],
            });
        }

        // Generate storage path
        const fileId = nanoid(10);
        const storagePath = `uploads/${fileId}.enc`;

        // Upload to Supabase Storage
        const fileBuffer = await file.arrayBuffer();
        const { error: uploadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, {
                contentType: "application/octet-stream",
                upsert: false,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return NextResponse.json(
                { error: "Failed to upload file" },
                { status: 500 }
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
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
