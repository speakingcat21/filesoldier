import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { validateContentOrThrow } from "./contentFilter";

/**
 * 1. Generate a short-lived URL to upload the ENCRYPTED file directly to storage.
 */
export const generateUploadUrl = mutation(async (ctx) => {
    return await ctx.storage.generateUploadUrl();
});

/**
 * 2. Save file metadata to the database.
 * The server NEVER sees the encryption key or real filename.
 * - publicName: Auto-generated label (visible to server/dashboard)
 * - encryptedMetadata: Base64 encrypted JSON containing {name, type}
 */
export const saveFile = mutation({
    args: {
        storageId: v.id("_storage"),
        publicName: v.string(), // Auto-generated label
        size: v.number(),
        encryptedMetadata: v.string(), // Base64 encrypted {name, type}
        iv: v.string(),
        expiresAt: v.optional(v.number()),
        maxDownloads: v.optional(v.number()),
        passwordProtection: v.optional(v.object({
            salt: v.string(),
            iv: v.string(),
            encryptedKey: v.string(),
            iterations: v.optional(v.number()), // PBKDF2 iteration count
            version: v.optional(v.number()), // Schema version
        })),
        passwordHint: v.optional(v.string()), // Optional password hint
        maskFilename: v.optional(v.boolean()), // Hide real filename on download page
        originalFilename: v.optional(v.string()), // Store original filename when not masked
    },
    handler: async (ctx, args) => {
        // Content moderation: validate filename and password hint
        validateContentOrThrow(args.originalFilename, "Filename");
        validateContentOrThrow(args.passwordHint, "Password hint");

        const authUser = await authComponent.safeGetAuthUser(ctx);

        const fileId = await ctx.db.insert("files", {
            storageId: args.storageId,
            userId: authUser ? authUser._id : undefined,
            publicName: args.publicName,
            size: args.size,
            encryptedMetadata: args.encryptedMetadata,
            iv: args.iv,
            expiresAt: args.expiresAt,
            maxDownloads: args.maxDownloads,
            downloads: 0,
            passwordProtection: args.passwordProtection,
            passwordHint: args.passwordHint,
            maskFilename: args.maskFilename,
            originalFilename: args.originalFilename,
        });

        // Create history entry for authenticated users
        if (authUser) {
            const now = Date.now();
            const HISTORY_RETENTION_DAYS = 14;
            await ctx.db.insert("fileHistory", {
                userId: authUser._id,
                fileId: fileId, // Link to the file for download tracking
                publicName: args.publicName,
                originalFilename: args.originalFilename,
                size: args.size,
                uploadedAt: now,
                expiresAt: args.expiresAt,
                maxDownloads: args.maxDownloads,
                downloads: 0, // Initialize download count
                wasPasswordProtected: !!args.passwordProtection,
                status: "active",
                historyExpiresAt: now + (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000),
            });
        }

        return fileId;
    },
});

/**
 * 3. Retrieve file metadata for download page.
 * Returns encrypted metadata that client will decrypt with key from URL hash.
 */
export const getFileMeta = query({
    args: { fileId: v.id("files") },
    handler: async (ctx, args) => {
        const file = await ctx.db.get(args.fileId);
        if (!file) return null;

        // Lazy Expiry Check
        if (file.expiresAt && file.expiresAt < Date.now()) {
            return null;
        }

        // Check max downloads
        if (file.maxDownloads !== undefined && (file.downloads || 0) >= file.maxDownloads) {
            return null;
        }

        return {
            _id: file._id,
            publicName: file.publicName,
            size: file.size,
            encryptedMetadata: file.encryptedMetadata,
            iv: file.iv,
            expiresAt: file.expiresAt,
            maxDownloads: file.maxDownloads,
            downloads: file.downloads,
            passwordProtection: file.passwordProtection,
            passwordHint: file.passwordHint, // Password hint for user
            maskFilename: file.maskFilename, // Hide real filename flag
        };
    },
});

/**
 * 3.5 Retrieve User's Files for "My Files" dashboard.
 * Returns only management-relevant data (public labels, not encrypted metadata).
 */
export const getUserFiles = query({
    args: {},
    handler: async (ctx) => {
        const authUser = await authComponent.safeGetAuthUser(ctx);
        if (!authUser) return [];

        const files = await ctx.db
            .query("files")
            .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
            .collect();

        // Return all files with computed isExpired field for categorization
        const now = Date.now();
        return files.map(f => {
            const timeExpired = f.expiresAt ? f.expiresAt < now : false;
            const downloadLimitReached = f.maxDownloads !== undefined && (f.downloads || 0) >= f.maxDownloads;

            // Determine expiry reason (download limit takes precedence if both are true)
            let expiredReason = null;
            if (downloadLimitReached) {
                expiredReason = 'download_limit';
            } else if (timeExpired) {
                expiredReason = 'time_expired';
            }

            return {
                _id: f._id,
                _creationTime: f._creationTime,
                publicName: f.publicName,
                originalFilename: f.originalFilename,
                size: f.size,
                expiresAt: f.expiresAt,
                maxDownloads: f.maxDownloads,
                downloads: f.downloads,
                lastDownloadAt: f.lastDownloadAt,
                passwordProtection: f.passwordProtection ? true : false, // Just indicate if protected
                maskFilename: f.maskFilename || false,
                isExpired: timeExpired || downloadLimitReached,
                expiredReason,
            };
        });
    }
});

/**
 * Get user's file upload history (persists after files are deleted).
 * Returns metadata only - no access to actual files.
 */
export const getUserFileHistory = query({
    args: {},
    handler: async (ctx) => {
        const authUser = await authComponent.safeGetAuthUser(ctx);
        if (!authUser) return [];

        const history = await ctx.db
            .query("fileHistory")
            .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
            .order("desc")
            .collect();

        const now = Date.now();

        return history.map(h => {
            // Compute status dynamically based on expiration
            let computedStatus = h.status;
            if (h.status === "active" && h.expiresAt && h.expiresAt < now) {
                computedStatus = "expired";
            }

            return {
                _id: h._id,
                publicName: h.publicName,
                originalFilename: h.originalFilename,
                size: h.size,
                uploadedAt: h.uploadedAt,
                expiresAt: h.expiresAt,
                maxDownloads: h.maxDownloads,
                downloads: h.downloads || 0,
                wasPasswordProtected: h.wasPasswordProtected,
                status: computedStatus,
                statusUpdatedAt: h.statusUpdatedAt,
            };
        });
    }
});

/**
 * 4a. PHASE 1: Get a download token (validates access without incrementing counter).
 * This token must be redeemed via confirmDownload after actual download.
 * Prevents DoS attacks where attackers exhaust download limits without downloading.
 */
export const getDownloadToken = mutation({
    args: {
        fileId: v.id("files"),
        sessionId: v.optional(v.string()), // Browser session/fingerprint for rate limiting
    },
    handler: async (ctx, args) => {
        const file = await ctx.db.get(args.fileId);
        if (!file) return null;

        const now = Date.now();
        const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
        const MAX_ATTEMPTS = 5;
        const TOKEN_TTL = 5 * 60 * 1000; // 5 minutes token validity

        // Rate limiting for password-protected files
        if (file.passwordProtection && args.sessionId) {
            const sessionId = args.sessionId;
            const recentAttempts = await ctx.db
                .query("downloadAttempts")
                .withIndex("by_fileId_session", (q) =>
                    q.eq("fileId", args.fileId).eq("sessionId", sessionId)
                )
                .filter((q) => q.gt(q.field("attemptTime"), now - RATE_LIMIT_WINDOW))
                .collect();

            if (recentAttempts.length >= MAX_ATTEMPTS) {
                const oldestAttempt = Math.min(...recentAttempts.map((a) => a.attemptTime));
                const retryAfter = Math.ceil((oldestAttempt + RATE_LIMIT_WINDOW - now) / 1000 / 60);
                return {
                    error: "RATE_LIMITED",
                    message: `Too many attempts. Please try again in ${retryAfter} minutes.`,
                    retryAfterMinutes: retryAfter,
                };
            }

            // Log this attempt
            await ctx.db.insert("downloadAttempts", {
                fileId: args.fileId,
                attemptTime: now,
                sessionId: sessionId,
            });
        }

        // 1. Check Expiry
        if (file.expiresAt && file.expiresAt < now) {
            return null; // Expired
        }

        // 2. Check Max Downloads (don't increment yet)
        if (file.maxDownloads !== undefined && (file.downloads || 0) >= file.maxDownloads) {
            return null;
        }

        // 3. Generate a time-limited download token
        const token = crypto.randomUUID();
        await ctx.db.insert("downloadTokens", {
            fileId: args.fileId,
            token: token,
            createdAt: now,
            used: false,
            expiresAt: now + TOKEN_TTL,
        });

        // 4. Generate the download URL (but don't count it yet)
        const url = await ctx.storage.getUrl(file.storageId);

        return {
            url,
            token, // Client must call confirmDownload with this token
            expiresIn: TOKEN_TTL,
        };
    },
});

/**
 * 4b. PHASE 2: Confirm download and increment counter.
 * Called AFTER the client has successfully fetched and decrypted the file.
 * This is the only way to increment the download counter.
 */
export const confirmDownload = mutation({
    args: {
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Find the token
        const tokenRecord = await ctx.db
            .query("downloadTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!tokenRecord) {
            return { error: "INVALID_TOKEN", message: "Invalid or expired download token." };
        }

        // Check if token is expired
        if (tokenRecord.expiresAt < now) {
            await ctx.db.delete(tokenRecord._id); // Cleanup
            return { error: "TOKEN_EXPIRED", message: "Download token has expired." };
        }

        // Check if token was already used
        if (tokenRecord.used) {
            return { error: "TOKEN_USED", message: "Download already confirmed." };
        }

        // Get the file
        const file = await ctx.db.get(tokenRecord.fileId);
        if (!file) {
            await ctx.db.delete(tokenRecord._id);
            return { error: "FILE_NOT_FOUND", message: "File no longer exists." };
        }

        // Re-check max downloads (in case it was exhausted while downloading)
        if (file.maxDownloads !== undefined && (file.downloads || 0) >= file.maxDownloads) {
            await ctx.db.delete(tokenRecord._id);
            return { error: "LIMIT_REACHED", message: "Download limit reached." };
        }

        // Mark token as used
        await ctx.db.patch(tokenRecord._id, { used: true });

        // NOW increment the download counter (the actual commit)
        const newDownloads = (file.downloads || 0) + 1;
        await ctx.db.patch(tokenRecord.fileId, {
            downloads: newDownloads,
            lastDownloadAt: now,
        });

        // Also update the history entry's download count
        const historyEntry = await ctx.db
            .query("fileHistory")
            .withIndex("by_fileId", (q) => q.eq("fileId", tokenRecord.fileId))
            .first();

        if (historyEntry) {
            await ctx.db.patch(historyEntry._id, {
                downloads: newDownloads,
            });
        }

        return { success: true };
    },
});

/**
 * 4. DEPRECATED: Legacy download mutation (kept for backward compatibility).
 * Use getDownloadToken + confirmDownload for new implementations.
 * @deprecated Use getDownloadToken and confirmDownload instead
 */
export const downloadFile = mutation({
    args: {
        fileId: v.id("files"),
        sessionId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const file = await ctx.db.get(args.fileId);
        if (!file) return null;

        const now = Date.now();
        const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
        const MAX_ATTEMPTS = 5;

        if (file.passwordProtection && args.sessionId) {
            const sessionId = args.sessionId;
            const recentAttempts = await ctx.db
                .query("downloadAttempts")
                .withIndex("by_fileId_session", (q) =>
                    q.eq("fileId", args.fileId).eq("sessionId", sessionId)
                )
                .filter((q) => q.gt(q.field("attemptTime"), now - RATE_LIMIT_WINDOW))
                .collect();

            if (recentAttempts.length >= MAX_ATTEMPTS) {
                const oldestAttempt = Math.min(...recentAttempts.map((a) => a.attemptTime));
                const retryAfter = Math.ceil((oldestAttempt + RATE_LIMIT_WINDOW - now) / 1000 / 60);
                return {
                    error: "RATE_LIMITED",
                    message: `Too many attempts. Please try again in ${retryAfter} minutes.`,
                    retryAfterMinutes: retryAfter,
                };
            }

            await ctx.db.insert("downloadAttempts", {
                fileId: args.fileId,
                attemptTime: now,
                sessionId: sessionId,
            });
        }

        if (file.expiresAt && file.expiresAt < now) {
            return null;
        }

        if (file.maxDownloads !== undefined && (file.downloads || 0) >= file.maxDownloads) {
            return null;
        }

        await ctx.db.patch(args.fileId, {
            downloads: (file.downloads || 0) + 1,
            lastDownloadAt: now,
        });

        const url = await ctx.storage.getUrl(file.storageId);

        return { url };
    },
});

/**
 * 5. Internal mutation to clean up expired files.
 */
export const deleteExpired = internalMutation({
    handler: async (ctx) => {
        const now = Date.now();
        const expiredFiles = await ctx.db
            .query("files")
            .filter((q) => q.lt(q.field("expiresAt"), now))
            .collect();

        for (const file of expiredFiles) {
            await ctx.storage.delete(file.storageId);
            await ctx.db.delete(file._id);
        }

        // Cleanup expired download tokens
        const expiredTokens = await ctx.db
            .query("downloadTokens")
            .withIndex("by_expiresAt")
            .filter((q) => q.lt(q.field("expiresAt"), now))
            .collect();

        for (const token of expiredTokens) {
            await ctx.db.delete(token._id);
        }

        // Cleanup old download attempts (older than rate limit window)
        const oldAttempts = await ctx.db
            .query("downloadAttempts")
            .withIndex("by_attemptTime")
            .filter((q) => q.lt(q.field("attemptTime"), now - 15 * 60 * 1000))
            .collect();

        for (const attempt of oldAttempts) {
            await ctx.db.delete(attempt._id);
        }

        // Cleanup old file history entries (older than 14 days)
        const oldHistory = await ctx.db
            .query("fileHistory")
            .withIndex("by_historyExpiresAt")
            .filter((q) => q.lt(q.field("historyExpiresAt"), now))
            .collect();

        for (const history of oldHistory) {
            await ctx.db.delete(history._id);
        }
    },
});

/**
 * 6. Delete a file (User-initiated).
 */
export const deleteFile = mutation({
    args: { fileId: v.id("files") },
    handler: async (ctx, args) => {
        const authUser = await authComponent.getAuthUser(ctx);
        if (!authUser) {
            throw new Error("Not authenticated");
        }

        const file = await ctx.db.get(args.fileId);
        if (!file) {
            throw new Error("File not found");
        }

        // Verify ownership
        if (file.userId !== authUser._id) {
            throw new Error("Not authorized to delete this file");
        }

        // Delete from storage
        await ctx.storage.delete(file.storageId);

        // Delete from database
        await ctx.db.delete(args.fileId);

        return { success: true };
    },
});
