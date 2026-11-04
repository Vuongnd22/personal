import { describe, it, expect } from "vitest";
import {
  diagramToFlow,
  flowToSavePayload,
  archNodeToFlowNode,
  archConnectionToFlowEdge,
  CENTER_PRODUCT_SIZE,
  DEFAULT_PRODUCT_SIZE,
} from "../diagram-mapping";
import type { ArchitectureDiagram, ArchNode, ArchConnection } from "@/lib/types";

function makeProductNode(overrides: Partial<ArchNode> = {}): ArchNode {
  return {
    id: "n1",
    kind: "PRODUCT",
    label: "Phantom R3",
    refProductId: "p1",
    featureId: null,
    refProduct: {
      id: "p1",
      name: "Phantom R3",
      icon: "box",
      color: "#2563eb",
      status: "ACTIVE",
      progress: 42,
      taskCount: 10,
      overdueCount: 2,
    },
    feature: null,
    position: { x: 100, y: 200 },
    width: null,
    height: null,
    isCenter: false,
    color: null,
    ...overrides,
  };
}

describe("archNodeToFlowNode", () => {
  it("maps a PRODUCT node's position, kind and refProduct data", () => {
    const node = makeProductNode();
    const flowNode = archNodeToFlowNode(node);

    expect(flowNode.id).toBe("n1");
    expect(flowNode.type).toBe("product");
    expect(flowNode.position).toEqual({ x: 100, y: 200 });
    expect(flowNode.data.refProduct?.name).toBe("Phantom R3");
    expect(flowNode.data.isCenter).toBe(false);
  });

  it("sizes a center PRODUCT node larger than a regular one", () => {
    const regular = archNodeToFlowNode(makeProductNode({ isCenter: false }));
    const center = archNodeToFlowNode(makeProductNode({ isCenter: true, id: "n2" }));

    expect(regular.width).toBe(DEFAULT_PRODUCT_SIZE.width);
    expect(center.width).toBe(CENTER_PRODUCT_SIZE.width);
    expect(center.width).toBeGreaterThan(regular.width!);
  });

  it("uses explicit stored width/height when present over defaults", () => {
    const node = makeProductNode({ width: 300, height: 150 });
    const flowNode = archNodeToFlowNode(node);
    expect(flowNode.width).toBe(300);
    expect(flowNode.height).toBe(150);
  });

  it("carries the linked feature summary for a MODULE node", () => {
    const node: ArchNode = {
      id: "m1",
      kind: "MODULE",
      label: "Wi-Fi Communication",
      refProductId: null,
      featureId: "f1",
      refProduct: null,
      feature: { id: "f1", name: "Wi-Fi Communication", progress: 60 },
      position: { x: 0, y: 0 },
      width: null,
      height: null,
      isCenter: false,
      color: "#16a34a",
      ...{},
    };
    const flowNode = archNodeToFlowNode(node);
    expect(flowNode.type).toBe("module");
    expect(flowNode.data.feature?.progress).toBe(60);
    expect(flowNode.data.color).toBe("#16a34a");
  });
});

describe("archConnectionToFlowEdge direction -> markers", () => {
  function makeConn(direction: ArchConnection["direction"]): ArchConnection {
    return {
      id: "c1",
      sourceNodeId: "a",
      targetNodeId: "b",
      sourceHandle: null,
      targetHandle: null,
      label: "Wav",
      direction,
    };
  }

  it("FORWARD gets only a markerEnd arrow", () => {
    const edge = archConnectionToFlowEdge(makeConn("FORWARD"));
    expect(edge.markerEnd).toBeDefined();
    expect(edge.markerStart).toBeUndefined();
  });

  it("BACKWARD gets only a markerStart arrow", () => {
    const edge = archConnectionToFlowEdge(makeConn("BACKWARD"));
    expect(edge.markerStart).toBeDefined();
    expect(edge.markerEnd).toBeUndefined();
  });

  it("BOTH gets arrows on both ends", () => {
    const edge = archConnectionToFlowEdge(makeConn("BOTH"));
    expect(edge.markerStart).toBeDefined();
    expect(edge.markerEnd).toBeDefined();
  });

  it("NONE gets no arrows", () => {
    const edge = archConnectionToFlowEdge(makeConn("NONE"));
    expect(edge.markerStart).toBeUndefined();
    expect(edge.markerEnd).toBeUndefined();
  });

  it("uses smoothstep edge type and carries the label", () => {
    const edge = archConnectionToFlowEdge(makeConn("FORWARD"));
    expect(edge.type).toBe("smoothstep");
    expect(edge.label).toBe("Wav");
  });

  it("preserves direction in edge data for later editing", () => {
    const edge = archConnectionToFlowEdge(makeConn("BOTH"));
    expect(edge.data?.direction).toBe("BOTH");
  });
});

describe("diagramToFlow / flowToSavePayload round trip", () => {
  it("round-trips nodes and connections back to the PUT payload shape", () => {
    const diagram: ArchitectureDiagram = {
      productId: "p1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        makeProductNode({ isCenter: true }),
        {
          id: "note1",
          kind: "NOTE",
          label: "Giao thức truyền tải...",
          refProductId: null,
          featureId: null,
          refProduct: null,
          feature: null,
          position: { x: 400, y: 50 },
          width: 200,
          height: 100,
          isCenter: false,
          color: null,
        },
      ],
      connections: [
        {
          id: "c1",
          sourceNodeId: "n1",
          targetNodeId: "note1",
          sourceHandle: "right",
          targetHandle: "left",
          label: "",
          direction: "FORWARD",
        },
      ],
    };

    const { nodes, edges } = diagramToFlow(diagram);
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);

    const payload = flowToSavePayload(nodes, edges, diagram.updatedAt);

    expect(payload.baseUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(payload.nodes).toHaveLength(2);
    expect(payload.connections).toHaveLength(1);

    const productNode = payload.nodes.find((n) => n.kind === "PRODUCT")!;
    expect(productNode.label).toBe("");
    expect(productNode.refProductId).toBe("p1");
    expect(productNode.isCenter).toBe(true);

    const noteNode = payload.nodes.find((n) => n.kind === "NOTE")!;
    expect(noteNode.label).toBe("Giao thức truyền tải...");
    expect(noteNode.width).toBe(200);

    expect(payload.connections[0]).toMatchObject({
      id: "c1",
      sourceNodeId: "n1",
      targetNodeId: "note1",
      direction: "FORWARD",
    });
  });

  it("drops the refProduct/feature enrichment fields from the save payload", () => {
    const diagram: ArchitectureDiagram = {
      productId: "p1",
      updatedAt: null,
      nodes: [makeProductNode()],
      connections: [],
    };
    const { nodes, edges } = diagramToFlow(diagram);
    const payload = flowToSavePayload(nodes, edges, null);
    expect(payload.nodes[0]).not.toHaveProperty("refProduct");
    expect(payload.nodes[0]).not.toHaveProperty("feature");
  });
});
