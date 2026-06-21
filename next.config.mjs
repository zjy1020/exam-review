/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Required for static export with file:// protocol in Capacitor
  trailingSlash: true,
}

export default nextConfig
