// AES-GCM configuration
const ALGO_NAME = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Generates a purely random 256-bit key for AES-GCM.
 * This key should be kept CLIENT-SIDE only (in URL hash).
 */
export async function generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
        {
            name: ALGO_NAME,
            length: KEY_LENGTH,
        },
        true, // extracting is allowed (we need to show it to user)
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a File object.
 * Returns { encryptedBlob, iv, ivBytes, keyString }
 * Note: ivBytes is returned for metadata encryption with same IV
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<{
    encryptedBlob: Blob;
    iv: string;
    ivBytes: Uint8Array;
    keyString: string;
}> {
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const fileBuffer = await file.arrayBuffer();

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
            name: ALGO_NAME,
            iv: iv,
        },
        key,
        fileBuffer
    );

    const exportedKey = await window.crypto.subtle.exportKey("jwk", key);

    // Convert standard base64 to URL-safe base64 for dirty URLs
    const keyString = btoa(JSON.stringify(exportedKey)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const ivString = btoa(String.fromCharCode(...iv));

    return {
        encryptedBlob: new Blob([encryptedBuffer]),
        iv: ivString,
        ivBytes: iv, // Raw IV for metadata encryption
        keyString: keyString,
    };
}

/**
 * Encrypts file metadata (name, type) with the same key.
 * Uses a different IV to avoid reuse (security best practice).
 * Returns Base64 encoded ciphertext.
 */
export async function encryptMetadata(metadata: Record<string, unknown>, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(metadata));

    // Generate new IV for metadata (different from file IV)
    const metadataIv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await window.crypto.subtle.encrypt(
        { name: ALGO_NAME, iv: metadataIv },
        key,
        data
    );

    // Combine IV + ciphertext so we can decrypt later
    const combined = new Uint8Array(metadataIv.length + encrypted.byteLength);
    combined.set(metadataIv, 0);
    combined.set(new Uint8Array(encrypted), metadataIv.length);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts file metadata. Returns { name, type }.
 * Expects the encrypted metadata to contain IV prefix.
 */
export async function decryptMetadata(encryptedMetadataB64: string, keyString: string): Promise<{ name: string; type: string; paraphrase?: string }> {
    // Import key from URL hash string
    let base64 = keyString.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jwk = JSON.parse(atob(base64));

    const key = await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: ALGO_NAME, length: KEY_LENGTH },
        true,
        ["decrypt"]
    );

    // Decode combined IV + ciphertext
    const combined = Uint8Array.from(atob(encryptedMetadataB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: ALGO_NAME, iv: iv },
        key,
        encryptedData
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Decrypts file metadata with a CryptoKey object (for password-protected files).
 */
export async function decryptMetadataWithKey(encryptedMetadataB64: string, key: CryptoKey): Promise<{ name: string; type: string; paraphrase?: string }> {
    // Decode combined IV + ciphertext
    const combined = Uint8Array.from(atob(encryptedMetadataB64), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: ALGO_NAME, iv: iv },
        key,
        encryptedData
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Decrypts a file blob.
 */
export async function decryptFile(encryptedBlob: Blob, keyString: string, ivString: string): Promise<Blob> {
    // Re-import the key
    // Fix URL-safe base64 padding
    let base64 = keyString.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const jwk = JSON.parse(atob(base64));

    const key = await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: ALGO_NAME, length: KEY_LENGTH },
        true,
        ["decrypt"]
    );

    const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));
    const buffer = await encryptedBlob.arrayBuffer();

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: ALGO_NAME,
            iv: iv,
        },
        key,
        buffer
    );

    return new Blob([decryptedBuffer]);
}

/**
 * Generates a random public name/label for the file.
 * This is what the server sees instead of the real filename.
 * Uses crypto.getRandomValues() for security instead of Math.random().
 */
export function generatePublicLabel(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const randomBytes = new Uint8Array(8);
    window.crypto.getRandomValues(randomBytes);

    let result = 'File-';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(randomBytes[i] % chars.length);
    }
    return result;
}
