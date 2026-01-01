"use client";

import { useEffect, useRef, useCallback } from "react";

interface TurnstileProps {
    siteKey: string;
    onVerify: (token: string) => void;
    onError?: (errorCode: string) => void;
    onExpire?: () => void;
    theme?: "light" | "dark" | "auto";
    size?: "normal" | "compact" | "invisible";
    action?: string;
    className?: string;
}

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    theme?: string;
                    size?: string;
                    action?: string;
                    callback?: (token: string) => void;
                    "error-callback"?: (errorCode: string) => void;
                    "expired-callback"?: () => void;
                }
            ) => string;
            remove: (widgetId: string) => void;
            reset: (widgetId: string) => void;
        };
    }
}

/**
 * Cloudflare Turnstile React Component
 * Provides bot protection for forms and actions
 */
export default function Turnstile({
    siteKey,
    onVerify,
    onError,
    onExpire,
    theme = "dark",
    size = "normal",
    action,
    className = "",
}: TurnstileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const callbacksRef = useRef({ onVerify, onError, onExpire });

    // Keep callbacks ref updated without causing re-renders
    useEffect(() => {
        callbacksRef.current = { onVerify, onError, onExpire };
    }, [onVerify, onError, onExpire]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        let isMounted = true;

        const renderWidget = () => {
            if (!window.turnstile || !containerRef.current || !isMounted) return;

            // Clean up existing widget only if it exists
            if (widgetIdRef.current !== null) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Widget may have already been removed
                }
                widgetIdRef.current = null;
            }

            // Render new widget
            try {
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    theme: theme,
                    size: size,
                    action: action,
                    callback: (token: string) => {
                        callbacksRef.current.onVerify?.(token);
                    },
                    "error-callback": (errorCode: string) => {
                        console.error("Turnstile error:", errorCode);
                        callbacksRef.current.onError?.(errorCode);
                    },
                    "expired-callback": () => {
                        callbacksRef.current.onExpire?.();
                    },
                });
            } catch (e) {
                console.error("Failed to render Turnstile widget:", e);
            }
        };

        // Check if Turnstile is already loaded
        if (window.turnstile) {
            renderWidget();
        } else {
            // Wait for script to load
            intervalId = setInterval(() => {
                if (window.turnstile && isMounted) {
                    clearInterval(intervalId!);
                    intervalId = null;
                    renderWidget();
                }
            }, 100);
        }

        // Cleanup on unmount
        return () => {
            isMounted = false;

            if (intervalId) {
                clearInterval(intervalId);
            }

            // Only try to remove if widget was actually created
            if (widgetIdRef.current !== null && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Widget may have already been removed
                }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, theme, size, action]);

    return <div ref={containerRef} className={className} />;
}

// Export reset function for external use
export function useTurnstileReset() {
    const widgetRef = useRef<string | null>(null);

    const reset = useCallback(() => {
        if (widgetRef.current !== null && window.turnstile) {
            window.turnstile.reset(widgetRef.current);
        }
    }, []);

    return { widgetRef, reset };
}
