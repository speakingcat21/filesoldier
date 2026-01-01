"use client";

import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Clock, Download, Lock, Trash2, ArrowUpDown, Shield, Link2, Copy, Check, X, History } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "@/lib/auth-client";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase/client";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface UserFile {
    id: string;
    createdAt: string;
    publicName: string;
    originalFilename: string | null;
    size: number;
    expiresAt: number | null;
    maxDownloads: number | null;
    downloads: number;
    lastDownloadAt: number | null;
    passwordProtection: boolean;
    maskFilename: boolean;
    isExpired: boolean;
    expiredReason: string | null;
}

// Helper function for formatting - moved outside component
const formatDateTime = (timestamp: string | number) => {
    return new Date(timestamp).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getFileLink = (file: UserFile) => {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/d/${file.id}`;
};

// Extracted ViewLinkModal - prevents recreation on parent re-renders
interface ViewLinkModalProps {
    file: UserFile;
    onClose: () => void;
    copied: boolean;
    onCopy: (link: string) => void;
    t: (key: string) => string;
}

const ViewLinkModal = memo(function ViewLinkModal({ file, onClose, copied, onCopy, t }: ViewLinkModalProps) {
    const link = getFileLink(file);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" aria-label="Close modal">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{t("myFiles.shareLink")}</h3>
                        <p className="text-xs text-muted-foreground">{file.originalFilename || file.publicName}</p>
                    </div>
                </div>

                <div className="flex justify-center mb-5">
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                        <QRCodeSVG value={link} size={140} level="L" />
                    </div>
                </div>

                <div className="relative mb-4">
                    <input
                        type="text"
                        readOnly
                        value={link}
                        aria-label="Share link URL"
                        className="w-full bg-muted/50 border border-border rounded-lg p-3 pr-12 text-sm text-muted-foreground font-mono truncate focus:outline-none"
                    />
                    <button onClick={() => onCopy(link)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Copy Link" aria-label={copied ? "Link copied" : "Copy link to clipboard"}>
                        {copied ? <Check className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>

                {file.passwordProtection ? (
                    <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl">
                        <div className="flex items-start gap-2">
                            <Lock className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            <p className="text-xs text-secondary">
                                <span className="font-medium">Password protected.</span> Recipients need the password you set to decrypt this file.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                        <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-primary">
                                <span className="font-medium">Encryption key in URL.</span> The decryption key was in the original share link. Use the link you saved after upload for full access.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

// Memoized FileCard component for mobile view
interface FileCardProps {
    file: UserFile;
    deletingId: string | null;
    onViewLink: (file: UserFile) => void;
    onDelete: (fileId: string) => void;
}

const FileCard = memo(function FileCard({ file, deletingId, onViewLink, onDelete }: FileCardProps) {
    const isExpired = file.isExpired;

    return (
        <div className={`p-4 bg-card border border-border rounded-xl ${isExpired ? "opacity-60" : ""}`}>
            {/* Header: Filename + Status */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="truncate font-medium text-sm" title={file.originalFilename || file.publicName}>
                        {file.originalFilename || file.publicName}
                    </span>
                </div>
                {isExpired ? (
                    <span className="px-2 py-1 bg-destructive/10 text-destructive rounded-md text-xs font-medium whitespace-nowrap shrink-0">
                        {file.expiredReason === "download_limit" ? "Limit Reached" : "Expired"}
                    </span>
                ) : (
                    <span className="px-2 py-1 bg-secondary/10 text-secondary rounded-md text-xs font-medium whitespace-nowrap shrink-0">Active</span>
                )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground/70">Size:</span>
                    <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Download className="w-3 h-3" />
                    <span>{file.downloads || 0}{file.maxDownloads && <span className="text-muted-foreground/50">/ {file.maxDownloads}</span>}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatDateTime(file.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {file.passwordProtection ? (
                        <span className="inline-flex items-center gap-1 text-secondary">
                            <Lock className="w-3 h-3" />
                            Password
                        </span>
                    ) : (
                        <span className="text-muted-foreground/50">No password</span>
                    )}
                </div>
            </div>

            {/* Expiry info */}
            {file.expiresAt && (
                <div className="text-xs mb-3">
                    <span className="text-muted-foreground/70">Expires: </span>
                    <span className={isExpired ? "text-destructive" : "text-primary"}>{formatDateTime(file.expiresAt)}</span>
                </div>
            )}

            {/* Actions */}
            {!isExpired && (
                <div className="flex gap-2 pt-2 border-t border-border/50">
                    <button
                        onClick={() => onViewLink(file)}
                        className="flex-1 flex items-center justify-center gap-2 p-3 min-h-[44px] bg-muted hover:bg-muted/80 active:scale-[0.98] text-foreground rounded-lg text-sm font-medium transition-all"
                        aria-label="View share link"
                    >
                        <Link2 className="w-4 h-4" />
                        View Link
                    </button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="flex items-center justify-center gap-2 p-3 min-h-[44px] min-w-[44px] bg-destructive/10 hover:bg-destructive/20 active:scale-[0.98] text-destructive rounded-lg text-sm font-medium transition-all"
                                disabled={deletingId === file.id}
                                aria-label="Delete file"
                            >
                                {deletingId === file.id ? (
                                    <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border text-foreground mx-4">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete File</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                    Are you sure you want to delete <span className="font-medium text-foreground">&quot;{file.originalFilename || file.publicName}&quot;</span>?
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-accent hover:text-foreground">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(file.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    );
});

// Memoized FileRow component - prevents re-renders when other rows change (used for table on lg+)
interface FileRowProps {
    file: UserFile;
    deletingId: string | null;
    onViewLink: (file: UserFile) => void;
    onDelete: (fileId: string) => void;
}

const FileRow = memo(function FileRow({ file, deletingId, onViewLink, onDelete }: FileRowProps) {
    const isExpired = file.isExpired;

    return (
        <tr className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${isExpired ? "opacity-60" : ""}`}>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[200px] font-medium" title={file.originalFilename || file.publicName}>
                        {file.originalFilename || file.publicName}
                    </span>
                </div>
            </td>

            <td className="px-4 py-3 text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</td>

            <td className="px-4 py-3 text-muted-foreground">
                <div className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {file.downloads || 0}
                    {file.maxDownloads && <span className="text-muted-foreground/50">/ {file.maxDownloads}</span>}
                </div>
            </td>

            <td className="px-4 py-3">
                {file.passwordProtection ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/10 text-secondary rounded-md text-xs">
                        <Lock className="w-3 h-3" />
                        Yes
                    </span>
                ) : (
                    <span className="text-muted-foreground/50 text-xs">No</span>
                )}
            </td>

            <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(file.createdAt)}</td>

            <td className="px-4 py-3 text-xs">
                {file.expiresAt ? (
                    <span className={isExpired ? "text-destructive" : "text-primary"}>{formatDateTime(file.expiresAt)}</span>
                ) : (
                    <span className="text-muted-foreground/50">Never</span>
                )}
            </td>

            <td className="px-4 py-3">
                {isExpired ? (
                    <span className="px-2 py-1 bg-destructive/10 text-destructive rounded-md text-xs font-medium">
                        {file.expiredReason === "download_limit" ? "Limit Reached" : "Expired"}
                    </span>
                ) : (
                    <span className="px-2 py-1 bg-secondary/10 text-secondary rounded-md text-xs font-medium">Active</span>
                )}
            </td>

            <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                    {!isExpired && (
                        <button onClick={() => onViewLink(file)} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="View Link" aria-label="View share link">
                            <Link2 className="w-4 h-4" />
                        </button>
                    )}

                    {!isExpired && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:bg-destructive/20 rounded-lg text-muted-foreground hover:text-destructive transition-colors" disabled={deletingId === file.id} title="Delete" aria-label="Delete file">
                                    {deletingId === file.id ? (
                                        <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border text-foreground">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete File</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                        Are you sure you want to delete <span className="font-medium text-foreground">&quot;{file.originalFilename || file.publicName}&quot;</span>?
                                        This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-accent hover:text-foreground">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(file.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}

                    {isExpired && <span className="text-muted-foreground/40 text-xs px-2">—</span>}
                </div>
            </td>
        </tr>
    );
});

export function MyFiles() {
    const { data: session, isPending } = useSession();
    const router = useRouter();
    const isLoaded = !isPending;
    const [files, setFiles] = useState<UserFile[] | undefined>(undefined);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState("newest");
    const [linkModalFile, setLinkModalFile] = useState<UserFile | null>(null);
    const [copied, setCopied] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const { t } = useTranslation();

    // Redirect unauthenticated users to home page
    useEffect(() => {
        if (isLoaded && !session?.user) {
            router.replace("/");
        }
    }, [isLoaded, session, router]);

    // Fetch files function
    const fetchFiles = useCallback(async () => {
        try {
            const response = await fetch("/api/user/files");
            if (!response.ok) {
                setFiles([]);
                return;
            }
            const data = await response.json();
            setFiles(data);
        } catch {
            setFiles([]);
        }
    }, []);

    // Check if a file still exists (for safeguarding actions)
    const checkFileExists = useCallback(async (fileId: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/files/${fileId}/check`);
            if (response.ok) {
                const data = await response.json();
                return data.exists && !data.isExpired;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (session?.user) {
            fetchFiles();
        } else if (!isPending) {
            setFiles([]);
        }
    }, [session, isPending, fetchFiles]);

    // Supabase Realtime subscription for live updates
    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel('files-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'files',
                    filter: `user_id=eq.${session.user.id}`,
                },
                () => {
                    // Refetch files when any change occurs
                    fetchFiles();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id, fetchFiles]);

    const handleDelete = async (fileId: string) => {
        setDeletingId(fileId);
        setActionError(null);
        try {
            // Check if file still exists before deleting
            const exists = await checkFileExists(fileId);
            if (!exists) {
                setActionError("This file no longer exists or has expired.");
                await fetchFiles(); // Refresh the list
                return;
            }

            await fetch("/api/files/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId }),
            });
            // Refresh files
            await fetchFiles();
        } catch (err) {
            console.error("Failed to delete file:", err);
            setActionError("Failed to delete file. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    // Handle view link with existence check
    const handleViewLink = async (file: UserFile) => {
        setActionError(null);
        const exists = await checkFileExists(file.id);
        if (!exists) {
            setActionError("This file no longer exists or has expired.");
            await fetchFiles(); // Refresh the list
            return;
        }
        setLinkModalFile(file);
    };

    // Sort files
    const sortedFiles = useMemo(() => {
        if (!files) return [];

        return [...files].sort((a, b) => {
            switch (sortBy) {
                case "newest":
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case "oldest":
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case "name":
                    return (a.originalFilename || a.publicName).localeCompare(b.originalFilename || b.publicName);
                case "size":
                    return b.size - a.size;
                case "downloads":
                    return (b.downloads || 0) - (a.downloads || 0);
                default:
                    return 0;
            }
        });
    }, [files, sortBy]);

    // Memoized copyLink callback for ViewLinkModal
    const copyLink = useCallback((link: string) => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // Show loading spinner while checking auth or fetching files, or while redirecting unauthenticated users
    if (!isLoaded || files === undefined || !session?.user) {
        return (
            <div className="min-h-screen bg-background text-foreground pt-24 px-4 flex justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-background text-foreground pt-20 px-4 pb-12 selection:bg-primary/30">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <History className="w-6 h-6" />
                            {t("myFiles.title")}
                        </h1>

                        {/* Error Toast */}
                        {actionError && (
                            <div className="fixed top-20 right-4 z-50 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl flex items-center gap-3 animate-in slide-in-from-right duration-300 shadow-lg">
                                <span className="text-sm font-medium">{actionError}</span>
                                <button
                                    onClick={() => setActionError(null)}
                                    className="p-1 hover:bg-destructive/20 rounded-md transition-colors"
                                    aria-label="Dismiss error"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {files.length > 0 && (
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px] bg-muted border-border text-foreground">
                                    <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border text-popover-foreground">
                                    <SelectItem value="newest">{t("myFiles.sortNewest")}</SelectItem>
                                    <SelectItem value="oldest">{t("myFiles.sortOldest")}</SelectItem>
                                    <SelectItem value="name">{t("myFiles.sortName")}</SelectItem>
                                    <SelectItem value="size">{t("myFiles.sortSize")}</SelectItem>
                                    <SelectItem value="downloads">{t("myFiles.sortDownloads")}</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {files.length === 0 ? (
                        <div className="text-center py-20 bg-muted border border-border rounded-2xl">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                            <h3 className="text-lg font-medium text-muted-foreground">{t("myFiles.noFiles")}</h3>
                            <p className="text-muted-foreground/70 text-sm">{t("myFiles.noFilesDescription")}</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View - shown on screens smaller than lg */}
                            <div className="lg:hidden space-y-3">
                                {sortedFiles.map((file) => (
                                    <FileCard
                                        key={file.id}
                                        file={file}
                                        deletingId={deletingId}
                                        onViewLink={handleViewLink}
                                        onDelete={handleDelete}
                                    />
                                ))}
                                <div className="px-4 py-3 bg-muted/50 border border-border rounded-xl text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Files are automatically deleted after expiration or when download limits are reached.</span>
                                </div>
                            </div>

                            {/* Desktop Table View - shown on lg screens and up */}
                            <div className="hidden lg:block bg-card border border-border rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/50">
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Filename</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Size</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Downloads</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Password</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uploaded</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires</th>
                                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                                                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedFiles.map((file) => (
                                                <FileRow
                                                    key={file.id}
                                                    file={file}
                                                    deletingId={deletingId}
                                                    onViewLink={handleViewLink}
                                                    onDelete={handleDelete}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="px-4 py-2 bg-muted/50 border-t border-border/30 text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Files are automatically deleted after expiration or when download limits are reached.
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {linkModalFile && (
                <ViewLinkModal
                    file={linkModalFile}
                    onClose={() => setLinkModalFile(null)}
                    copied={copied}
                    onCopy={copyLink}
                    t={t}
                />
            )}
        </>
    );
}
