/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@clerk/core'],
  // Parallel feature work is still landing; keep `next build` on typecheck, not lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
