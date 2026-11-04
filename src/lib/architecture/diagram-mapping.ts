import type { Node, Edge, MarkerType } from "@xyflow/react";
import type {
  ArchitectureDiagram,
  ArchNode,
  ArchConnection,
  ArchNodeInput,
  ArchConnectionInput,
  EdgeDirection,
  NodeKind,
} from "@/lib/types";

export const DEFAULT_PRODUCT_SIZE = { width: 180, height: 90 };
export const CENTER_PRODUCT_SIZE = { width: 288, height: 144 };
export const DEFAULT_MODULE_SIZE = { width: 160, height: 60 };
export const DEFAULT_NOTE_SIZE = { width: 200, height: 100 };

export interface DiagramNodeData {
  kind: NodeKind;
  label: string;
  refProductId: string | null;
  featureId: string | null;
  refProduct: ArchNode["refProduct"];
  feature: ArchNode["feature"];
  isCenter: boolean;
  color: string | null;
  [key: string]: unknown;
}

export type DiagramNode = Node<DiagramNodeData>;

export interface DiagramEdgeData {
  direction: EdgeDirection;
  [key: string]: unknown;
}

export type DiagramEdge = Edge<DiagramEdgeData>;

function defaultSizeFor(node: ArchNode): { width: number; height: number } {
  if (node.kind === "PRODUCT") {
    return node.isCenter ? CENTER_PRODUCT_SIZE : DEFAULT_PRODUCT_SIZE;
  }
  if (node.kind === "MODULE") return DEFAULT_MODULE_SIZE;
  return DEFAULT_NOTE_SIZE;
}

export function archNodeToFlowNode(node: ArchNode): DiagramNode {
  const size = defaultSizeFor(node);
  return {
    id: node.id,
    type: node.kind.toLowerCase(),
    position: { x: node.position.x, y: node.position.y },
    width: node.width ?? size.width,
    height: node.height ?? size.height,
    data: {
      kind: node.kind,
      label: node.label,
      refProductId: node.refProductId,
      featureId: node.featureId,
      refProduct: node.refProduct,
      feature: node.feature,
      isCenter: node.isCenter,
      color: node.color,
    },
  };
}

function markerForDirection(direction: EdgeDirection): {
  markerStart?: { type: MarkerType };
  markerEnd?: { type: MarkerType };
} {
  const arrow = { type: "arrowclosed" as MarkerType };
  switch (direction) {
    case "FORWARD":
      return { markerEnd: arrow };
    case "BACKWARD":
      return { markerStart: arrow };
    case "BOTH":
      return { markerStart: arrow, markerEnd: arrow };
    case "NONE":
    default:
      return {};
  }
}

export function archConnectionToFlowEdge(connection: ArchConnection): DiagramEdge {
  const markers = markerForDirection(connection.direction);
  return {
    id: connection.id,
    source: connection.sourceNodeId,
    target: connection.targetNodeId,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
    label: connection.label || undefined,
    type: "smoothstep",
    data: { direction: connection.direction },
    ...markers,
  };
}

export function diagramToFlow(diagram: ArchitectureDiagram): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  return {
    nodes: diagram.nodes.map(archNodeToFlowNode),
    edges: diagram.connections.map(archConnectionToFlowEdge),
  };
}

export function flowNodeToArchInput(node: DiagramNode): ArchNodeInput {
  return {
    id: node.id,
    kind: node.data.kind,
    label: node.data.kind === "PRODUCT" ? "" : node.data.label,
    refProductId: node.data.refProductId,
    featureId: node.data.featureId,
    position: { x: node.position.x, y: node.position.y },
    width: node.width ?? null,
    height: node.height ?? null,
    isCenter: node.data.isCenter,
    color: node.data.color,
  };
}

export function flowEdgeToArchInput(edge: DiagramEdge): ArchConnectionInput {
  return {
    id: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    label: typeof edge.label === "string" ? edge.label : "",
    direction: (edge.data?.direction as EdgeDirection) ?? "FORWARD",
  };
}

export function flowToSavePayload(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  baseUpdatedAt: string | null
): { baseUpdatedAt: string | null; nodes: ArchNodeInput[]; connections: ArchConnectionInput[] } {
  return {
    baseUpdatedAt,
    nodes: nodes.map(flowNodeToArchInput),
    connections: edges.map(flowEdgeToArchInput),
  };
}
