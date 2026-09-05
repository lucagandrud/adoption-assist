/**
 * Auto-layout for the workflow graph.
 *
 * Positions come from dagre over the contract's `edges`. Nothing is ever
 * hand-positioned — the graph shape changes when the case changes, and a
 * hardcoded coordinate would silently lie about the dependency structure.
 */

import dagre from "dagre";
import type { GraphEdge, GraphNode } from "@/lib/types";

export const NODE_WIDTH = 268;
export const NODE_HEIGHT = 118;

export interface Positioned {
  id: string;
  x: number;
  y: number;
}

export function layout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  direction: "TB" | "LR" = "TB",
): Map<string, Positioned> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 56,
    ranksep: 84,
    marginx: 32,
    marginy: 32,
  });

  for (const node of nodes) {
    g.setNode(node.requirement_id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }
  for (const edge of edges) {
    // Skip edges naming a node that is not in the set; a partial graph should
    // still render rather than throwing during a demo.
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(g);

  const out = new Map<string, Positioned>();
  for (const node of nodes) {
    const laid = g.node(node.requirement_id);
    out.set(node.requirement_id, {
      id: node.requirement_id,
      // dagre reports centers; React Flow wants top-left.
      x: (laid?.x ?? 0) - NODE_WIDTH / 2,
      y: (laid?.y ?? 0) - NODE_HEIGHT / 2,
    });
  }
  return out;
}
