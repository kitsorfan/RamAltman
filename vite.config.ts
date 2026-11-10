import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Strict Content-Security-Policy for the published game: everything is served from our own
 * origin (no CDNs, no third-party fonts, no inline scripts), so nothing else is allowed.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Injects the CSP into the production build only (the dev server needs inline HMR styles). */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  // Relative asset paths so the build works from any subpath,
  // e.g. GitHub Pages project sites at https://<user>.github.io/<repo>/
  base: './',
  plugins: [contentSecurityPolicy()],
  build: {
    target: 'es2022',
    // Emit every asset (fonts included) as a file so the CSP never needs data: fonts.
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
