import { DownloadPage } from "@/components/DownloadPage";

interface PageProps {
    params: Promise<{ fileId: string }>;
}

export default async function Page({ params }: PageProps) {
    const { fileId } = await params;
    return <DownloadPage fileId={fileId} />;
}

export async function generateMetadata({ params }: PageProps) {
    await params; // Required for dynamic route, but ID not used in metadata
    return {
        title: `Download File`,
        description: "Download your encrypted file securely.",
        robots: {
            index: false, // Don't index download pages
            follow: false,
        },
    };
}
