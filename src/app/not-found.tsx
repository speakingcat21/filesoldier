import Link from "next/link";
import { FileX } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Page Not Found",
    description: "The page you are looking for does not exist.",
};

export default function NotFound() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
            <div className="text-center">
                <FileX className="w-20 h-20 text-muted-foreground mx-auto mb-6" />
                <h1 className="text-4xl font-bold text-foreground mb-3">404</h1>
                <h2 className="text-xl text-muted-foreground mb-6">Page Not Found</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                    The page you are looking for might have been removed, had its name
                    changed, or is temporarily unavailable.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors"
                >
                    Go to Homepage
                </Link>
            </div>
        </div>
    );
}
