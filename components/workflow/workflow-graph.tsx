"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layout } from "@/lib/graph-layout";
import {
  RequirementNode,
  type RequirementNodeType,
} from "@/components/workflow/requirement-node";
import type { GraphModel } from "@/lib/types";

const nodeTypes = { requirement: RequirementNode };

/**
 * The graph is derived: node positions come from dagre over the contract's
 * `edges`, never from hand-placed coordinates. Change the case and the shape
 * changes with it.
 */
export function WorkflowGraph({
  model,
  selectedId,
  onSelect,
}: {
  model: GraphModel;
  selectedId: string | null;
  onSelect: (requirementId: string | null) => void;
}) {
  const nodes = useMemo<RequirementNodeType[]>(() => {
    const positions = layout(model.nodes, model.edges, "TB");
    return model.nodes.map((requirement) => {
      const position = positions.get(requirement.requirement_id);
      return {
        id: requirement.requirement_id,
        type: "requirement" as const,
        position: { x: position?.x ?? 0, y: position?.y ?? 0 },
        data: {
          requirement,
          isSelected: selectedId === requirement.requirement_id,
        },
        draggable: false,
        connectable: false,
      };
    });
  }, [model, selectedId]);

  const edges = useMemo<Edge[]>(() => {
    const critical = new Set(model.critical_path);
    return model.edges.map((edge) => {
      const onCriticalPath = critical.has(edge.from) && critical.has(edge.to);
      return {
        id: `${edge.from}->${edge.to}`,
        source: edge.from,
        target: edge.to,
        className: onCriticalPath ? "edge-critical" : undefined,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: onCriticalPath ? "#a97f26" : "#b3a68a",
        },
      };
    });
  }, [model]);

  return (
    // Absolutely positioned so the canvas always has a definite size:
    // React Flow measures its parent, and a percentage height against a flex
    // item silently collapses to zero.
    <div className="workflow-canvas absolute inset-0">
      <ReactFlow<RequirementNodeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d6c7a8" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
