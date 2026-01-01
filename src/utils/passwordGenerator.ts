/**
 * Secure password generator using Web Crypto API
 * Generates cryptographically random passwords
 */

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Generate a secure random password
 * @param {number} length - Password length (8-30)
 * @returns {string} Generated password
 */
export function generatePassword(length = 16) {
    // Clamp length between 8 and 30
    const safeLength = Math.max(8, Math.min(30, length));

    const allChars = LOWERCASE + UPPERCASE + NUMBERS + SPECIAL;
    const array = new Uint32Array(safeLength);
    crypto.getRandomValues(array);

    let password = '';

    // Ensure at least one character from each category
    const guaranteedChars = [
        LOWERCASE[crypto.getRandomValues(new Uint32Array(1))[0] % LOWERCASE.length],
        UPPERCASE[crypto.getRandomValues(new Uint32Array(1))[0] % UPPERCASE.length],
        NUMBERS[crypto.getRandomValues(new Uint32Array(1))[0] % NUMBERS.length],
        SPECIAL[crypto.getRandomValues(new Uint32Array(1))[0] % SPECIAL.length],
    ];

    // Fill remaining length with random characters
    for (let i = 0; i < safeLength - 4; i++) {
        password += allChars[array[i] % allChars.length];
    }

    // Shuffle in the guaranteed characters at random positions
    const positions = new Set<number>();
    while (positions.size < 4) {
        positions.add(crypto.getRandomValues(new Uint32Array(1))[0] % safeLength);
    }

    const posArray: number[] = Array.from(positions);
    const chars = password.split('');

    // Insert guaranteed chars, push existing chars
    guaranteedChars.forEach((char, idx) => {
        chars.splice(posArray[idx], 0, char);
    });

    // Trim to exact length and return
    return chars.slice(0, safeLength).join('');
}
