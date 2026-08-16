/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['sb-5hk1frbmzk0m.vercel.run', 'alamoudi-data-5.v0.build'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
