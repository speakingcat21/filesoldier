import { NextRequest, NextResponse } from "next/server";
import { db, files, fileHistory } from "@/lib/db";
import { findFileById } from "@/lib/db/queries";
import { supabaseAdmin } from "@/lib/supabase/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { deleteFileRequestSchema, validateInput } from "@/lib/validation";

const STORAGE_BUCKET = "encrypted-files";

/**
 * Delete a file (user-initiated)
 * POST /api/files/delete
 */
export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const headersList = await headers();
        const session = await auth.api.getSession({
            headers: headersList,
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await request.json();

        // Validate input with Zod
        const validation = validateInput(deleteFileRequestSchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: `Invalid request: ${validation.error}` },
                { status: 400 }
            );
        }

        const { fileId } = validation.data;

        // Get the file using prepared statement
        const file = await findFileById(fileId);

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Verify ownership
        if (file.userId !== session.user.id) {
            return NextResponse.json(
                { error: "Not authorized to delete this file" },
                { status: 403 }
            );
        }

        // Delete from Supabase Storage
        const { error: storageError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .remove([file.storageId]);

        if (storageError) {
            console.error("Storage delete error:", storageError);
            // Continue anyway - file might already be deleted
        }

        // Update history entry status
        const historyEntry = await db.query.fileHistory.findFirst({
            where: eq(fileHistory.fileId, fileId),
        });

        if (historyEntry) {
            await db
                .update(fileHistory)
                .set({
                    status: "deleted",
                    statusUpdatedAt: new Date(),
                })
                .where(eq(fileHistory.id, historyEntry.id));
        }

        // Delete from database
        await db.delete(files).where(eq(files.id, fileId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete file error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
