"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { saveCanvasPositions } from "@/app/(admin)/admin/events/[eventId]/tournament/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Button } from "@/components/ui/button";
import { extractNodePositions, type CanvasEdge, type CanvasNode, type CanvasNodeData } from "@/lib/tournament/graph";
import type { ActionState } from "@/types/domain";

type MatchFlowNode = Node<CanvasNodeData, "matchNode">;
type ParticipantFlowNode = Node<CanvasNodeData, "participantNode">;
type RoundFlowNode = Node<CanvasNodeData, "roundNode">;
type FlowNode = MatchFlowNode | ParticipantFlowNode | RoundFlowNode;

const statusColour: Record<string, string> = {
  completed: "#C8F169",
  ongoing: "#F27A5C",
  result_submitted: "#F27A5C",
  ready: "#3564E9",
  scheduled: "#FFFFFF",
  postponed: "#F4F2E9",
  cancelled: "#C4462F",
  disputed: "#C4462F",
};

function MatchNode({ data, selected }: NodeProps<MatchFlowNode>) {
  const winner = typeof data.winnerEntryId === "string" ? data.winnerEntryId : null;
  return (
    <div
      className={`min-w-56 border-2 bg-white shadow-sm ${selected ? "ring-4 ring-cobalt/25" : ""}`}
      style={{ borderColor: statusColour[String(data.status ?? "scheduled")] ?? "#101D2C" }}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !bg-navy" />
      <div className="flex items-center justify-between border-b border-navy/10 bg-navy px-3 py-2 text-white">
        <span className="font-barlow text-sm font-bold uppercase tracking-[0.08em]">{String(data.label)}</span>
        <span className="text-[0.6rem] uppercase tracking-[0.12em] text-lime">{String(data.status ?? "scheduled").replaceAll("_", " ")}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-[0.7rem] font-semibold leading-snug text-navy">{String(data.sublabel ?? "Awaiting competitors")}</p>
        {data.isBye ? <p className="mt-1 text-[0.6rem] font-bold uppercase text-cobalt">Bye</p> : null}
        {winner ? <p className="mt-1 text-[0.6rem] font-bold uppercase text-coral-dark">Winner recorded</p> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !bg-navy" />
    </div>
  );
}

function ParticipantNode({ data }: NodeProps<ParticipantFlowNode>) {
  return (
    <div className="min-w-40 border border-cobalt/50 bg-white px-3 py-2 shadow-sm">
      <Handle type="source" position={Position.Right} className="!size-1.5 !bg-cobalt" />
      <p className="text-[0.7rem] font-bold text-navy">{String(data.label)}</p>
      <p className="text-[0.58rem] uppercase tracking-[0.08em] text-ink-muted">{String(data.sublabel ?? "")}</p>
    </div>
  );
}

function RoundNode({ data }: NodeProps<RoundFlowNode>) {
  return (
    <div className="border-b-2 border-lime bg-navy-deep px-4 py-2 text-chalk">
      <p className="font-barlow text-lg uppercase tracking-[0.08em]">{String(data.label)}</p>
      {data.sublabel ? <p className="text-[0.6rem] uppercase tracking-[0.1em] text-lime">{String(data.sublabel)}</p> : null}
    </div>
  );
}

const nodeTypes = {
  matchNode: MatchNode,
  participantNode: ParticipantNode,
  roundNode: RoundNode,
};

export function TournamentCanvas({
  eventId,
  sportId,
  drawId,
  locked,
  canEdit,
  nodes: initialNodes,
  edges: initialEdges,
}: {
  eventId: string;
  sportId: string;
  drawId: string;
  locked: boolean;
  canEdit: boolean;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialNodes as FlowNode[]);
  const [edgeList, , onEdgesChange] = useEdgesState<Edge>(initialEdges as Edge[]);
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  const save = useCallback(() => {
    setNotice(null);
    startTransition(async () => {
      const result = await saveCanvasPositions(
        drawId,
        eventId,
        sportId,
        extractNodePositions(nodes),
      );
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }, [drawId, eventId, sportId, nodes, router]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-navy/10 bg-white px-4 py-3">
        <div>
          <p className="eyebrow">Interactive draw canvas</p>
          <p className="mt-1 text-xs text-ink-muted">
            {locked
              ? "This draw is locked. Pairings and layout are read-only."
              : canEdit
                ? "Drag nodes to arrange the bracket, then save the layout. Pairings never change from this canvas."
                : "Read-only public view."}
          </p>
        </div>
        {canEdit && !locked ? (
          <Button type="button" variant="lime" size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save layout"}
          </Button>
        ) : null}
      </div>
      <Phase4ActionNotice state={notice} />
      <div className="h-[34rem] border-2 border-navy bg-chalk-dark">
        <ReactFlow
          nodes={nodes}
          edges={edgeList}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={canEdit && !locked}
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#101D2C33" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => statusColour[String(node.data?.status ?? "scheduled")] ?? "#101D2C"}
            maskColor="rgba(16,29,44,0.12)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
