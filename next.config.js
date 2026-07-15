/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', 'docx', 'xlsx'],
  },
}
module.exports = nextConfig
