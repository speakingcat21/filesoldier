/**
 * Password-based key derivation and wrapping utilities.
 * Uses PBKDF2 with high iteration count for brute-force resistance.
 * 
 * SECURITY NOTE: Iteration count upgraded to 310,000 per OWASP 2023.
 * Backward compatibility maintained via version/iterations metadata.
 */

// Current iteration count (OWASP 2023 recommendation for SHA-256)
const CURRENT_ITERATIONS = 310000;
// Legacy iteration count for backward compatibility
const LEGACY_ITERATIONS = 100000;

/**
 * Derives a key from a password using PBKDF2.
 * Returns the derived key as a hex string.
 */
export async function derivePasswordKey(password: string, saltString: string, iterations: number = CURRENT_ITERATIONS): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const salt = Uint8Array.from(atob(saltString), c => c.charCodeAt(0));

    const derivedKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    return derivedKey;
}

/**
 * Wraps (encrypts) a FileKey with a password-derived key.
 * Returns metadata needed for unwrapping, including iteration count
 * for forward/backward compatibility.
 */
export async function wrapKeyWithPassword(fileKey: CryptoKey, password: string) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltString = btoa(String.fromCharCode(...salt));

    const passwordKey = await derivePasswordKey_Simple(password, salt, CURRENT_ITERATIONS);

    // Export the FileKey to buffer
    const fileKeyRaw = await window.crypto.subtle.exportKey("raw", fileKey);

    // Encrypt the FileKey with PasswordKey
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        passwordKey,
        fileKeyRaw
    );

    return {
        encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKeyBuffer))),
        salt: saltString,
        iv: btoa(String.fromCharCode(...iv)),
        // Store iteration count for future-proofing
        iterations: CURRENT_ITERATIONS,
        version: 2, // v2 = 310k iterations
    };
}

/**
 * Unwraps (decrypts) a FileKey using password.
 * Supports both legacy (100k) and current (310k) iteration counts
 * by reading the iterations field from metadata.
 */
export async function unwrapKeyWithPassword(
    encryptedKeyStr: string,
    password: string,
    saltStr: string,
    ivStr: string,
    iterations: number | null | undefined = null
): Promise<CryptoKey> {
    const salt = Uint8Array.from(atob(saltStr), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
    const encryptedKey = Uint8Array.from(atob(encryptedKeyStr), c => c.charCodeAt(0));

    // Use provided iterations, or fall back to legacy for old files
    const iterationCount = iterations || LEGACY_ITERATIONS;
    const passwordKey = await derivePasswordKey_Simple(password, salt, iterationCount);

    try {
        const fileKeyRaw = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            passwordKey,
            encryptedKey
        );

        return await window.crypto.subtle.importKey(
            "raw",
            fileKeyRaw,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    } catch {
        throw new Error("Incorrect Password");
    }
}

/**
 * Internal helper for key derivation with configurable iterations.
 */
async function derivePasswordKey_Simple(password: string, salt: BufferSource, iterations: number = CURRENT_ITERATIONS): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

