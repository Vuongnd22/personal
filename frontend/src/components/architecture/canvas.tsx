"use client";

import "@xyflow/react/dist/style.css";
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background, BackgroundVariant, ConnectionMode, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider,
  applyEdgeChanges, applyNodeChanges, useReactFlow, useViewport,
  type Connection, type EdgeChange, type NodeChange, type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle, Box, Cable, Hand, Maximize, MousePointer2, Plus, Redo2, Save, Search, StickyNote, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import { api, useArchitecture, useFeatures, useMe, useProducts } from "@/lib/queries";
import { canManage, PRODUCT_STATUS_META } from "@/lib/format";
import {
  archConnectionToFlowEdge, CENTER_PRODUCT_SIZE, DEFAULT_MODULE_SIZE, DEFAULT_NOTE_SIZE, DEFAULT_PRODUCT_SIZE, diagramToFlow,
  flowEdgeToArchInput, flowToSavePayload, type DiagramEdge, type DiagramNode, type DiagramNodeData,
} from "@/lib/architecture/diagram-mapping";
import { canRedo, canUndo, createHistoryState, historyReducer } from "@/lib/architecture/history-reducer";
import type { ArchitectureDiagram, EdgeDirection, ProductSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { ErrorState, Skeleton } from "@/components/ui/display";
import { Dialog, DialogContent, DialogFooter, DialogHeader, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlay";
import { ProductIcon, PRODUCT_COLORS } from "@/components/product-icon";
import { ProductFormDialog } from "@/components/products/product-form-dialog";

// ---- Nodes -----------------------------------------------------------------------------------
const HANDLE = "!size-2 !rounded-full !border !border-white !bg-zinc-400 opacity-0 transition-opacity group-hover:opacity-100";
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className={HANDLE} />
      <Handle type="source" position={Position.Right} id="right" className={HANDLE} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE} />
      <Handle type="source" position={Position.Left} id="left" className={HANDLE} />
    </>
  );
}

const ProductNode = memo(function ProductNode({ data, selected }: NodeProps<DiagramNode>) {
  const p = data.refProduct;
  const center = data.isCenter;
  return (
    <div
      className={cn(
        "group flex h-full w-full flex-col justify-between rounded-lg border bg-white p-3 shadow-sm",
        center ? "border-2" : "border",
        selected && "ring-2 ring-blue-500/40",
        !!data.highlight && "ring-2 ring-amber-400",
      )}
      style={{ borderColor: data.color ?? p?.color ?? "#d4d4d8" }}
      data-testid={`node-${data.label}`}
    >
      <Handles />
      <div className="flex items-start gap-2">
        {p && <ProductIcon icon={p.icon} color={p.color} size={center ? 36 : 26} />}
        <div className="min-w-0">
          <div className={cn("truncate font-semibold text-zinc-900", center ? "text-[15px]" : "text-[13px]")}>{data.label}</div>
          {p && <div className="text-[10px] font-medium" style={{ color: PRODUCT_STATUS_META[p.status].color }}>{PRODUCT_STATUS_META[p.status].label}</div>}
        </div>
      </div>
      {p && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>{p.taskCount} tasks{p.overdueCount ? <span className="ml-1 text-red-600">· {p.overdueCount} overdue</span> : null}</span>
            <span className="font-semibold text-zinc-800" data-testid="node-progress">{p.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
          </div>
        </div>
      )}
    </div>
  );
});

const ModuleNode = memo(function ModuleNode({ data, selected }: NodeProps<DiagramNode>) {
  return (
    <div
      className={cn("group flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-zinc-800 bg-white px-2 shadow-sm", selected && "ring-2 ring-blue-500/40", !!data.highlight && "ring-2 ring-amber-400")}
      style={data.color ? { borderColor: data.color, backgroundColor: `${data.color}0d` } : undefined}
      data-testid={`node-${data.label}`}
    >
      <Handles />
      <span className="text-center text-[13px] font-medium text-zinc-900">{data.label || "Module"}</span>
      {data.feature && (
        <span className="flex w-full items-center gap-1 text-[10px] text-zinc-500">
          <span className="truncate">{data.feature.name}</span>
          <span className="ml-auto font-semibold text-zinc-700">{data.feature.progress}%</span>
        </span>
      )}
    </div>
  );
});

const NoteNode = memo(function NoteNode({ data, selected }: NodeProps<DiagramNode>) {
  return (
    <div
      className={cn("group h-full w-full overflow-hidden rounded-sm border border-zinc-800 bg-white px-2 py-1.5 text-[11px] leading-snug text-zinc-800 shadow-[2px_2px_0_rgba(0,0,0,0.15)]", selected && "ring-2 ring-blue-500/40", !!data.highlight && "ring-2 ring-amber-400")}
      style={data.color ? { backgroundColor: `${data.color}14`, borderColor: data.color } : undefined}
      data-testid="node-note"
    >
      <Handles />
      <p className="whitespace-pre-wrap text-center">{data.label || "Note"}</p>
    </div>
  );
});

const nodeTypes = { product: ProductNode, module: ModuleNode, note: NoteNode };

// ---- Helpers ---------------------------------------------------------------------------------
const EDGE_STYLE = { stroke: "#3f3f46", strokeWidth: 1.25 };
const styleEdge = (e: DiagramEdge): DiagramEdge => ({
  ...e,
  style: EDGE_STYLE,
  labelStyle: { fontSize: 11, fill: "#18181b" },
  labelBgStyle: { fill: "#ffffff" },
  labelBgPadding: [4, 2],
  markerStart: e.markerStart ? { type: MarkerType.ArrowClosed, color: "#3f3f46" } : undefined,
  markerEnd: e.markerEnd ? { type: MarkerType.ArrowClosed, color: "#3f3f46" } : undefined,
});
const withDirection = (e: DiagramEdge, direction: EdgeDirection) =>
  styleEdge({ ...archConnectionToFlowEdge({ ...flowEdgeToArchInput(e), direction }), selected: e.selected });
/** Canonical saved form of the canvas, used for dirty detection. */
const payloadKey = (nodes: DiagramNode[], edges: DiagramEdge[]) => JSON.stringify(flowToSavePayload(nodes, edges, null));
const toFlow = (d: ArchitectureDiagram) => {
  const f = diagramToFlow(d);
  return { nodes: f.nodes, edges: f.edges.map(styleEdge) };
};

type Tool = "select" | "hand" | "connect";
type Menu = { x: number; y: number; kind: "node" | "edge"; id: string };
type Prompt = { title: string; value: string; multiline?: boolean; onSubmit: (v: string) => void };

// ---- Editor ----------------------------------------------------------------------------------
function Editor({ productId, diagram, readOnly, onReload }: { productId: string; diagram: ArchitectureDiagram; readOnly: boolean; onReload: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const rf = useReactFlow<DiagramNode, DiagramEdge>();
  const { zoom } = useViewport();
  const [initial] = useState(() => toFlow(diagram));
  const [nodes, setNodes] = useState<DiagramNode[]>(initial.nodes);
  const [edges, setEdges] = useState<DiagramEdge[]>(initial.edges);
  const [history, dispatch] = useReducer(historyReducer, initial, createHistoryState);
  // A never-saved diagram (default center node) counts as dirty until the first save.
  const [savedKey, setSavedKey] = useState(() => (diagram.updatedAt ? payloadKey(initial.nodes, initial.edges) : ""));
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(diagram.updatedAt);
  const [tool, setTool] = useState<Tool>("select");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [linkFeatureFor, setLinkFeatureFor] = useState<string | null>(null);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const products = useProducts({ sort: "name", order: "asc" });
  const features = useFeatures(productId);

  const dirty = !readOnly && payloadKey(nodes, edges) !== savedKey;

  /** Structural change: update the canvas and record an undo step. */
  const commit = useCallback((n: DiagramNode[], e: DiagramEdge[]) => {
    setNodes(n);
    setEdges(e);
    dispatch({ type: "PUSH", snapshot: { nodes: n, edges: e } });
  }, []);

  const undo = () => {
    if (!canUndo(history)) return;
    const prev = history.past[history.past.length - 1];
    dispatch({ type: "UNDO" });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  };
  const redo = () => {
    if (!canRedo(history)) return;
    const next = history.future[0];
    dispatch({ type: "REDO" });
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  const viewportCenter = () => {
    const box = wrapper.current?.getBoundingClientRect();
    const p = rf.screenToFlowPosition({ x: (box?.left ?? 0) + (box?.width ?? 800) / 2, y: (box?.top ?? 0) + (box?.height ?? 600) / 2 });
    const jitter = (nodes.length % 5) * 20;
    return { x: Math.round(p.x / 10) * 10 - 80 + jitter, y: Math.round(p.y / 10) * 10 - 40 + jitter };
  };
  const baseData = (o: Partial<DiagramNodeData>): DiagramNodeData => ({ kind: "MODULE", label: "", refProductId: null, featureId: null, refProduct: null, feature: null, isCenter: false, color: null, ...o });

  const addProductNode = (p: ProductSummary) =>
    commit([...nodes, {
      id: crypto.randomUUID(), type: "product", position: viewportCenter(), ...DEFAULT_PRODUCT_SIZE,
      data: baseData({ kind: "PRODUCT", label: p.name, refProductId: p.id, refProduct: { id: p.id, name: p.name, icon: p.icon, color: p.color, status: p.status, progress: p.progress, taskCount: p.taskCount, overdueCount: p.overdueCount } }),
    }], edges);
  const addModule = () => commit([...nodes, { id: crypto.randomUUID(), type: "module", position: viewportCenter(), ...DEFAULT_MODULE_SIZE, data: baseData({ kind: "MODULE", label: "New module" }) }], edges);
  const addNote = () => commit([...nodes, { id: crypto.randomUUID(), type: "note", position: viewportCenter(), ...DEFAULT_NOTE_SIZE, data: baseData({ kind: "NOTE", label: "Note" }) }], edges);

  const connect = (source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null) => {
    if (source === target) return;
    const edge = styleEdge(archConnectionToFlowEdge({ id: crypto.randomUUID(), sourceNodeId: source, targetNodeId: target, sourceHandle: sourceHandle ?? null, targetHandle: targetHandle ?? null, label: "", direction: "FORWARD" }));
    commit(nodes, [...edges, edge]);
  };

  const updateNode = (id: string, patch: Partial<DiagramNodeData>) => commit(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)), edges);
  const deleteNode = (id: string) => commit(nodes.filter((n) => n.id !== id), edges.filter((e) => e.source !== id && e.target !== id));
  const setCenterNode = (id: string) =>
    commit(
      nodes.map((n) => {
        if (n.data.kind !== "PRODUCT") return n;
        const isCenter = n.id === id;
        return { ...n, ...(isCenter ? CENTER_PRODUCT_SIZE : n.data.isCenter ? DEFAULT_PRODUCT_SIZE : {}), data: { ...n.data, isCenter } };
      }),
      edges,
    );

  const onNodesChange = (changes: NodeChange<DiagramNode>[]) => {
    if (readOnly) return setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type === "select" || c.type === "dimensions"), ns));
    const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
    if (removed.size) return commit(applyNodeChanges(changes, nodes), edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)));
    setNodes((ns) => applyNodeChanges(changes, ns));
  };
  const onEdgesChange = (changes: EdgeChange<DiagramEdge>[]) => {
    if (!readOnly && changes.some((c) => c.type === "remove")) return commit(nodes, applyEdgeChanges(changes, edges));
    setEdges((es) => applyEdgeChanges(changes.filter((c) => c.type === "select"), es));
  };
  const onDragStop = () => dispatch({ type: "PUSH", snapshot: { nodes: rf.getNodes(), edges } });

  const navigate = (url: string) => (dirty ? setPendingNav(url) : router.push(url));
  const open = (node: DiagramNode) => {
    if (node.data.kind === "PRODUCT" && node.data.refProductId) navigate(`/products/${node.data.refProductId}`);
    else if (node.data.kind === "MODULE" && node.data.featureId) navigate(`/products/${productId}?tab=tasks&feature=${node.data.featureId}`);
  };
  const onNodeClick = (_: React.MouseEvent, node: DiagramNode) => {
    setMenu(null);
    if (tool === "connect" && !readOnly) {
      if (!connectFrom) return setConnectFrom(node.id);
      connect(connectFrom, node.id);
      return setConnectFrom(null);
    }
    open(node);
  };

  const rename = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    if (n.data.kind === "PRODUCT") {
      setPrompt({
        title: "Rename product",
        value: n.data.label,
        onSubmit: async (name) => {
          if (!name) return;
          try {
            await api.patch(`/products/${n.data.refProductId}`, { name });
            setNodes((ns) => ns.map((x) => (x.data.refProductId === n.data.refProductId ? { ...x, data: { ...x.data, label: name, refProduct: x.data.refProduct && { ...x.data.refProduct, name } } } : x)));
            qc.invalidateQueries({ predicate: (q) => !["architecture", "me", "users"].includes(q.queryKey[0] as string) });
            toast.success("Product renamed");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Rename failed");
          }
        },
      });
    } else {
      setPrompt({ title: n.data.kind === "NOTE" ? "Edit note" : "Rename module", value: n.data.label, multiline: n.data.kind === "NOTE", onSubmit: (label) => updateNode(id, { label }) });
    }
  };
  const editEdgeLabel = (id: string) => {
    const e = edges.find((x) => x.id === id);
    if (!e) return;
    setPrompt({ title: "Connection label", value: typeof e.label === "string" ? e.label : "", onSubmit: (label) => commit(nodes, edges.map((x) => (x.id === id ? { ...x, label: label || undefined } : x))) });
  };

  const persist = async (base: string | null) => {
    const saved = await api.put<ArchitectureDiagram>(`/products/${productId}/architecture`, flowToSavePayload(nodes, edges, base));
    setBaseUpdatedAt(saved.updatedAt);
    setSavedKey(payloadKey(nodes, edges));
    qc.setQueryData(["architecture", productId], saved);
    qc.invalidateQueries({ predicate: (q) => !["me", "users", "architecture"].includes(q.queryKey[0] as string) });
  };
  const save = async () => {
    setSaving(true);
    try {
      await persist(baseUpdatedAt);
      toast.success("Diagram saved");
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 409) setConflict(true);
      else toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const overwrite = async () => {
    setConflict(false);
    setSaving(true);
    try {
      const latest = await apiRequest<ArchitectureDiagram>(`/products/${productId}/architecture`);
      await persist(latest.updatedAt);
      toast.success("Diagram saved over the other version");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Search: highlight matches; Enter cycles through them and centres the view.
  const matches = useMemo(() => (query.trim() ? nodes.filter((n) => n.data.label.toLowerCase().includes(query.trim().toLowerCase())) : []), [nodes, query]);
  const focusMatch = (i: number) => {
    const n = matches[i % matches.length];
    if (!n) return;
    rf.setCenter(n.position.x + (n.width ?? 160) / 2, n.position.y + (n.height ?? 60) / 2, { zoom: Math.max(zoom, 1), duration: 200 });
    setMatchIndex(i + 1);
  };
  const displayNodes = useMemo(() => {
    const ids = new Set(matches.map((m) => m.id));
    if (connectFrom) ids.add(connectFrom);
    return ids.size ? nodes.map((n) => (ids.has(n.id) ? { ...n, data: { ...n.data, highlight: true } } : n)) : nodes;
  }, [nodes, matches, connectFrom]);

  // Keyboard shortcuts (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=dialog]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.shiftKey && e.code === "Digit1") { e.preventDefault(); rf.fitView({ duration: 200, padding: 0.15 }); return; }
      if (readOnly) return;
      if (mod && k === "s") { e.preventDefault(); void save(); return; }
      if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (k === "y" || (e.shiftKey && k === "z"))) { e.preventDefault(); redo(); return; }
      if (mod || e.altKey) return;
      if (k === "v") setTool("select");
      else if (k === "h") setTool("hand");
      else if (k === "c") { setTool("connect"); setConnectFrom(null); }
      else if (k === "escape") { setConnectFrom(null); setMenu(null); setTool("select"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const inDiagram = new Set(nodes.map((n) => n.data.refProductId).filter(Boolean));
  const menuNode = menu?.kind === "node" ? nodes.find((n) => n.id === menu.id) : undefined;
  const menuEdge = menu?.kind === "edge" ? edges.find((e) => e.id === menu.id) : undefined;
  const openMenu = (e: React.MouseEvent, kind: Menu["kind"], id: string) => {
    if (readOnly) return;
    e.preventDefault();
    const b = wrapper.current!.getBoundingClientRect();
    setMenu({ kind, id, x: e.clientX - b.left, y: e.clientY - b.top });
  };

  return (
    <div className="flex h-full flex-col" data-testid="architecture-canvas">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white px-2 py-1.5" data-testid="canvas-toolbar">
        <ToolButton label="Select" shortcut="V" active={tool === "select"} onClick={() => setTool("select")} testId="tool-select"><MousePointer2 /></ToolButton>
        <ToolButton label="Hand / pan" shortcut="H, or hold Space" active={tool === "hand"} onClick={() => setTool("hand")} testId="tool-hand"><Hand /></ToolButton>
        {!readOnly && (
          <>
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="sm" data-testid="tool-add-product"><Plus /> Product</Button></PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1">
                <div className="max-h-72 overflow-y-auto">
                  {products.data?.filter((p) => !inDiagram.has(p.id)).map((p) => (
                    <button key={p.id} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-zinc-100" onClick={() => addProductNode(p)} data-testid="add-product-option">
                      <ProductIcon icon={p.icon} color={p.color} size={20} /> <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                  {products.data?.every((p) => inDiagram.has(p.id)) && <p className="px-2 py-2 text-xs text-zinc-500">Every product is already on this diagram.</p>}
                </div>
                <div className="border-t border-zinc-100 p-1">
                  <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-blue-600 hover:bg-zinc-100" onClick={() => setNewProductOpen(true)}><Plus className="size-4" /> Create new product…</button>
                </div>
              </PopoverContent>
            </Popover>
            <ToolButton label="Add module" onClick={addModule} testId="tool-add-module"><Box /></ToolButton>
            <ToolButton label="Add note" onClick={addNote} testId="tool-add-note"><StickyNote /></ToolButton>
            <ToolButton label="Add connection: click source, then target (or drag between handles)" shortcut="C" active={tool === "connect"} onClick={() => { setTool(tool === "connect" ? "select" : "connect"); setConnectFrom(null); }} testId="tool-connect"><Cable /></ToolButton>
          </>
        )}
        <span className="mx-1 h-5 w-px bg-zinc-200" />
        <ToolButton label="Zoom out" onClick={() => rf.zoomOut({ duration: 150 })} testId="tool-zoom-out"><ZoomOut /></ToolButton>
        <button className="w-12 text-center text-xs tabular-nums text-zinc-600 hover:text-zinc-900" onClick={() => rf.zoomTo(1, { duration: 150 })} title="Reset to 100%" data-testid="zoom-level">{Math.round(zoom * 100)}%</button>
        <ToolButton label="Zoom in" onClick={() => rf.zoomIn({ duration: 150 })} testId="tool-zoom-in"><ZoomIn /></ToolButton>
        <ToolButton label="Fit to screen" shortcut="Shift+1" onClick={() => rf.fitView({ duration: 200, padding: 0.15 })} testId="tool-fit"><Maximize /></ToolButton>
        {!readOnly && (
          <>
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <ToolButton label="Undo" shortcut="Ctrl+Z" onClick={undo} disabled={!canUndo(history)} testId="tool-undo"><Undo2 /></ToolButton>
            <ToolButton label="Redo" shortcut="Ctrl+Shift+Z" onClick={redo} disabled={!canRedo(history)} testId="tool-redo"><Redo2 /></ToolButton>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setMatchIndex(0); }}
              onKeyDown={(e) => { if (e.key === "Enter") focusMatch(matchIndex); if (e.key === "Escape") setQuery(""); }}
              placeholder="Find node…"
              className="h-7 w-44 pl-7"
              data-testid="node-search"
              aria-label="Find node"
            />
            {query && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">{matches.length}</span>}
          </div>
          {!readOnly && (
            <>
              {dirty
                ? <span className="text-xs font-medium text-amber-600" data-testid="dirty-indicator">Unsaved changes</span>
                : <span className="text-xs text-zinc-400" data-testid="saved-indicator">All changes saved</span>}
              <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving || !dirty} data-testid="tool-save"><Save /> {saving ? "Saving…" : "Save"}</Button>
            </>
          )}
        </div>
      </div>
      {tool === "connect" && !readOnly && (
        <div className="border-b border-blue-100 bg-blue-50 px-3 py-1 text-xs text-blue-700">{connectFrom ? "Now click the target node (Esc to cancel)." : "Click the source node."}</div>
      )}

      <div ref={wrapper} className="relative min-h-0 flex-1" onClick={() => setMenu(null)}>
        <ReactFlow<DiagramNode, DiagramEdge>
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(c: Connection) => !readOnly && connect(c.source, c.target, c.sourceHandle, c.targetHandle)}
          onNodeDragStop={onDragStop}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={(_, n) => !readOnly && n.data.kind !== "PRODUCT" && rename(n.id)}
          onEdgeDoubleClick={(_, e) => !readOnly && editEdgeLabel(e.id)}
          onNodeContextMenu={(e, n) => openMenu(e, "node", n.id)}
          onEdgeContextMenu={(e, ed) => openMenu(e, "edge", ed.id)}
          onPaneClick={() => { setMenu(null); setConnectFrom(null); }}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={!readOnly && tool !== "connect"}
          nodesConnectable={!readOnly}
          elementsSelectable
          selectionOnDrag={tool === "select" && !readOnly}
          panOnDrag={tool === "hand" || readOnly ? true : [1, 2]}
          panActivationKeyCode="Space"
          deleteKeyCode={readOnly ? null : ["Delete", "Backspace"]}
          multiSelectionKeyCode="Shift"
          snapToGrid
          snapGrid={[10, 10]}
          minZoom={0.1}
          maxZoom={2}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          className={cn(tool === "hand" && "cursor-grab")}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d8" />
          <MiniMap pannable zoomable className="!rounded-md !border !border-zinc-200" maskColor="rgba(244,244,245,0.6)" nodeColor={(n) => (n.data as DiagramNodeData).refProduct?.color ?? "#a1a1aa"} />
        </ReactFlow>

        {menu && (menuNode || menuEdge) && (
          <div className="absolute z-20 min-w-48 rounded-md border border-zinc-200 bg-white p-1 text-[13px] shadow-lg" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} data-testid="canvas-context-menu">
            {menuNode && (
              <>
                {(menuNode.data.refProductId || menuNode.data.featureId) && <MenuItem onClick={() => { setMenu(null); open(menuNode); }}>Open</MenuItem>}
                <MenuItem onClick={() => { setMenu(null); rename(menuNode.id); }}>{menuNode.data.kind === "PRODUCT" ? "Rename product…" : "Rename…"}</MenuItem>
                {menuNode.data.kind === "PRODUCT" && !menuNode.data.isCenter && <MenuItem onClick={() => { setMenu(null); setCenterNode(menuNode.id); }}>Set as center</MenuItem>}
                {menuNode.data.kind === "MODULE" && <MenuItem onClick={() => { setMenu(null); setLinkFeatureFor(menuNode.id); }}>{menuNode.data.featureId ? "Change linked feature…" : "Link to feature…"}</MenuItem>}
                <div className="flex gap-1 px-2 py-1.5">
                  {[null, ...PRODUCT_COLORS.slice(0, 7)].map((c) => (
                    <button key={c ?? "none"} aria-label={c ? `Colour ${c}` : "Default colour"} className={cn("size-4 rounded-full border border-zinc-300", menuNode.data.color === c && "ring-2 ring-zinc-900 ring-offset-1")} style={{ backgroundColor: c ?? "#fff" }} onClick={() => { setMenu(null); updateNode(menuNode.id, { color: c }); }} />
                  ))}
                </div>
                <div className="my-1 h-px bg-zinc-100" />
                <MenuItem destructive onClick={() => { setMenu(null); deleteNode(menuNode.id); }}>Delete node</MenuItem>
              </>
            )}
            {menuEdge && (
              <>
                <MenuItem onClick={() => { setMenu(null); editEdgeLabel(menuEdge.id); }}>Edit label…</MenuItem>
                <div className="px-2 pb-0.5 pt-1.5 text-[11px] text-zinc-500">Arrow direction</div>
                {(["FORWARD", "BACKWARD", "BOTH", "NONE"] as EdgeDirection[]).map((d) => (
                  <MenuItem key={d} onClick={() => { setMenu(null); commit(nodes, edges.map((e) => (e.id === menuEdge.id ? withDirection(e, d) : e))); }}>
                    {menuEdge.data?.direction === d ? "✓ " : ""}{{ FORWARD: "Source → target", BACKWARD: "Target → source", BOTH: "Both ways ↔", NONE: "No arrows" }[d]}
                  </MenuItem>
                ))}
                <div className="my-1 h-px bg-zinc-100" />
                <MenuItem destructive onClick={() => { setMenu(null); commit(nodes, edges.filter((e) => e.id !== menuEdge.id)); }}>Delete connection</MenuItem>
              </>
            )}
          </div>
        )}
        {!readOnly && nodes.length <= 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="rounded-md border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs text-zinc-500">Add products, modules and notes from the toolbar, then drag between node handles to connect them.</span>
          </div>
        )}
      </div>

      <PromptDialog prompt={prompt} onClose={() => setPrompt(null)} />
      <Dialog open={!!linkFeatureFor} onOpenChange={(o) => !o && setLinkFeatureFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader title="Link module to a feature" description="The module shows that feature's progress and opens its task list when clicked." />
          <Select
            defaultValue={nodes.find((n) => n.id === linkFeatureFor)?.data.featureId ?? ""}
            onChange={(e) => {
              const f = features.data?.find((x) => x.id === e.target.value);
              if (linkFeatureFor) updateNode(linkFeatureFor, { featureId: f?.id ?? null, feature: f ? { id: f.id, name: f.name, progress: f.progress } : null });
              setLinkFeatureFor(null);
            }}
            data-testid="link-feature-select"
            aria-label="Feature"
          >
            <option value="">No feature</option>
            {features.data?.map((f) => <option key={f.id} value={f.id}>{f.category} · {f.name}</option>)}
          </Select>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pendingNav} onOpenChange={(o) => !o && setPendingNav(null)}>
        <DialogContent className="max-w-sm" data-testid="unsaved-dialog">
          <DialogHeader title="Unsaved diagram changes" description="Save the diagram before leaving?" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingNav(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => { const url = pendingNav!; setSavedKey(payloadKey(nodes, edges)); setPendingNav(null); router.push(url); }} data-testid="discard-and-leave">Discard</Button>
            <Button variant="primary" onClick={async () => { const url = pendingNav!; if (await save()) { setPendingNav(null); router.push(url); } }} data-testid="save-and-leave">Save & leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={conflict} onOpenChange={setConflict}>
        <DialogContent className="max-w-md" data-testid="conflict-dialog">
          <DialogHeader title="Someone else saved this diagram" description="Your copy is out of date. Reload to see their version (your unsaved changes are discarded), or overwrite it with yours." />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConflict(false); setSavedKey(payloadKey(nodes, edges)); onReload(); }}>Reload latest</Button>
            <Button variant="destructive" onClick={() => void overwrite()}>Overwrite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProductFormDialog open={newProductOpen} onOpenChange={setNewProductOpen} onSaved={addProductNode} />
    </div>
  );
}

function ToolButton({ active, label, shortcut, onClick, children, testId, disabled }: {
  active?: boolean; label: string; shortcut?: string; onClick: () => void; children: React.ReactNode; testId: string; disabled?: boolean;
}) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>
      <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active} data-testid={testId} className={cn(active && "bg-zinc-900 text-white hover:bg-zinc-800")}>
        {children}
      </Button>
    </Tooltip>
  );
}

function MenuItem({ children, onClick, destructive }: { children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return <button className={cn("flex w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100", destructive && "text-red-600")} onClick={onClick}>{children}</button>;
}

function PromptDialog({ prompt, onClose }: { prompt: Prompt | null; onClose: () => void }) {
  // Only mounted while a prompt is active, so its draft state is always fresh — no effect needed.
  return prompt ? <PromptDialogContent prompt={prompt} onClose={onClose} /> : null;
}

function PromptDialogContent({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [value, setValue] = useState(prompt.value);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="prompt-dialog">
        <DialogHeader title={prompt.title} />
        <form id="prompt-form" onSubmit={(e) => { e.preventDefault(); prompt.onSubmit(value.trim()); onClose(); }}>
          {prompt.multiline
            ? <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="min-h-24 w-full rounded-md border border-zinc-200 p-2 text-[13px] outline-none focus:border-blue-500" data-testid="prompt-input" />
            : <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} data-testid="prompt-input" />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="prompt-form" data-testid="prompt-submit">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchitectureCanvas({ productId, readOnly: forceReadOnly = false }: { productId: string; readOnly?: boolean }) {
  const diagram = useArchitecture(productId);
  const me = useMe().data;
  const [version, setVersion] = useState(0);
  const readOnly = forceReadOnly || !canManage(me);
  if (diagram.isLoading) return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-48" /></div>;
  if (diagram.error || !diagram.data) return <div className="p-6"><ErrorState error={diagram.error} onRetry={diagram.refetch} /></div>;
  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        {readOnly && !forceReadOnly && (
          <div className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50 px-3 py-1 text-xs text-amber-700"><AlertTriangle className="size-3.5" /> Read-only: only managers can edit diagrams.</div>
        )}
        <div className="min-h-0 flex-1">
          <Editor
            key={`${version}-${readOnly}`}
            productId={productId}
            diagram={diagram.data}
            readOnly={readOnly}
            onReload={() => void diagram.refetch().then(() => setVersion((v) => v + 1))}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
