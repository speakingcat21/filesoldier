import { z } from "zod";

/**
 * Zod validation schemas for API input validation
 * Provides strict input sanitization to prevent malformed/malicious data
 */

// ============================================================
// Common Validators
// ============================================================

/**
 * Validates file ID format (nanoid 10 chars)
 */
export const fileIdSchema = z
    .string()
    .min(1, "File ID is required")
    .max(50, "File ID too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid file ID format");

/**
 * Validates session ID format
 */
export const sessionIdSchema = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional();

/**
 * Validates Turnstile token
 */
export const turnstileTokenSchema = z
    .string()
    .min(1)
    .max(5000) // Turnstile tokens can be long
    .optional();

// ============================================================
// Upload Request Validation
// ============================================================

/**
 * Password protection schema
 */
export const passwordProtectionSchema = z.object({
    salt: z.string().min(1).max(500),
    iv: z.string().min(1).max(500),
    encryptedKey: z.string().min(1).max(5000),
    iterations: z.number().int().min(10000).max(1000000).optional(),
    version: z.number().int().min(1).max(10).optional(),
});

/**
 * File upload metadata schema
 */
export const uploadMetadataSchema = z.object({
    // Required fields
    publicName: z.string().min(1).max(100),
    size: z.number().int().min(0).max(524288000), // Max 500MB
    encryptedMetadata: z.string().min(1).max(50000),
    iv: z.string().min(1).max(500),

    // Optional fields
    expiresAt: z.number().int().positive().optional(),
    maxDownloads: z.number().int().min(1).max(1000).optional(),
    passwordProtection: passwordProtectionSchema.optional().nullable(),
    passwordHint: z.string().max(200).optional().nullable(),
    maskFilename: z.boolean().optional(),
    originalFilename: z.string().max(500).optional().nullable(),
    senderMessage: z.string().max(200).optional().nullable(),
    turnstileToken: turnstileTokenSchema,
});

// ============================================================
// Download Request Validation
// ============================================================

/**
 * Download token request schema
 */
export const downloadTokenRequestSchema = z.object({
    fileId: fileIdSchema,
    sessionId: sessionIdSchema,
});

/**
 * Confirm download request schema
 */
export const confirmDownloadRequestSchema = z.object({
    fileId: fileIdSchema,
    token: z.string().min(1).max(100),
});

// ============================================================
// Delete Request Validation
// ============================================================

/**
 * Delete file request schema
 */
export const deleteFileRequestSchema = z.object({
    fileId: fileIdSchema,
});

// ============================================================
// Turnstile Verification
// ============================================================

/**
 * Turnstile verification request schema
 */
export const turnstileVerifyRequestSchema = z.object({
    token: z.string().min(1).max(5000),
});

// ============================================================
// Type Exports
// ============================================================

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
export type DownloadTokenRequest = z.infer<typeof downloadTokenRequestSchema>;
export type ConfirmDownloadRequest = z.infer<typeof confirmDownloadRequestSchema>;
export type DeleteFileRequest = z.infer<typeof deleteFileRequestSchema>;
export type TurnstileVerifyRequest = z.infer<typeof turnstileVerifyRequestSchema>;

// ============================================================
// Validation Helper
// ============================================================

/**
 * Type-safe validation helper that returns parsed data or throws
 */
export function validateInput<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    // Format Zod errors into readable message
    const errorMessage = result.error.issues
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
    return { success: false, error: errorMessage };
}
