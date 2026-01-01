"use client";

import { useState, useEffect, useCallback } from "react";
import { decryptFile, decryptMetadata, decryptMetadataWithKey } from "@/utils/crypto";
import { unwrapKeyWithPassword } from "@/utils/passwordCrypto";
import { Download, AlertCircle, FileText, CheckCircle, Lock, Shield, Clock, AlertTriangle, Info, UserCheck } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Turnstile from "./Turnstile";
import { useTranslation } from "react-i18next";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

function getSessionId(): string {
    if (typeof window === "undefined") return "";
    let sessionId = sessionStorage.getItem("filesoldier_session");
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("filesoldier_session", sessionId);
    }
    return sessionId;
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return "Expired";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

interface PasswordProtection {
    encryptedKey: string;
    salt: string;
    iv: string;
    iterations?: number;
}

interface FileMeta {
    id: string;
    publicName: string;
    size: number;
    encryptedMetadata: string;
    iv: string;
    expiresAt: number | null;
    maxDownloads: number | null;
    downloads: number;
    passwordProtection: PasswordProtection | null;
    passwordHint: string | null;
    maskFilename: boolean;
    senderMessage: string | null;
}

interface CachedFileInfo {
    filename: string;
    size: number;
    publicName: string;
    downloadedAt: number;
}

interface DownloadPageProps {
    fileId: string;
}

export function DownloadPage({ fileId }: DownloadPageProps) {
    const { t } = useTranslation();

    const [fileData, setFileData] = useState<FileMeta | null | undefined>(undefined);
    const [status, setStatus] = useState<"idle" | "decrypting" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [password, setPassword] = useState("");
    const [realFilename, setRealFilename] = useState<string | null>(null);
    const [showBurnWarning, setShowBurnWarning] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
    const [cachedFileInfo, setCachedFileInfo] = useState<CachedFileInfo | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileError, setTurnstileError] = useState(false);

    // Fetch file metadata
    useEffect(() => {
        async function fetchFileMeta() {
            try {
                const response = await fetch(`/api/files/${fileId}`);
                if (!response.ok) {
                    setFileData(null);
                    return;
                }
                const data = await response.json();
                setFileData(data);
            } catch {
                setFileData(null);
            }
        }
        fetchFileMeta();
    }, [fileId]);

    // Check for cached file info
    useEffect(() => {
        if (typeof window === "undefined") return;
        const cacheKey = `filesoldier_downloaded_${fileId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                setCachedFileInfo(JSON.parse(cached));
            } catch { }
        }
    }, [fileId]);

    // Decrypt metadata on load if key is in URL
    useEffect(() => {
        if (typeof window === "undefined") return;
        const keyString = window.location.hash.slice(1);
        if (keyString && fileData?.encryptedMetadata) {
            decryptMetadata(fileData.encryptedMetadata, keyString)
                .then((meta: { name: string; type: string }) => {
                    setRealFilename(meta.name);
                })
                .catch(() => setRealFilename(null));
        }
    }, [fileData]);

    // Expiry countdown timer
    useEffect(() => {
        if (!fileData?.expiresAt) {
            setCountdown(null);
            return;
        }

        const updateCountdown = () => {
            const remaining = fileData.expiresAt! - Date.now();
            setCountdown(remaining > 0 ? remaining : 0);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [fileData?.expiresAt]);

    const executeDownload = useCallback(async () => {
        if (!fileData) return;

        try {
            setStatus("decrypting");
            setRateLimitMsg(null);

            let fileKey: CryptoKey | undefined;
            let decryptedMeta: { name: string; type: string; paraphrase?: string } | null = null;

            if (fileData.passwordProtection) {
                if (!password) throw new Error("Password required");
                if (!turnstileToken) throw new Error("Please complete the security verification.");

                const verification = await fetch("/api/turnstile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: turnstileToken }),
                }).then(r => r.json());

                if (!verification.success) {
                    setTurnstileToken(null);
                    throw new Error("Security verification failed. Please try again.");
                }

                fileKey = await unwrapKeyWithPassword(
                    fileData.passwordProtection.encryptedKey,
                    password,
                    fileData.passwordProtection.salt,
                    fileData.passwordProtection.iv,
                    fileData.passwordProtection.iterations ?? null
                );

                try {
                    decryptedMeta = await decryptMetadataWithKey(fileData.encryptedMetadata, fileKey);
                    if (decryptedMeta) {
                        setRealFilename(decryptedMeta.name);
                    }
                } catch { }
            } else {
                const keyString = window.location.hash.slice(1);
                if (!keyString) throw new Error("Missing decryption key in URL.");
            }

            // Get download token
            const result = await fetch("/api/files/download-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileId,
                    sessionId: fileData.passwordProtection ? getSessionId() : undefined,
                }),
            }).then(r => r.json());

            if (result?.error === "RATE_LIMITED") {
                setStatus("error");
                setRateLimitMsg(result.message);
                setErrorMsg(result.message);
                return;
            }

            if (!result?.url || !result?.token) throw new Error("Download limit reached or file expired.");

            const downloadToken = result.token;

            // Fetch encrypted blob
            const response = await fetch(result.url);
            if (!response.ok) throw new Error("Failed to download file.");
            const encryptedBlob = await response.blob();

            // Decrypt
            let decryptedBlob: Blob;
            if (fileData.passwordProtection && fileKey) {
                const iv = Uint8Array.from(atob(fileData.iv), c => c.charCodeAt(0));
                const buffer = await encryptedBlob.arrayBuffer();
                const decryptedBuffer = await window.crypto.subtle.decrypt(
                    { name: "AES-GCM", iv },
                    fileKey,
                    buffer
                );
                decryptedBlob = new Blob([decryptedBuffer]);
            } else {
                const keyString = window.location.hash.slice(1);
                decryptedBlob = await decryptFile(encryptedBlob, keyString, fileData.iv);
            }

            // Trigger save
            const downloadUrl = URL.createObjectURL(decryptedBlob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            const finalFilename = realFilename || decryptedMeta?.name || fileData.publicName;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);

            // Cache file info
            const cacheKey = `filesoldier_downloaded_${fileId}`;
            sessionStorage.setItem(cacheKey, JSON.stringify({
                filename: finalFilename,
                size: fileData.size,
                publicName: fileData.publicName,
                downloadedAt: Date.now(),
            }));

            setStatus("done");

            // Confirm download
            try {
                await fetch("/api/files/confirm-download", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: downloadToken }),
                });
            } catch { }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Decryption failed.");
        }
    }, [fileData, password, fileId, realFilename, turnstileToken]);

    const handleDownload = async () => {
        if (fileData?.maxDownloads === 1 && (fileData?.downloads || 0) === 0) {
            setShowBurnWarning(true);
            return;
        }
        await executeDownload();
    };

    const handleConfirmBurn = async () => {
        setShowBurnWarning(false);
        await executeDownload();
    };

    // Loading state
    if (fileData === undefined) {
        return (
            <div className="min-h-screen bg-background flex justify-center items-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // File not found
    if (fileData === null) {
        if (cachedFileInfo) {
            return (
                <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-2xl text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/10 text-secondary mb-4">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">{t("download.expired")}</h2>
                        <p className="text-muted-foreground text-sm mb-4">
                            This file was successfully downloaded and is no longer available.
                        </p>
                        <div className="p-4 bg-muted/50 rounded-xl text-left space-y-2">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground break-all">{cachedFileInfo.filename}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Download className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{(cachedFileInfo.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Downloaded {new Date(cachedFileInfo.downloadedAt).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="mt-4 p-2 bg-secondary/10 border border-secondary/20 rounded-lg">
                            <div className="flex items-center justify-center gap-2 text-xs text-secondary">
                                <Shield className="w-3.5 h-3.5" />
                                Zero-Knowledge Encryption
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                    <h2 className="text-xl font-bold text-foreground">{t("download.notFound")}</h2>
                    <p className="text-muted-foreground mt-2">This file may have expired or reached its download limit.</p>
                </div>
            </div>
        );
    }

    // Missing key check
    const keyString = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!keyString && !fileData.passwordProtection) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-2xl text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mb-4">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground mb-2">Missing Decryption Key</h1>
                    <p className="text-muted-foreground text-sm mb-4">
                        The encryption key is missing from the URL. Make sure you&apos;re using the complete share link.
                    </p>
                    <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground font-mono">
                        Expected: /d/{fileId}#[key]
                    </div>
                </div>
            </div>
        );
    }

    const isUrgent = countdown !== null && countdown < 60 * 60 * 1000;
    const isExpired = countdown === 0;

    return (
        <>
            <AlertDialog open={showBurnWarning} onOpenChange={setShowBurnWarning}>
                <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            One-Time Download Warning
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            This file is set to <strong className="text-foreground">burn after reading</strong>.
                            Once you download it, the file will be <strong className="text-foreground">permanently deleted</strong> from the server.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-muted text-muted-foreground hover:bg-muted/80">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmBurn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            I Understand, Download Now
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="min-h-screen bg-background text-foreground flex items-start justify-center p-3 sm:p-4 pt-8 sm:pt-12">
                <div className="max-w-md w-full bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-2xl text-center">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted text-muted-foreground mb-4">
                            {fileData.passwordProtection ? <Lock className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
                        </div>
                        <h1 className="text-xl font-bold text-foreground break-all">
                            {fileData.maskFilename ? fileData.publicName : (realFilename || (fileData.passwordProtection ? "Password Protected File" : "Encrypted File"))}
                        </h1>
                        <p className="text-muted-foreground text-sm mt-2">
                            {(fileData.size / 1024 / 1024).toFixed(2)} MB • End-to-End Encrypted
                        </p>

                        {countdown !== null && (
                            <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isExpired ? "bg-destructive/10 text-destructive" : isUrgent ? "bg-primary/10 text-primary animate-pulse" : "bg-muted text-muted-foreground"}`}>
                                <Clock className="w-3 h-3" />
                                {isExpired ? "Expired" : `Expires in ${formatCountdown(countdown)}`}
                            </div>
                        )}

                        {fileData.maxDownloads && (
                            <p className="text-muted-foreground/70 text-xs mt-1">
                                Downloads left: {fileData.maxDownloads - (fileData.downloads || 0)}
                            </p>
                        )}

                        {fileData.maxDownloads === 1 && (fileData.downloads || 0) === 0 && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                                <AlertTriangle className="w-3 h-3" />
                                Burns after download
                            </div>
                        )}
                    </div>

                    {fileData.senderMessage && (
                        <div className="mb-4 p-3 bg-secondary/10 border border-secondary/30 rounded-xl">
                            <div className="flex items-center gap-2 text-secondary text-xs font-medium mb-1">
                                <UserCheck className="w-4 h-4" />
                                Sender&apos;s Identity Message
                            </div>
                            <p className="text-foreground text-sm font-medium italic">&quot;{fileData.senderMessage}&quot;</p>
                        </div>
                    )}

                    <div className="mb-4 p-2 bg-secondary/10 border border-secondary/20 rounded-lg">
                        <div className="flex items-center justify-center gap-2 text-xs text-secondary">
                            <Shield className="w-3.5 h-3.5" />
                            Zero-Knowledge Encryption
                        </div>
                    </div>

                    {fileData.passwordProtection && status !== "done" && (
                        <div className="mb-4">
                            <input
                                type="password"
                                placeholder={t("download.enterPassword")}
                                aria-label="File decryption password"
                                className="w-full bg-muted border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block p-3 sm:p-2.5 min-h-[44px] mb-2"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && turnstileToken && handleDownload()}
                            />

                            {fileData.passwordHint && (
                                <div className="text-left mb-3">
                                    {showHint ? (
                                        <div className="p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                                            <span className="font-medium">Hint:</span> {fileData.passwordHint}
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowHint(true)} className="p-2 min-h-[44px] text-xs text-primary hover:underline flex items-center gap-1">
                                            <Info className="w-3 h-3" />
                                            Show password hint
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-center mb-2">
                                <Turnstile
                                    siteKey={TURNSTILE_SITE_KEY}
                                    theme="dark"
                                    onVerify={(token) => { setTurnstileToken(token); setTurnstileError(false); }}
                                    onError={() => setTurnstileError(true)}
                                    onExpire={() => setTurnstileToken(null)}
                                />
                            </div>
                            {turnstileError && <p className="text-xs text-destructive text-center">Security check failed. Please refresh.</p>}
                        </div>
                    )}

                    {status === "error" && (
                        <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">{errorMsg}</div>
                    )}

                    {status === "done" ? (
                        <div className="py-2 text-secondary font-medium flex items-center justify-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Download Complete
                        </div>
                    ) : (
                        <button
                            onClick={handleDownload}
                            disabled={status === "decrypting" || isExpired || !!rateLimitMsg || (!!fileData?.passwordProtection && !turnstileToken)}
                            className="w-full py-3.5 sm:py-3 min-h-[48px] bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === "decrypting" ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                    {t("download.decrypting")}
                                </>
                            ) : isExpired ? (
                                <>
                                    <AlertCircle className="w-5 h-5" />
                                    File Expired
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    {fileData.passwordProtection ? t("download.unlockAndDownload") : t("download.download")}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
