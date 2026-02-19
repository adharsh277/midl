/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      layers: true,
    };
    
    // Handle bitcoin-related modules
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
    });

    return config;
  },
};

module.exports = nextConfig;
