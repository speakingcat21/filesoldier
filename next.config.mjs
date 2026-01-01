import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    // Set root to this project directory to avoid lockfile conflicts
    root: __dirname,
  },

  // Optimize package imports for better tree-shaking
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-checkbox',
    ],
    // Increase body size limit for large file uploads (500MB)
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },

  // Security headers are handled in middleware.ts

  // Image optimization
  images: {
    remotePatterns: [],
  },

  // TypeScript
  typescript: {
    // Allow production builds even with type errors during migration
    ignoreBuildErrors: false,
  },

  // ESLint
  eslint: {
    // Allow production builds even with lint errors during migration
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

