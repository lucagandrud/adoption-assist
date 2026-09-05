import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise appends its own agent-rules block to CLAUDE.md on
  // every start. CLAUDE.md is the team's project brief — leave it alone.
  agentRules: false,
};

export default nextConfig;
