/** @type {import('next').NextConfig} */
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${BACKEND_PORT}/api/:path*`,
      },
    ];
  },
};

console.log(`[next.config] BACKEND_PORT=${BACKEND_PORT} (rewrite -> http://localhost:${BACKEND_PORT})`);
export default nextConfig;
