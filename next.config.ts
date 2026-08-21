import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The CLI type checker launches a detached child process, which is blocked
  // in constrained deployment/build sandboxes. TypeScript 5 still provides
  // the compiler API, so use the in-process checker.
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
