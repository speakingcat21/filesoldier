/**
 * Password strength calculator
 * Returns strength level and score for visual feedback
 */

/**
 * Calculate password strength
 * @param {string} password
 * @returns {{ score: number, level: 'weak' | 'fair' | 'good' | 'strong', feedback: string }}
 */
export function calculatePasswordStrength(password: string) {
    if (!password) {
        return { score: 0, level: 'weak', feedback: '' };
    }

    let score = 0;
    const checks = {
        length8: password.length >= 8,
        length12: password.length >= 12,
        length16: password.length >= 16,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        numbers: /[0-9]/.test(password),
        symbols: /[^a-zA-Z0-9]/.test(password),
        noRepeating: !/(.)\1{2,}/.test(password), // No 3+ repeating chars
        noSequential: !/(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password),
    };

    // Base length scoring
    if (checks.length8) score += 1;
    if (checks.length12) score += 1;
    if (checks.length16) score += 1;

    // Character diversity
    if (checks.lowercase) score += 1;
    if (checks.uppercase) score += 1;
    if (checks.numbers) score += 1;
    if (checks.symbols) score += 1.5;

    // Pattern penalties (already handled by not adding score)
    if (checks.noRepeating) score += 0.5;
    if (checks.noSequential) score += 0.5;

    // Calculate level
    let level, feedback;
    if (score < 3) {
        level = 'weak';
        feedback = 'Add more characters and variety';
    } else if (score < 5) {
        level = 'fair';
        feedback = 'Consider adding symbols or more length';
    } else if (score < 7) {
        level = 'good';
        feedback = 'Good password strength';
    } else {
        level = 'strong';
        feedback = 'Excellent password strength';
    }

    // Normalize score to 0-100
    const normalizedScore = Math.min(100, Math.round((score / 9) * 100));

    return { score: normalizedScore, level, feedback, checks };
}

/**
 * Get color for strength level
 */
export function getStrengthColor(level: string): string {
    switch (level) {
        case 'weak': return 'var(--destructive)';
        case 'fair': return 'oklch(0.75 0.15 60)'; // Orange
        case 'good': return 'oklch(0.75 0.15 140)'; // Yellow-green
        case 'strong': return 'var(--secondary)';
        default: return 'var(--muted)';
    }
}
