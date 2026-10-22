/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep a running demo separate from builds made in the same checkout.
  distDir: process.env.CLERK_NEXT_DIST_DIR || '.next',
  transpilePackages: ['@clerk/core'],
  // Parallel feature work is still landing; keep `next build` on typecheck, not lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
