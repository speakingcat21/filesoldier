/**
 * Content Filter Utility
 * Detects explicit/inappropriate content in text (filenames, messages, etc.)
 * 
 * Uses word matching with normalization to detect:
 * - Common explicit words
 * - L33tspeak variations (p0rn, pr0n, s3x, etc.)
 * - Special character substitutions (p*rn, r@pe, etc.)
 * - Spaced out letters (p o r n)
 */

// List of explicit words to detect (lowercase base forms)
const EXPLICIT_WORDS = [
    // Pornographic content
    'porn', 'porno', 'pornography', 'xxx', 'nude', 'nudes', 'naked', 'nsfw', 'hentai',
    // Sexual terms
    'sex', 'sexy', 'fuck', 'fucking', 'fucker', 'dick', 'cock', 'pussy', 'penis',
    'vagina', 'boob', 'boobs', 'tits', 'ass', 'slut', 'whore', 'bitch',
    // Violence
    'rape', 'raping', 'rapist', 'murder', 'gore',
    // Slurs & hate speech
    'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
    // Drug references
    'cocaine', 'heroin',
];

/**
 * Normalize text to catch l33tspeak and special character substitutions
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[@4]/g, 'a')
        .replace(/[1!|]/g, 'i')
        .replace(/[0]/g, 'o')
        .replace(/[3]/g, 'e')
        .replace(/[$5]/g, 's')
        .replace(/[7]/g, 't')
        .replace(/[*]/g, '')
        .replace(/[\s._\-]+/g, '') // Remove spaces, dots, underscores, dashes
        .replace(/(.)\1{2,}/g, '$1$1'); // Reduce repeated chars (e.g., "xxxxx" -> "xx")
}

/**
 * Check if text contains explicit content
 * @param {string} text - Text to check (filename, message, etc.)
 * @returns {boolean} - True if explicit content is detected
 */
export function containsExplicitContent(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    const normalizedText = normalizeText(text);

    for (const word of EXPLICIT_WORDS) {
        if (normalizedText.includes(word)) {
            return true;
        }
    }

    // Also check for "xxx" pattern (3+ x's)
    if (/x{3,}/i.test(normalizedText)) {
        return true;
    }

    return false;
}

/**
 * Validate text and return result with message
 * @param {string} text - Text to validate
 * @returns {{ isValid: boolean, message?: string }} - Validation result
 */
export function validateContent(text: string): { isValid: boolean; message?: string } {
    if (containsExplicitContent(text)) {
        return {
            isValid: false,
            message: 'Content contains inappropriate or explicit terms. Please use appropriate language.'
        };
    }

    return { isValid: true };
}

/**
 * Validate a filename
 * @param {string} filename - Filename to validate
 * @returns {{ isValid: boolean, message?: string }} - Validation result
 */
export function validateFilename(filename: string): { isValid: boolean; message?: string } {
    if (containsExplicitContent(filename)) {
        return {
            isValid: false,
            message: 'Filename contains inappropriate content. Please rename the file.'
        };
    }

    return { isValid: true };
}

/**
 * Validate a message (sender paraphrase)
 * @param {string} message - Message to validate
 * @returns {{ isValid: boolean, message?: string }} - Validation result
 */
export function validateMessage(message: string): { isValid: boolean; message?: string } {
    if (containsExplicitContent(message)) {
        return {
            isValid: false,
            message: 'Message contains inappropriate content. Please revise your message.'
        };
    }

    return { isValid: true };
}
