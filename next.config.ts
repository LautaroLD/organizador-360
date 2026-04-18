import type { NextConfig } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version as string,
    NEXT_PUBLIC_BUILD_DATE: new Date().toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    }),
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
