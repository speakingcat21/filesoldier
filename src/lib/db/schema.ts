import {
    pgTable,
    uuid,
    text,
    bigint,
    integer,
    boolean,
    timestamp,
    jsonb,
    index,
} from "drizzle-orm/pg-core";

/**
 * Files table - stores encrypted file metadata
 * The actual encrypted blob is stored in Supabase Storage
 */
export const files = pgTable(
    "files",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        storageId: text("storage_id").notNull(), // Supabase Storage path

        // User who uploaded (null for anonymous uploads)
        userId: text("user_id"),

        // Public metadata (visible to server/dashboard)
        publicName: text("public_name").notNull(),
        size: bigint("size", { mode: "number" }).notNull(),

        // Encrypted metadata (only decryptable with key from URL hash)
        encryptedMetadata: text("encrypted_metadata").notNull(),
        iv: text("iv").notNull(),

        // Management
        expiresAt: timestamp("expires_at", { withTimezone: true }),
        maxDownloads: integer("max_downloads"),
        downloads: integer("downloads").default(0),
        lastDownloadAt: timestamp("last_download_at", { withTimezone: true }),

        // Password protection (key wrapped with password)
        passwordProtection: jsonb("password_protection").$type<{
            salt: string;
            iv: string;
            encryptedKey: string;
            iterations?: number;
            version?: number;
        }>(),

        // Password hint (optional, shown on download page)
        passwordHint: text("password_hint"),

        // Privacy: Hide real filename on download page
        maskFilename: boolean("mask_filename").default(false),

        // Original filename (stored only when maskFilename is false)
        originalFilename: text("original_filename"),

        // Sender's identity message (unencrypted, shown before download)
        senderMessage: text("sender_message"),

        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (table) => [
        index("idx_files_user_id").on(table.userId),
        index("idx_files_storage_id").on(table.storageId),
    ]
);

/**
 * Download attempts - rate limiting for password-protected files
 */
export const downloadAttempts = pgTable(
    "download_attempts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        fileId: uuid("file_id")
            .notNull()
            .references(() => files.id, { onDelete: "cascade" }),
        attemptTime: timestamp("attempt_time", { withTimezone: true }).notNull(),
        sessionId: text("session_id").notNull(),
    },
    (table) => [
        index("idx_download_attempts_file_session").on(
            table.fileId,
            table.sessionId
        ),
        index("idx_download_attempts_time").on(table.attemptTime),
    ]
);

/**
 * Download tokens - two-phase download protection
 * Phase 1: getDownloadToken - validates access, returns token
 * Phase 2: confirmDownload - redeems token after actual download
 */
export const downloadTokens = pgTable(
    "download_tokens",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        fileId: uuid("file_id")
            .notNull()
            .references(() => files.id, { onDelete: "cascade" }),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
        used: boolean("used").default(false),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    },
    (table) => [
        index("idx_download_tokens_token").on(table.token),
        index("idx_download_tokens_file").on(table.fileId),
        index("idx_download_tokens_expires").on(table.expiresAt),
    ]
);

/**
 * File history - audit log (metadata only, persists after file deletion)
 * Auto-deleted after 14 days
 */
export const fileHistory = pgTable(
    "file_history",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id").notNull(),
        fileId: uuid("file_id").references(() => files.id, {
            onDelete: "set null",
        }),
        publicName: text("public_name").notNull(),
        originalFilename: text("original_filename"),
        size: bigint("size", { mode: "number" }).notNull(),
        uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }),
        maxDownloads: integer("max_downloads"),
        downloads: integer("downloads").default(0),
        wasPasswordProtected: boolean("was_password_protected").notNull(),
        status: text("status").notNull(), // "active", "expired", "deleted", "download_limit_reached"
        statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
        historyExpiresAt: timestamp("history_expires_at", {
            withTimezone: true,
        }).notNull(),
    },
    (table) => [
        index("idx_file_history_user").on(table.userId),
        index("idx_file_history_file").on(table.fileId),
        index("idx_file_history_expires").on(table.historyExpiresAt),
    ]
);

// Type exports for use in API routes
// ============================================
// BETTER-AUTH TABLES
// ============================================

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    username: text("username"),
    displayUsername: text("display_username"), // Added for username plugin
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull()
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id)
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull()
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at")
});

// Type exports for use in API routes
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type DownloadAttempt = typeof downloadAttempts.$inferSelect;
export type DownloadToken = typeof downloadTokens.$inferSelect;
export type FileHistory = typeof fileHistory.$inferSelect;
export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
