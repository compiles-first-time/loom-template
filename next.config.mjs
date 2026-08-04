/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app reads normalized game data from data/game/*.json at runtime.
  // Nothing here needs a server component external package override yet.
};

export default nextConfig;
