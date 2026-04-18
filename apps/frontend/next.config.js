// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

const enableSourceMaps = process.env.DISABLE_SOURCE_MAPS !== 'true';
const enableSentry =
  process.env.SENTRY_DISABLE !== 'true' &&
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    proxyTimeout: 90_000,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Document-Policy',
            value: 'js-profiling',
          },
        ],
      },
    ];
  },
  reactStrictMode: false,
  transpilePackages: ['crypto-hash'],
  productionBrowserSourceMaps: enableSourceMaps,

  async redirects() {
    return [
      {
        source: '/api/uploads/:path*',
        destination:
          process.env.STORAGE_PROVIDER === 'local' ? '/uploads/:path*' : '/404',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination:
          process.env.STORAGE_PROVIDER === 'local'
            ? '/api/uploads/:path*'
            : '/404',
      },
    ];
  },
};

export default enableSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        disable: !enableSourceMaps,
        assets: [
          '.next/static/**/*.js',
          '.next/static/**/*.js.map',
          '.next/server/**/*.js',
          '.next/server/**/*.js.map',
        ],
        ignore: [
          '**/node_modules/**',
          '**/*hot-update*',
          '**/_buildManifest.js',
          '**/_ssgManifest.js',
          '**/*.test.js',
          '**/*.spec.js',
        ],
        deleteSourcemapsAfterUpload: true,
      },
      release: {
        create: true,
        finalize: true,
        name:
          process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || undefined,
      },
      widenClientFileUpload: true,
      telemetry: false,
      silent: process.env.NODE_ENV === 'production',
      debug: process.env.NODE_ENV === 'development',
      errorHandler: (error) => {
        console.warn('Sentry build error:', error.message);
        return;
      },
    })
  : nextConfig;
