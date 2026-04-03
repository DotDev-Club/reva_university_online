import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse and tesseract.js are Node.js-only — exclude from webpack bundling
  serverExternalPackages: ['pdf-parse', 'tesseract.js'],

  // Prevent accidental exposure of secret env vars to the browser
  // Only NEXT_PUBLIC_ vars are exposed client-side by default — this is an extra guard.
  env: {
    // Intentionally empty — all public vars use NEXT_PUBLIC_ prefix
  },
};

export default nextConfig;
