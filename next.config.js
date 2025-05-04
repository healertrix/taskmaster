/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google profile images
      'lh4.googleusercontent.com', // Alternative Google profile images
      'lh5.googleusercontent.com', // Alternative Google profile images
      'lh6.googleusercontent.com', // Alternative Google profile images
    ],
  },
};

module.exports = nextConfig;
