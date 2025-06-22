/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // ⚠️ Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google profile images
      'lh4.googleusercontent.com', // Alternative Google profile images
      'lh5.googleusercontent.com', // Alternative Google profile images
      'lh6.googleusercontent.com', // Alternative Google profile images
      'avatars.githubusercontent.com', // GitHub profile images
      'graph.facebook.com', // Facebook profile images
      'pbs.twimg.com', // Twitter profile images
      'platform-lookaside.fbsbx.com', // Facebook platform images
      'secure.gravatar.com', // Gravatar images
      'www.gravatar.com', // Gravatar alternative
      // Add your Supabase project domain here if using Supabase storage
      // 'your-project.supabase.co',
    ],
  },
};

module.exports = nextConfig;
