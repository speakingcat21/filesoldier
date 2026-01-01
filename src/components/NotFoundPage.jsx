import { Link } from 'react-router-dom';
import { FileQuestion, Home, Upload } from 'lucide-react';
import SEO from './SEO';

export default function NotFoundPage() {
    return (
        <>
            <SEO
                title="404 - Page Not Found"
                description="The page you're looking for doesn't exist."
                noIndex={true}
            />
            <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center">
                    {/* Icon */}
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted text-muted-foreground mb-6">
                        <FileQuestion className="w-10 h-10" />
                    </div>

                    {/* Heading */}
                    <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
                    <h2 className="text-xl font-semibold text-foreground mb-4">Page Not Found</h2>

                    {/* Description */}
                    <p className="text-muted-foreground text-sm mb-8 max-w-xs mx-auto">
                        The page you're looking for doesn't exist or may have been moved.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Go Home
                        </Link>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-xl transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            Upload a File
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
