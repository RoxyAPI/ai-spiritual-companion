import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The development server otherwise appends its own block to AGENTS.md on every run, which turns a
  // hand written router into a file that rewrites itself and leaves an uncommitted change after
  // every `npm run dev`. Guidance about the framework belongs in the framework documentation.
  agentRules: false,
};

export default nextConfig;
