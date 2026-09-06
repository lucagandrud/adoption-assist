import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise appends its own agent-rules block to CLAUDE.md on
  // every start. CLAUDE.md is the team's project brief — leave it alone.
  agentRules: false,
  // The ontology loader intentionally discovers JSON recursively so adding a
  // jurisdiction is data-only. Include those runtime files in server traces.
  outputFileTracingIncludes: {
    "/*": ["./ontology/**/*.json"],
  },
};

export default nextConfig;
