import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { files, downloadTokens, fileHistory } from "./schema";

/**
 * Prepared statements for frequently used queries
 * These are compiled once and reused, improving performance for hot paths
 */

// File lookup by ID - used on every download page load
export const getFileById = db
    .select()
    .from(files)
    .where(eq(files.id, sql.placeholder("id")))
    .prepare("get_file_by_id");

// Download token lookup - used for every download verification
export const getDownloadToken = db
    .select()
    .from(downloadTokens)
    .where(eq(downloadTokens.token, sql.placeholder("token")))
    .prepare("get_download_token");

// Files by user ID - used on My Files page
export const getFilesByUserId = db
    .select()
    .from(files)
    .where(eq(files.userId, sql.placeholder("userId")))
    .prepare("get_files_by_user_id");

// File history by user ID - used on My Files page
export const getFileHistoryByUserId = db
    .select()
    .from(fileHistory)
    .where(eq(fileHistory.userId, sql.placeholder("userId")))
    .prepare("get_file_history_by_user_id");

/**
 * Execute prepared queries with proper typing
 */
export async function findFileById(id: string) {
    const result = await getFileById.execute({ id });
    return result[0] ?? null;
}

export async function findDownloadToken(token: string) {
    const result = await getDownloadToken.execute({ token });
    return result[0] ?? null;
}

export async function findFilesByUserId(userId: string) {
    return await getFilesByUserId.execute({ userId });
}

export async function findFileHistoryByUserId(userId: string) {
    return await getFileHistoryByUserId.execute({ userId });
}
