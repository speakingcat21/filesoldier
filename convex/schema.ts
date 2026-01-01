import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    files: defineTable({
        storageId: v.id("_storage"), // Reference to Convex Storage (encrypted blob)
        userId: v.optional(v.string()), // Clerk User ID

        // Public metadata (visible to server/dashboard)
        publicName: v.string(), // Auto-generated label e.g. "File-abc123"
        size: v.number(), // File size in bytes (visible for management)

        // Encrypted metadata (only decryptable with key from URL hash)
        encryptedMetadata: v.string(), // Base64 encrypted JSON: {name, type}
        iv: v.string(), // IV for decryption (shared with file encryption)

        // Management
        expiresAt: v.optional(v.number()),
        maxDownloads: v.optional(v.number()),
        downloads: v.optional(v.number()),
        lastDownloadAt: v.optional(v.number()), // Timestamp of last download

        // Password protection (key wrapped with password)
        passwordProtection: v.optional(v.object({
            salt: v.string(),
            iv: v.string(),
            encryptedKey: v.string(), // The FileKey encrypted by Password
            iterations: v.optional(v.number()), // PBKDF2 iteration count (310k default, 100k legacy)
            version: v.optional(v.number()), // Schema version for future upgrades
        })),

        // Password hint (optional, shown on download page)
        passwordHint: v.optional(v.string()),

        // Privacy: Hide real filename on download page
        maskFilename: v.optional(v.boolean()),

        // Original filename (stored only when maskFilename is false, for dashboard display)
        originalFilename: v.optional(v.string()),
    }).index("by_storageId", ["storageId"])
        .index("by_userId", ["userId"]),

    // Rate limiting for download attempts (brute-force protection)
    downloadAttempts: defineTable({
        fileId: v.id("files"),
        attemptTime: v.number(), // Timestamp of attempt
        sessionId: v.string(), // Browser fingerprint or session ID
    }).index("by_fileId", ["fileId"])
        .index("by_fileId_session", ["fileId", "sessionId"])
        .index("by_attemptTime", ["attemptTime"]), // For cleanup cron

    // Two-phase download tokens (DoS protection)
    // Phase 1: getDownloadToken - validates access, returns token
    // Phase 2: confirmDownload - redeems token after actual download
    downloadTokens: defineTable({
        fileId: v.id("files"),
        token: v.string(), // Unique download token
        createdAt: v.number(), // Timestamp for expiry
        used: v.boolean(), // Whether token has been redeemed
        expiresAt: v.number(), // Token expiry time (5 minutes)
    }).index("by_token", ["token"])
        .index("by_fileId", ["fileId"])
        .index("by_expiresAt", ["expiresAt"]), // For cleanup cron

    // File upload history (metadata only, persists after file deletion)
    // Auto-deleted after 14 days
    fileHistory: defineTable({
        userId: v.string(), // User who uploaded the file
        fileId: v.optional(v.id("files")), // Link to the file (null after deletion)
        publicName: v.string(), // Auto-generated label
        originalFilename: v.optional(v.string()), // Original filename (if available)
        size: v.number(), // File size in bytes
        uploadedAt: v.number(), // Timestamp of upload
        expiresAt: v.optional(v.number()), // When the file was set to expire
        maxDownloads: v.optional(v.number()), // Download limit set
        downloads: v.optional(v.number()), // Number of downloads
        wasPasswordProtected: v.boolean(), // Whether password was set
        status: v.string(), // "active", "expired", "deleted", "download_limit_reached"
        statusUpdatedAt: v.optional(v.number()), // When status changed
        historyExpiresAt: v.number(), // When this history entry should be deleted (14 days from upload)
    }).index("by_userId", ["userId"])
        .index("by_fileId", ["fileId"])
        .index("by_historyExpiresAt", ["historyExpiresAt"]), // For cleanup cron
});

