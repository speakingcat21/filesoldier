import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      // Prevent URL fragment (encryption key) leakage via Referer header
      'Referrer-Policy': 'no-referrer',
      // Prevent MIME sniffing attacks
      'X-Content-Type-Options': 'nosniff',
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      // Content Security Policy - restrict script sources
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://challenges.cloudflare.com https://vitals.vercel-insights.com; font-src 'self' https://fonts.gstatic.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none';",
      // Strict Transport Security (HTTPS only)
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  },
  preview: {
    headers: {
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://challenges.cloudflare.com https://vitals.vercel-insights.com; font-src 'self' https://fonts.gstatic.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none';",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  },
})

