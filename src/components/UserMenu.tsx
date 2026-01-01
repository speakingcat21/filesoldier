"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, FileText } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

interface UserMenuProps {
    user: {
        name?: string | null;
        email?: string | null;
    } | null | undefined;
}

export default function UserMenu({ user }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        await authClient.signOut();
        setIsOpen(false);
    };

    const initials = user?.name
        ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : user?.email?.slice(0, 2).toUpperCase() || "U";

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 rounded-full bg-primary/20 text-primary font-medium text-sm flex items-center justify-center ring-1 ring-border hover:ring-primary/30 transition-all"
            >
                {initials}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    {/* User Info */}
                    <div className="p-3 border-b border-border bg-muted/30">
                        <p className="font-medium text-foreground text-sm truncate">
                            {user?.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {user?.email || ""}
                        </p>
                    </div>

                    {/* Menu Items */}
                    <div className="p-1">
                        <Link
                            href="/my-files"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            My Files
                        </Link>
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
