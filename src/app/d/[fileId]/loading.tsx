export default function DownloadLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground flex items-start justify-center p-4 pt-12">
            <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-2xl">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted animate-pulse" />
                    <div className="w-48 h-6 bg-muted rounded-lg animate-pulse" />
                    <div className="w-32 h-4 bg-muted rounded-lg animate-pulse" />
                    <div className="w-full mt-4">
                        <div className="w-full h-12 bg-muted rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}
