import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/Header";

// JSON-LD Structured Data for SEO - WebApplication Schema
const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "FileSoldier",
    "url": "https://www.filesoldier.online",
    "description": "Anonymous file sharing platform with end-to-end AES-256 encryption. Zero-knowledge architecture ensures only you and your recipient can access files. No account required, self-destructing links, open source.",
    "applicationCategory": "SecurityApplication",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript. Works on all modern browsers.",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
    },
    "featureList": [
        "End-to-end AES-256 encryption",
        "Zero-knowledge architecture",
        "Anonymous file sharing",
        "No account required",
        "Self-destructing file links",
        "Password protection",
        "Open source",
        "Download limits"
    ],
    "screenshot": "https://www.filesoldier.online/og-image.png",
    "softwareVersion": "1.0",
    "author": {
        "@type": "Organization",
        "name": "FileSoldier",
        "url": "https://www.filesoldier.online"
    }
};

// FAQ Schema for Bing Rich Results
const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "How does FileSoldier encrypt files?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "FileSoldier uses AES-256 encryption, a military-grade encryption standard. Files are encrypted entirely in your browser before upload, ensuring no one - including our servers - can read your data."
            }
        },
        {
            "@type": "Question",
            "name": "Do I need an account to share files?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "No, FileSoldier allows anonymous file sharing without any account or registration. You can upload and share files immediately."
            }
        },
        {
            "@type": "Question",
            "name": "What is zero-knowledge architecture?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Zero-knowledge means our servers never have access to your encryption keys or file contents. Only you and your intended recipient can decrypt and access the files."
            }
        },
        {
            "@type": "Question",
            "name": "Can files self-destruct after download?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes! FileSoldier offers burn-after-reading functionality where files are automatically deleted after being downloaded, as well as custom expiry times and download limits."
            }
        }
    ]
};

// Organization Schema
const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FileSoldier",
    "url": "https://www.filesoldier.online",
    "logo": "https://www.filesoldier.online/android-chrome-512x512.png",
    "sameAs": [
        "https://github.com/filesoldier"
    ]
};

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const viewport: Viewport = {
    themeColor: "#18181b",
    width: "device-width",
    initialScale: 1,
};

export const metadata: Metadata = {
    title: {
        default: "FileSoldier - Anonymous Encrypted File Sharing | Zero-Knowledge",
        template: "%s | FileSoldier",
    },
    description:
        "Share files anonymously with military-grade AES-256 encryption. Zero-knowledge architecture means only you and your recipient can access files. No sign-up required, self-destructing links, open source.",
    keywords: [
        "anonymous file sharing",
        "anonymous file transfer",
        "encrypted file sharing",
        "end-to-end encrypted file transfer",
        "zero-knowledge file sharing",
        "private file sharing",
        "secure file upload",
        "no registration file sharing",
        "self-destructing file links",
        "AES-256 encryption",
        "open source file sharing",
        "password protected file sharing",
        "e2e encrypted",
        "privacy file transfer",
    ],
    authors: [{ name: "FileSoldier" }],
    creator: "FileSoldier",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.filesoldier.online"),
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        siteName: "FileSoldier",
        title: "FileSoldier - Anonymous Encrypted File Sharing",
        description: "Share files anonymously with end-to-end AES-256 encryption. Zero-knowledge, no account required, self-destructing links.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "FileSoldier - Anonymous Encrypted File Sharing Platform",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "FileSoldier - Anonymous Encrypted File Sharing",
        description: "Share files anonymously with end-to-end AES-256 encryption. Zero-knowledge, no account required, self-destructing links.",
        images: ["/og-image.png"],
        creator: "@filesoldier",
    },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        ],
        apple: [
            { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
    },
    manifest: "/site.webmanifest",
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    // Bing Webmaster Tools verification
    verification: {
        other: {
            "msvalidate.01": "ec8f5514d2ee56e1d6bc75ce78cc18e5",
        },
    },
    category: "technology",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <head>
                {/* JSON-LD Structured Data for SEO */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
                />
            </head>
            <body className={inter.className}>
                <Providers>
                    <Header />
                    <main className="pt-20">{children}</main>
                </Providers>
                {/* Cloudflare Turnstile - loads after page is interactive */}
                <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                    strategy="afterInteractive"
                />
                {/* Vercel Analytics */}
                <Analytics />
            </body>
        </html>
    );
}

