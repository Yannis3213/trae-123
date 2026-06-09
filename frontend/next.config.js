/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8004/api',
  },
};

module.exports = nextConfig;
