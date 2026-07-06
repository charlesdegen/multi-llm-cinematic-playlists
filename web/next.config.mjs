/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully client-side app (PKCE auth, direct Spotify Web API calls),
  // so it can be served as static files from any host.
  output: 'export',
};

export default nextConfig;
