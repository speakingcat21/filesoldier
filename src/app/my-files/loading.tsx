export default function MyFilesLoading() {
    return (
        <div className="min-h-screen bg-background text-foreground pt-20 px-4 pb-12">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="w-48 h-8 bg-muted rounded-lg animate-pulse" />
                    <div className="w-[180px] h-10 bg-muted rounded-lg animate-pulse" />
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    {["Filename", "Size", "Downloads", "Password", "Uploaded", "Expires", "Status", "Actions"].map((header) => (
                                        <th key={header} className="text-left px-4 py-3 font-medium text-muted-foreground">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 2, 3].map((i) => (
                                    <tr key={i} className="border-b border-border/50">
                                        <td className="px-4 py-3">
                                            <div className="w-32 h-4 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-16 h-4 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-12 h-4 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-8 h-4 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-24 h-4 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-24 h-4 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-16 h-6 bg-muted rounded animate-pulse" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-16 h-8 bg-muted rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
