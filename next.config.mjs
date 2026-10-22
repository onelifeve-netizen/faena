/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
