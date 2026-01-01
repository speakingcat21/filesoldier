"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { encryptFile, generateKey, encryptMetadata, generatePublicLabel } from "@/utils/crypto";
import { wrapKeyWithPassword } from "@/utils/passwordCrypto";
import { calculatePasswordStrength, getStrengthColor } from "@/utils/passwordStrength";
import { validateFilename, validateMessage } from "@/utils/contentFilter";
import { Upload, Lock, Check, Copy, AlertTriangle, FileText, AlertCircle, Info, X, Image as ImageIcon, Video, Music, FileArchive, FileSpreadsheet, File, Shield, Eye, EyeOff, HelpCircle, Unlock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "@/lib/auth-client";
import dynamic from "next/dynamic";

// Lazy load AuthModal - only loaded when user triggers sign in
const AuthModal = dynamic(() => import("./AuthModal"), { ssr: false });
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import Turnstile from "./Turnstile";
import { useTranslation } from "react-i18next";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

const LIMIT_ANONYMOUS = 10 * 1024 * 1024; // 10MB for free/anonymous users
const LIMIT_USER = 50 * 1024 * 1024; // 50MB for signed-in users

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(type?: string) {
    const iconClass = "w-8 h-8 text-muted-foreground";
    if (type?.startsWith("image/")) return <ImageIcon className={iconClass} />;
    if (type?.startsWith("video/")) return <Video className={iconClass} />;
    if (type?.startsWith("audio/")) return <Music className={iconClass} />;
    if (type?.includes("pdf")) return <FileText className={iconClass} />;
    if (type?.includes("zip") || type?.includes("rar") || type?.includes("7z") || type?.includes("tar") || type?.includes("gzip")) return <FileArchive className={iconClass} />;
    if (type?.includes("document") || type?.includes("word")) return <FileText className={iconClass} />;
    if (type?.includes("sheet") || type?.includes("excel")) return <FileSpreadsheet className={iconClass} />;
    return <File className={iconClass} />;
}

export function HomePage() {
    const { data: session, isPending } = useSession();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const isSignedIn = !!session?.user;
    const isLoaded = !isPending;
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrRef = useRef<HTMLDivElement>(null);

    const [status, setStatus] = useState<"idle" | "configured" | "encrypting" | "uploading" | "saving" | "done" | "error">("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shareLink, setShareLink] = useState("");
    const [copied, setCopied] = useState(false);
    const [expiry, setExpiry] = useState("3600000");
    const [downloadLimit, setDownloadLimit] = useState("1");
    const [password, setPassword] = useState("");
    const [passwordHint, setPasswordHint] = useState("");
    const [maskFilename, setMaskFilename] = useState(false);
    const [paraphrase, setParaphrase] = useState("");
    const [sizeError, setSizeError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [turnstileError, setTurnstileError] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [messageError, setMessageError] = useState<string | null>(null);

    const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);

    useEffect(() => {
        if (isLoaded) {
            if (!isSignedIn) {
                setExpiry("3600000");
            } else {
                setExpiry("86400000");
            }
        }
    }, [isSignedIn, isLoaded]);

    const validateFile = useCallback((file: File) => {
        setSizeError(null);
        setContentError(null);

        const limit = isSignedIn ? LIMIT_USER : LIMIT_ANONYMOUS;
        if (file.size > limit) {
            setSizeError(`File too large (${formatFileSize(file.size)}). Max ${formatFileSize(limit)}.`);
            return false;
        }

        const filenameCheck = validateFilename(file.name);
        if (!filenameCheck.isValid) {
            setContentError(filenameCheck.message ?? null);
            return false;
        }

        return true;
    }, [isSignedIn]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!validateFile(file)) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        setSelectedFile(file);
        setStatus("configured");
    }, [validateFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (!validateFile(file)) return;
            setSelectedFile(file);
            setStatus("configured");
        }
    }, [validateFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const handleCancel = useCallback(() => {
        setSelectedFile(null);
        setStatus("idle");
        setPassword("");
        setPasswordHint("");
        setMaskFilename(false);
        setParaphrase("");
        setSizeError(null);
        setContentError(null);
        setMessageError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const handleEncryptAndSend = async () => {
        if (!selectedFile) return;

        if (paraphrase.trim()) {
            const messageCheck = validateMessage(paraphrase);
            if (!messageCheck.isValid) {
                setMessageError(messageCheck.message ?? null);
                return;
            }
        }
        setMessageError(null);

        try {
            if (!isSignedIn) {
                if (!turnstileToken) {
                    setStatus("error");
                    setSizeError("Please complete the security verification.");
                    return;
                }
            }

            setStatus("encrypting");

            const key = await generateKey();
            const { encryptedBlob, iv, keyString } = await encryptFile(selectedFile, key);

            const metadataPayload: { name: string; type: string; paraphrase?: string } = {
                name: selectedFile.name,
                type: selectedFile.type,
            };
            if (paraphrase.trim()) {
                metadataPayload.paraphrase = paraphrase.trim();
            }
            const encryptedMetadata = await encryptMetadata(metadataPayload, key);
            const publicName = generatePublicLabel();

            let passwordProtection = undefined;
            if (password) {
                const wrapped = await wrapKeyWithPassword(key, password);
                passwordProtection = wrapped;
            }

            setStatus("uploading");

            const expiryNum = Number(expiry);

            // Step 1: Get presigned URL from our API
            const presignResponse = await fetch("/api/upload/presign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    size: selectedFile.size,
                    originalFilename: !maskFilename ? selectedFile.name : undefined,
                    turnstileToken: !isSignedIn ? turnstileToken : undefined,
                }),
            });

            if (!presignResponse.ok) {
                const errorData = await presignResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to get upload URL: ${presignResponse.status}`);
            }

            const { token, path, fileId } = await presignResponse.json();

            // Step 2: Upload directly to Supabase using signed URL
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { error: uploadError } = await supabase.storage
                .from("encrypted-files")
                .uploadToSignedUrl(path, token, encryptedBlob, {
                    contentType: "application/octet-stream",
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            setStatus("saving");

            // Step 3: Confirm upload and save metadata
            const metadata = {
                publicName,
                size: selectedFile.size,
                encryptedMetadata,
                iv,
                expiresAt: expiryNum > 0 ? Date.now() + expiryNum : undefined,
                maxDownloads: downloadLimit !== "unlimited" ? Number(downloadLimit) : undefined,
                passwordProtection,
                passwordHint: (password && passwordHint) ? passwordHint : undefined,
                maskFilename,
                originalFilename: !maskFilename ? selectedFile.name : undefined,
                senderMessage: paraphrase.trim() || undefined,
            };

            const confirmResponse = await fetch("/api/upload/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId, metadata }),
            });

            if (!confirmResponse.ok) {
                const errorData = await confirmResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to confirm upload: ${confirmResponse.status}`);
            }

            const { fileId: confirmedFileId } = await confirmResponse.json();

            const urlHash = password ? "" : `#${keyString}`;
            const link = `${window.location.origin}/d/${confirmedFileId}${urlHash}`;
            setShareLink(link);
            setStatus("done");

        } catch (err) {
            console.error(err);
            setStatus("error");
            if (err instanceof Error) {
                setSizeError(err.message);
            }
        }
    };


    const copyLink = useCallback(() => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [shareLink]);

    const downloadQR = (format: "png" | "jpeg") => {
        const container = qrRef.current;
        if (!container) return;
        const svg = container.querySelector("svg");
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const qrImg = new Image();

        qrImg.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const qrSize = 200;
            const padding = 32;
            const headerHeight = 48;
            const footerHeight = 40;
            const totalWidth = qrSize + padding * 2;
            const totalHeight = qrSize + padding * 2 + headerHeight + footerHeight;

            canvas.width = totalWidth;
            canvas.height = totalHeight;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            ctx.fillStyle = "#18181b";
            ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("FileSoldier", totalWidth / 2, headerHeight / 2 + 4);

            ctx.strokeStyle = "#e4e4e7";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding, headerHeight);
            ctx.lineTo(totalWidth - padding, headerHeight);
            ctx.stroke();

            const qrX = (totalWidth - qrSize) / 2;
            const qrY = headerHeight + 16;
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            const footerY = headerHeight + qrSize + 24;

            let displayName = selectedFile?.name || "Encrypted File";
            const maxWidth = totalWidth - 48;
            ctx.font = "500 12px system-ui, -apple-system, sans-serif";
            let textWidth = ctx.measureText(displayName).width;

            if (textWidth > maxWidth) {
                while (textWidth > maxWidth && displayName.length > 10) {
                    displayName = displayName.slice(0, -4) + "...";
                    textWidth = ctx.measureText(displayName).width;
                }
            }

            ctx.fillStyle = "#52525b";
            ctx.fillText(displayName, totalWidth / 2, footerY);

            ctx.fillStyle = "#a1a1aa";
            ctx.font = "10px system-ui, -apple-system, sans-serif";
            ctx.fillText("🔒 End-to-End Encrypted", totalWidth / 2, footerY + 18);

            const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
            const dataUrl = canvas.toDataURL(mimeType, 1.0);

            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `FileSoldier-${(selectedFile?.name || "file").replace(/[^a-zA-Z0-9]/g, "_")}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        qrImg.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    const resetForm = useCallback(() => {
        setStatus("idle");
        setSelectedFile(null);
        setShareLink("");
        setPassword("");
        setPasswordHint("");
        setMaskFilename(false);
        setParaphrase("");
        setDownloadLimit("1");
        setSizeError(null);
        setContentError(null);
        setMessageError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const isProcessing = status === "encrypting" || status === "uploading" || status === "saving";

    return (
        <>
            <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground flex items-center justify-center p-3 sm:p-6 selection:bg-primary/30">
                {/* Main Card */}
                <div className="max-w-4xl w-full bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col md:flex-row max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-8rem)] overflow-hidden">

                    {/* Left Column: Visual / Dropzone / QR */}
                    <div
                        className="w-full md:w-1/2 bg-muted/50 p-4 sm:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border relative group transition-colors min-h-[300px] sm:min-h-[400px]"
                        onDrop={status === "idle" ? handleDrop : undefined}
                        onDragOver={status === "idle" ? handleDragOver : undefined}
                    >

                        {status === "done" ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-5 animate-in fade-in slide-in-from-left duration-500">
                                {/* QR Code */}
                                <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-xl">
                                    <QRCodeSVG value={shareLink} size={160} level={"L"} />
                                </div>

                                {/* Share Link */}
                                <div className="w-full max-w-xs space-y-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            readOnly
                                            value={shareLink}
                                            aria-label="Share link URL"
                                            className="w-full bg-background/50 border border-border rounded-lg p-2.5 pr-10 text-xs text-muted-foreground font-mono truncate focus:outline-none"
                                        />
                                        <button
                                            onClick={copyLink}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                            title="Copy Link"
                                            aria-label={copied ? "Link copied" : "Copy link to clipboard"}
                                        >
                                            {copied ? <Check className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Security Warning */}
                                {!password && (
                                    <div className="w-full max-w-xs p-3 bg-primary/10 border border-primary/20 rounded-xl">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                            <p className="text-xs text-primary">
                                                <span className="font-medium">Save this link!</span> It contains your encryption key. If you lose it, you cannot decrypt this file.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Password protected note */}
                                {password && (
                                    <div className="w-full max-w-xs p-3 bg-secondary/10 border border-secondary/20 rounded-xl">
                                        <div className="flex items-start gap-2">
                                            <Lock className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                                            <p className="text-xs text-secondary">
                                                <span className="font-medium">Password protected.</span> Share the password separately via a secure channel.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Download QR Buttons */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => downloadQR("png")}
                                        className="px-4 py-2 text-xs font-medium bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg transition-colors"
                                    >
                                        Save as PNG
                                    </button>
                                    <button
                                        onClick={() => downloadQR("jpeg")}
                                        className="px-4 py-2 text-xs font-medium bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg transition-colors"
                                    >
                                        Save as JPEG
                                    </button>
                                </div>
                            </div>
                        ) : status === "configured" || isProcessing ? (
                            // File Preview Card with Progress
                            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in duration-300">
                                <div className="w-full max-w-xs p-6 bg-background/80 border border-border rounded-2xl shadow-lg">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                            {getFileIcon(selectedFile?.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate" title={selectedFile?.name}>
                                                {selectedFile?.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatFileSize(selectedFile?.size || 0)}
                                            </p>
                                        </div>
                                        {!isProcessing && (
                                            <button
                                                onClick={handleCancel}
                                                className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                title="Remove file"
                                                aria-label="Remove selected file"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Detailed Progress Indicator */}
                                    {isProcessing && (
                                        <div className="mt-5 space-y-4">
                                            {/* Phase Steps */}
                                            <div className="flex items-center justify-between">
                                                {/* Encrypting Phase */}
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${status === "encrypting"
                                                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                                        : status === "uploading" || status === "saving"
                                                            ? "bg-secondary text-secondary-foreground"
                                                            : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {status === "encrypting" ? (
                                                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                                        ) : status === "uploading" || status === "saving" ? (
                                                            <Check className="w-4 h-4" />
                                                        ) : (
                                                            <Lock className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-medium ${status === "encrypting" ? "text-primary" : "text-muted-foreground"}`}>
                                                        {t("home.encrypting")}
                                                    </span>
                                                </div>

                                                {/* Connector */}
                                                <div className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${status === "uploading" || status === "saving" ? "bg-secondary" : "bg-muted"
                                                    }`} />

                                                {/* Uploading Phase */}
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${status === "uploading"
                                                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                                        : status === "saving"
                                                            ? "bg-secondary text-secondary-foreground"
                                                            : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {status === "uploading" ? (
                                                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                                        ) : status === "saving" ? (
                                                            <Check className="w-4 h-4" />
                                                        ) : (
                                                            <Upload className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-medium ${status === "uploading" ? "text-primary" : "text-muted-foreground"}`}>
                                                        {t("home.uploading")}
                                                    </span>
                                                </div>

                                                {/* Connector */}
                                                <div className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${status === "saving" ? "bg-secondary" : "bg-muted"
                                                    }`} />

                                                {/* Saving Phase */}
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${status === "saving"
                                                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                                        : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {status === "saving" ? (
                                                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Shield className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-medium ${status === "saving" ? "text-primary" : "text-muted-foreground"}`}>
                                                        Secure
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Current Phase Text */}
                                            {status === "uploading" && (
                                                <p className="text-xs text-center text-muted-foreground">
                                                    Uploading encrypted file...
                                                </p>
                                            )}
                                            {status === "encrypting" && (
                                                <p className="text-xs text-center text-muted-foreground">
                                                    Encrypting your file with AES-256...
                                                </p>
                                            )}
                                            {status === "saving" && (
                                                <p className="text-xs text-center text-muted-foreground">
                                                    Generating secure share link...
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* AES badge inside card - only show when not processing */}
                                    {!isProcessing && (
                                        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border/50">
                                            <Lock className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground">AES-256 End-to-End Encryption</span>
                                        </div>
                                    )}
                                </div>

                                {/* Mask Filename Checkbox */}
                                {!isProcessing && (
                                    <label
                                        htmlFor="mask-filename-checkbox"
                                        className={`w-full max-w-xs flex items-center gap-2.5 p-3 border rounded-xl cursor-pointer transition-all group ${maskFilename
                                            ? "border-primary/70 bg-primary/5 hover:bg-primary/10"
                                            : "border-border bg-background/80 hover:bg-muted/50"
                                            }`}
                                    >
                                        <Checkbox
                                            id="mask-filename-checkbox"
                                            checked={maskFilename}
                                            onCheckedChange={(checked: boolean | "indeterminate") => setMaskFilename(checked === true)}
                                            className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[11px] font-semibold block truncate transition-colors uppercase tracking-wider ${maskFilename ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                                    }`}>Mask Filename</span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-muted-foreground/70 hover:text-primary transition-colors">
                                                            <Info className="w-3 h-3" />
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[200px]">
                                                        When enabled, the download page will show a generic name instead of the real filename for added privacy.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/50 truncate">Hide real filename on download page</p>
                                        </div>
                                    </label>
                                )}
                            </div>
                        ) : (
                            // Dropzone (idle state)
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileSelect}
                                    aria-label="Choose file to upload"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                />

                                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 hover:bg-muted/80 rounded-2xl transition-colors">
                                    <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-1 ring-border group-hover:ring-primary/30">
                                        <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-foreground text-lg font-semibold max-w-[220px] mx-auto leading-relaxed">
                                            {t("home.dropzone")}
                                        </p>
                                    </div>
                                    <div className={`text-sm px-4 py-2 rounded-xl ${(sizeError || contentError) ? "bg-destructive/10 text-destructive font-medium border border-destructive/30" : "bg-primary/10 text-primary/90 border border-primary/20"}`}>
                                        {contentError ? contentError : sizeError ? sizeError : (
                                            isSignedIn
                                                ? "Up to 50MB • AES-256 Encrypted"
                                                : "Up to 10MB (50MB with account) • AES-256 Encrypted"
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Column: Settings / Success Details */}
                    <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col justify-center bg-card overflow-y-auto">

                        {status === "done" ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-500">
                                {/* File Info */}
                                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border">
                                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-muted-foreground">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{selectedFile?.name || "Encrypted File"}</p>
                                        <p className="text-xs text-secondary flex items-center gap-1">
                                            <Check className="w-3 h-3" /> {t("home.success")}
                                        </p>
                                    </div>
                                </div>

                                {/* Zero-Knowledge Info */}
                                <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl">
                                    <div className="flex items-start gap-2">
                                        <Lock className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                                        <p className="text-xs text-secondary">
                                            <span className="font-medium">Zero-Knowledge:</span> The server cannot see your filename or decrypt your file.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <button
                                        onClick={resetForm}
                                        className="w-full py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all text-sm font-medium"
                                    >
                                        {t("home.sendAnother")}
                                    </button>
                                </div>
                            </div>
                        ) : status === "idle" ? (
                            // Idle state - prompt to select file
                            <div className="space-y-5">
                                {!isSignedIn && isLoaded && (
                                    <div className="p-3 bg-primary/15 border border-primary/40 rounded-xl flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
                                        <div>
                                            <p className="text-primary text-sm font-medium">Anonymous Upload</p>
                                            <p className="text-primary text-xs mt-0.5">
                                                10MB limit, deleted in 1 hour. <span onClick={() => setShowAuthModal(true)} className="underline cursor-pointer text-primary font-medium hover:opacity-80">Sign in</span> to configure expiry limit.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 bg-muted/30 border border-dashed border-border rounded-xl text-center">
                                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        Select a file to configure encryption settings
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // Configuration state
                            <div className="space-y-3">
                                {/* Warning Badge */}
                                {!isSignedIn && isLoaded && (
                                    <div className="p-3 bg-primary/15 border border-primary/40 rounded-xl flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
                                        <div>
                                            <p className="text-primary text-sm font-bold">Anonymous Upload</p>
                                            <p className="text-primary text-xs mt-0.5">
                                                10MB limit, deleted in 1 hour. <span onClick={() => setShowAuthModal(true)} className="underline cursor-pointer text-primary font-medium hover:opacity-80">Sign in</span> to configure expiry limit.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Settings Form */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* File Expiry - Left Side */}
                                        <div className="col-span-1">
                                            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                                File Expiry
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-muted-foreground/70 hover:text-primary transition-colors">
                                                            <Info className="w-4 h-4" />
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[200px]">
                                                        How long the file will be available before automatic deletion. Sign in for more options.
                                                    </TooltipContent>
                                                </Tooltip>
                                                {!isSignedIn && (
                                                    <span onClick={() => setShowAuthModal(true)} className="cursor-pointer text-primary hover:text-primary/80 ml-auto" title="Sign in to unlock">
                                                        <Unlock className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </label>
                                            <Select
                                                value={expiry}
                                                onValueChange={setExpiry}
                                                disabled={isProcessing || !isSignedIn}
                                            >
                                                <SelectTrigger className={`w-full bg-background border-border text-sm rounded-xl p-3 sm:p-2.5 min-h-[44px] ${!isSignedIn ? "text-muted-foreground opacity-70 cursor-not-allowed" : "text-foreground"}`}>
                                                    <SelectValue placeholder="Select expiry" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-popover border-border text-popover-foreground">
                                                    <SelectItem value="600000">10 Minutes</SelectItem>
                                                    <SelectItem value="1800000">30 Minutes</SelectItem>
                                                    <SelectItem value="3600000">1 Hour</SelectItem>
                                                    <SelectItem value="18000000">5 Hours</SelectItem>
                                                    <SelectItem value="86400000">24 Hours</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Download Limit - Right Side */}
                                        <div className="col-span-1">
                                            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                                Download Limit
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-muted-foreground/70 hover:text-primary transition-colors">
                                                            <Info className="w-4 h-4" />
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[200px]">
                                                        Maximum number of times the file can be downloaded. File is deleted after reaching this limit.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </label>
                                            <Select
                                                value={downloadLimit}
                                                onValueChange={setDownloadLimit}
                                                disabled={isProcessing}
                                            >
                                                <SelectTrigger className="w-full bg-background border-border text-sm rounded-xl p-3 sm:p-2.5 min-h-[44px] text-foreground">
                                                    <SelectValue placeholder="Select limit" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-popover border-border text-popover-foreground">
                                                    <SelectItem value="1">1 (Burn after read)</SelectItem>
                                                    {!isSignedIn && <SelectItem value="2">2 downloads</SelectItem>}
                                                    {!isSignedIn && <SelectItem value="3">3 downloads</SelectItem>}
                                                    {!isSignedIn && <SelectItem value="4">4 downloads</SelectItem>}
                                                    <SelectItem value="5">5 downloads</SelectItem>
                                                    {isSignedIn && <SelectItem value="10">10 downloads</SelectItem>}
                                                    {isSignedIn && <SelectItem value="25">25 downloads</SelectItem>}
                                                    {isSignedIn && <SelectItem value="50">50 downloads</SelectItem>}
                                                    {isSignedIn && <SelectItem value="100">100 downloads</SelectItem>}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Helper Text for Restrictions Row */}
                                        <div className="col-span-2">
                                            <p className="text-[11px] text-muted-foreground/50 text-left">
                                                {downloadLimit === "1"
                                                    ? "⚡ Burn after read: File deletes immediately after one access"
                                                    : "File is deleted when either limit is reached."}
                                            </p>
                                        </div>


                                        {/* Password Protection */}
                                        <div className="col-span-2">
                                            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                                Password Protection
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-muted-foreground/70 hover:text-primary transition-colors">
                                                            <Info className="w-4 h-4" />
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[220px]">
                                                        Add a password for extra security. Recipients will need this password to decrypt and download the file.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter a strong password..."
                                                    aria-label="Password protection"
                                                    className="w-full bg-background border border-border text-foreground text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 block p-3 sm:p-2.5 pr-12 min-h-[44px] transition-all placeholder:text-muted-foreground/50"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    disabled={isProcessing}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                    title={showPassword ? "Hide password" : "Show password"}
                                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>

                                            {/* Password Strength Meter */}
                                            {password && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex gap-1 h-1">
                                                        {[1, 2, 3, 4].map((segment) => (
                                                            <div
                                                                key={segment}
                                                                className="flex-1 rounded-full transition-all duration-300"
                                                                style={{
                                                                    backgroundColor: passwordStrength.score >= segment * 25
                                                                        ? getStrengthColor(passwordStrength.level)
                                                                        : "var(--muted)",
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px]" style={{ color: getStrengthColor(passwordStrength.level) }}>
                                                        {passwordStrength.level.charAt(0).toUpperCase() + passwordStrength.level.slice(1)}: {passwordStrength.feedback}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Password Hint */}
                                    {password && (
                                        <>
                                            <div className="col-span-2 mt-2">
                                                <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                                    Password Hint
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help text-muted-foreground/70 hover:text-primary transition-colors">
                                                                <Info className="w-4 h-4" />
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[220px]">
                                                            Optional clue shown to the recipient to help them remember the password. Don&apos;t include the actual password!
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </label>
                                                <div className="relative">
                                                    <HelpCircle className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., 'Our favorite movie'"
                                                        aria-label="Password hint"
                                                        className="w-full bg-background border border-border text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block p-3 sm:p-2.5 pl-10 min-h-[44px] transition-all placeholder:text-muted-foreground/50"
                                                        value={passwordHint}
                                                        onChange={(e) => setPasswordHint(e.target.value)}
                                                        disabled={isProcessing}
                                                        maxLength={100}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}



                                    {/* Identifying Message */}
                                    <div className="col-span-2">
                                        <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                            Sender Message
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="cursor-help text-muted-foreground/70 hover:text-primary transition-colors">
                                                        <Info className="w-4 h-4" />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-[200px]">
                                                    A message shown to the recipient so they can verify who sent this file. Encrypted along with your file.
                                                </TooltipContent>
                                            </Tooltip>
                                        </label>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="e.g., 'From your colleague at Acme Corp'"
                                                aria-label="Sender message"
                                                className={`w-full bg-background border text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block p-3 sm:p-2.5 min-h-[44px] transition-all placeholder:text-muted-foreground/50 ${messageError ? "border-destructive focus:border-destructive focus:ring-destructive" : "border-border"}`}
                                                value={paraphrase}
                                                onChange={(e) => {
                                                    setParaphrase(e.target.value);
                                                    if (messageError) setMessageError(null);
                                                }}
                                                disabled={isProcessing}
                                                maxLength={150}
                                            />
                                        </div>
                                        {messageError && (
                                            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {messageError}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Turnstile for Anonymous Users */}
                                {!isSignedIn && isLoaded && (
                                    <div className="pt-2 flex flex-col items-center">
                                        <Turnstile
                                            siteKey={TURNSTILE_SITE_KEY}
                                            theme="dark"
                                            size="normal"
                                            onVerify={(token) => {
                                                setTurnstileToken(token);
                                                setTurnstileError(false);
                                                setSizeError(null);
                                            }}
                                            onError={() => setTurnstileError(true)}
                                            onExpire={() => setTurnstileToken(null)}
                                        />
                                        {turnstileError && (
                                            <p className="text-xs text-destructive mt-1">Security check failed. Please refresh.</p>
                                        )}
                                    </div>
                                )}

                                {/* Action Button */}
                                <div className="pt-4">
                                    <button
                                        onClick={handleEncryptAndSend}
                                        disabled={isProcessing || (!isSignedIn && !turnstileToken)}
                                        className="w-full py-3.5 sm:py-3 min-h-[48px] bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-extrabold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                                {status === "encrypting" && "Encrypting..."}
                                                {status === "uploading" && "Uploading..."}
                                                {status === "saving" && "Generating Link..."}
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-5 h-5" />
                                                Generate Secure Link
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            </div >
        </>
    );
}
