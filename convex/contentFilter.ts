/**
 * Content Filter Utility for Convex (Server-Side)
 * Detects explicit/inappropriate content in text (filenames, messages, etc.)
 * 
 * This is the TypeScript version for server-side validation (defense in depth).
 */

// List of explicit words to detect (lowercase base forms)
// Using simple word matching with normalization for l33tspeak
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
 */
export function containsExplicitContent(text: string | undefined | null): boolean {
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
 * Validate content and throw error if explicit
 */
export function validateContentOrThrow(text: string | undefined | null, fieldName: string): void {
    if (containsExplicitContent(text)) {
        throw new Error(`${fieldName} contains inappropriate content.`);
    }
}
