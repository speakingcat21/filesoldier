import { Helmet } from 'react-helmet-async';

const defaultMeta = {
    title: 'FileSoldier - Anonymous Encrypted File Sharing | Zero-Knowledge',
    description: 'Share files anonymously with military-grade AES-256 encryption. Zero-knowledge architecture means only you and your recipient can access files. No sign-up required, self-destructing links, open source.',
    keywords: 'anonymous file sharing, anonymous file transfer, encrypted file sharing, zero-knowledge file sharing, private file sharing, AES-256 encryption, secure file upload, no registration file sharing, self-destructing file links, open source file sharing, e2e encrypted, password protected file sharing',
    image: '/og-image.png',
    url: 'https://www.filesoldier.online',
};

/**
 * SEO Component for managing document head metadata
 * @param {Object} props
 * @param {string} [props.title] - Page title
 * @param {string} [props.description] - Page description
 * @param {string} [props.keywords] - Page keywords (comma-separated)
 * @param {string} [props.image] - Open Graph image URL
 * @param {string} [props.url] - Canonical URL
 * @param {boolean} [props.noIndex] - Whether to prevent indexing
 */
export default function SEO({
    title,
    description,
    keywords,
    image,
    url,
    noIndex = false,
}) {
    const pageTitle = title ? `${title} | FileSoldier` : defaultMeta.title;
    const pageDescription = description || defaultMeta.description;
    const pageKeywords = keywords || defaultMeta.keywords;
    const pageImage = image || defaultMeta.image;
    const pageUrl = url || defaultMeta.url;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{pageTitle}</title>
            <meta name="title" content={pageTitle} />
            <meta name="description" content={pageDescription} />
            <meta name="keywords" content={pageKeywords} />

            {/* Robots */}
            {noIndex && <meta name="robots" content="noindex, nofollow" />}

            {/* Canonical URL */}
            <link rel="canonical" href={pageUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={pageUrl} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={pageDescription} />
            <meta property="og:image" content={pageImage} />
            <meta property="og:site_name" content="FileSoldier" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={pageUrl} />
            <meta name="twitter:title" content={pageTitle} />
            <meta name="twitter:description" content={pageDescription} />
            <meta name="twitter:image" content={pageImage} />

            {/* Additional SEO Enhancements */}
            <meta name="theme-color" content="#18181b" />
            <meta name="application-name" content="FileSoldier" />
        </Helmet>
    );
}
