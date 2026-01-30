/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['firebasestorage.googleapis.com'],
    unoptimized: false
  },
  // API 라우트는 동적 라우트로 처리
  output: 'standalone',
  // API 라우트를 정적 생성에서 제외
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
