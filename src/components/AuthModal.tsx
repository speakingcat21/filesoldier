"use client";

import { useState } from "react";
import { X, Eye, EyeOff, Wand2, Copy, Check, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { generatePassword } from "@/utils/passwordGenerator";
import {
    calculatePasswordStrength,
    getStrengthColor,
} from "@/utils/passwordStrength";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [passwordLength, setPasswordLength] = useState(16);

    const passwordStrength = calculatePasswordStrength(password);

    const handleGeneratePassword = () => {
        const newPassword = generatePassword(passwordLength);
        setPassword(newPassword);
        setShowPassword(true);
    };

    const copyPassword = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (mode === "signup") {
                if (username.includes("@")) {
                    setError("Username cannot contain @ symbol");
                    setIsLoading(false);
                    return;
                }

                if (username.length < 3) {
                    setError("Username must be at least 3 characters");
                    setIsLoading(false);
                    return;
                }

                await authClient.signUp.email(
                    {
                        email: `${username}@filesoldier.local`,
                        password,
                        name: name || username,
                        username: username,
                    },
                    {
                        onSuccess: () => {
                            onClose();
                        },
                        onError: (ctx) => {
                            setError(ctx.error?.message || "Sign up failed");
                        },
                    }
                );
            } else {
                await authClient.signIn.username(
                    {
                        username: username,
                        password,
                    },
                    {
                        onSuccess: () => {
                            onClose();
                        },
                        onError: (ctx) => {
                            setError(ctx.error?.message || "Invalid username or password");
                        },
                    }
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setUsername("");
        setPassword("");
        setName("");
        setError("");
        setShowPassword(false);
    };

    const switchMode = (newMode: "login" | "signup") => {
        setMode(newMode);
        resetForm();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="p-6 pb-0">
                    <h2 className="text-2xl font-bold text-foreground">
                        {mode === "login" ? "Welcome Back" : "Create Account"}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        {mode === "login"
                            ? "Sign in with your username"
                            : "Sign up with a username"}
                    </p>
                </div>

                {/* Tab Switcher */}
                <div className="flex mx-6 mt-4 p-1 bg-muted rounded-xl">
                    <button
                        onClick={() => switchMode("login")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === "login"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => switchMode("signup")}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === "signup"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name field (signup only) */}
                    {mode === "signup" && (
                        <div>
                            <label htmlFor="auth-name" className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                Display Name (optional)
                            </label>
                            <input
                                type="text"
                                id="auth-name"
                                name="name"
                                autoComplete="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full bg-background border border-border text-foreground rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/50"
                            />
                        </div>
                    )}

                    {/* Username field */}
                    <div>
                        <label htmlFor="auth-username" className="text-sm font-medium text-muted-foreground mb-1.5 block">
                            Username
                        </label>
                        <input
                            type="text"
                            id="auth-username"
                            name="username"
                            autoComplete="username"
                            value={username}
                            onChange={(e) =>
                                setUsername(
                                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                                )
                            }
                            placeholder="Enter username"
                            required
                            minLength={3}
                            maxLength={20}
                            className="w-full bg-background border border-border text-foreground rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/50"
                        />
                        {mode === "signup" && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Only lowercase letters, numbers, and underscores allowed
                            </p>
                        )}
                    </div>

                    {/* Password field */}
                    <div>
                        <label htmlFor="auth-password" className="text-sm font-medium text-muted-foreground mb-1.5 block">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="auth-password"
                                name="password"
                                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                                minLength={8}
                                maxLength={30}
                                className="w-full bg-background border border-border text-foreground rounded-xl p-3 pr-24 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/50"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {password && (
                                    <button
                                        type="button"
                                        onClick={copyPassword}
                                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                        title="Copy password"
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-secondary" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Password Strength (signup only) */}
                        {mode === "signup" && password && (
                            <div className="mt-2 space-y-1">
                                <div className="flex gap-1 h-1">
                                    {[1, 2, 3, 4].map((segment) => (
                                        <div
                                            key={segment}
                                            className="flex-1 rounded-full transition-all duration-300"
                                            style={{
                                                backgroundColor:
                                                    passwordStrength.score >= segment * 25
                                                        ? getStrengthColor(passwordStrength.level)
                                                        : "var(--muted)",
                                            }}
                                        />
                                    ))}
                                </div>
                                <p
                                    className="text-xs"
                                    style={{ color: getStrengthColor(passwordStrength.level) }}
                                >
                                    {passwordStrength.level.charAt(0).toUpperCase() +
                                        passwordStrength.level.slice(1)}
                                    : {passwordStrength.feedback}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Password Generator (signup only) */}
                    {mode === "signup" && (
                        <div className="p-3 bg-muted/50 border border-border rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Generate Secure Password
                                </span>
                                <button
                                    type="button"
                                    onClick={handleGeneratePassword}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    Generate
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">Length:</span>
                                <input
                                    type="range"
                                    min="8"
                                    max="30"
                                    value={passwordLength}
                                    onChange={(e) => setPasswordLength(Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-xs text-foreground font-medium w-8">
                                    {passwordLength}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {mode === "login" ? "Signing In..." : "Creating Account..."}
                            </>
                        ) : mode === "login" ? (
                            "Sign In"
                        ) : (
                            "Create Account"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
