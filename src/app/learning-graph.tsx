"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check, CircleHelp, Clock3, LockKeyhole, Play } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { DashboardCourse } from "@/lib/dashboard-data";

type ConceptNodeData = {
  title: string;
  status: "mastered" | "unlocked" | "locked";
  durationMinutes: number;
  matchesSearch: boolean;
};

type ConceptFlowNode = Node<ConceptNodeData, "concept">;

const nodeTypes = { concept: ConceptNode };

function ConceptNode({ data, selected }: NodeProps<ConceptFlowNode>) {
  const statusStyles = {
    mastered: "border-emerald-300/70 bg-[#245f64] text-emerald-50",
    unlocked: "border-violet-300/70 bg-[#5446a5] text-white",
    locked: "border-white/10 bg-[#38345f] text-[#c2bfd5]",
  }[data.status];

  return (
    <div
      className={`relative flex min-w-[178px] items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-[0_8px_24px_rgba(9,6,36,0.2)] transition-all ${
        selected ? "ring-2 ring-[#c6baff] ring-offset-2 ring-offset-[#211b4e]" : ""
      } ${data.matchesSearch ? "opacity-100" : "opacity-35"} ${statusStyles}`}
    >
      <Handle
        className="!h-2 !w-2 !border-0 !bg-[#a69ae6] !opacity-0"
        position={Position.Left}
        type="target"
      />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/15">
        {data.status === "mastered" ? (
          <Check size={14} strokeWidth={2.6} />
        ) : data.status === "unlocked" ? (
          <Play size={12} fill="currentColor" />
        ) : (
          <LockKeyhole size={13} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-bold">{data.title}</span>
        <span className="mt-0.5 block text-[9px] text-white/55">
          {data.durationMinutes} min · {data.status}
        </span>
      </span>
      <Handle
        className="!h-2 !w-2 !border-0 !bg-[#a69ae6] !opacity-0"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

function buildNodes(course: DashboardCourse): ConceptFlowNode[] {
  const remaining = new Set(course.concepts.map((concept) => concept.id));
  const levels = new Map<string, number>();
  let nextLevel = 0;

  while (remaining.size > 0) {
    const ready = [...remaining].filter((conceptId) =>
      course.edges
        .filter((edge) => edge.conceptId === conceptId)
        .every((edge) => levels.has(edge.prerequisiteId)),
    );

    if (ready.length === 0) {
      for (const conceptId of remaining) levels.set(conceptId, nextLevel);
      break;
    }

    for (const conceptId of ready) {
      const prerequisiteLevels = course.edges
        .filter((edge) => edge.conceptId === conceptId)
        .map((edge) => levels.get(edge.prerequisiteId) ?? -1);
      levels.set(
        conceptId,
        prerequisiteLevels.length ? Math.max(...prerequisiteLevels) + 1 : 0,
      );
      remaining.delete(conceptId);
    }
    nextLevel += 1;
  }

  const conceptsByLevel = new Map<number, DashboardCourse["concepts"]>();
  for (const concept of course.concepts) {
    const level = levels.get(concept.id) ?? 0;
    const concepts = conceptsByLevel.get(level) ?? [];
    concepts.push(concept);
    conceptsByLevel.set(level, concepts);
  }

  return course.concepts.map((concept) => {
    const level = levels.get(concept.id) ?? 0;
    const concepts = conceptsByLevel.get(level) ?? [];
    const index = concepts.findIndex((item) => item.id === concept.id);
    const verticalGap = 118;
    const verticalCenter = ((concepts.length - 1) * verticalGap) / 2;

    return {
      id: concept.id,
      type: "concept",
      position: {
        x: level * 235,
        y: index * verticalGap - verticalCenter + 260,
      },
      data: {
        title: concept.title,
        status: concept.status,
        durationMinutes: concept.durationMinutes,
        matchesSearch: true,
      },
    };
  });
}

function buildEdges(course: DashboardCourse): Edge[] {
  const concepts = new Map(course.concepts.map((concept) => [concept.id, concept]));

  return course.edges.map((edge) => {
    const source = concepts.get(edge.prerequisiteId);
    const target = concepts.get(edge.conceptId);
    const completed = source?.status === "mastered" && target?.status === "mastered";
    const color = completed ? "#50c9a1" : "#8e81dd";

    return {
      id: `${edge.prerequisiteId}-${edge.conceptId}`,
      source: edge.prerequisiteId,
      target: edge.conceptId,
      type: "smoothstep",
      animated: !completed,
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    };
  });
}

export function LearningGraph({
  course,
  selectedConceptId,
  searchQuery,
  onSelectConcept,
}: {
  course: DashboardCourse;
  selectedConceptId: string | null;
  searchQuery: string;
  onSelectConcept: (conceptId: string) => void;
}) {
  const initialNodes = useMemo(() => buildNodes(course), [course]);
  const initialEdges = useMemo(() => buildEdges(course), [course]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const matchingIds = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return new Set(
      course.concepts
        .filter(
          (concept) =>
            !query ||
            concept.title.toLocaleLowerCase().includes(query) ||
            concept.description.toLocaleLowerCase().includes(query),
        )
        .map((concept) => concept.id),
    );
  }, [course.concepts, searchQuery]);

  useEffect(() => {
    setNodes(
      initialNodes.map((node) => ({
        ...node,
        data: { ...node.data, matchesSearch: matchingIds.has(node.id) },
      })),
    );
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, matchingIds, setEdges, setNodes]);

  const selectedConcept = course.concepts.find(
    (concept) => concept.id === selectedConceptId,
  );

  return (
    <section
      className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#2b245f] shadow-[0_18px_48px_rgba(8,5,30,0.18)]"
      id="learning-graph"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/15 text-violet-200">
              <CircleHelp size={17} />
            </span>
            <h2 className="text-sm font-bold text-white">Learning graph</h2>
          </div>
          <p className="mt-1.5 pl-10 text-[11px] text-white/45">
            Click a concept to see mastery and prerequisite details.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-medium text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-emerald-300" /> Mastered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-violet-300" /> Unlocked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-slate-400" /> Locked
          </span>
        </div>
      </div>

      <div className="h-[440px] bg-[#241d55] sm:h-[500px]">
        {course.concepts.length ? (
          <ReactFlow
            fitView
            fitViewOptions={{ padding: 0.18, minZoom: 0.25, maxZoom: 0.9 }}
            maxZoom={1}
            minZoom={0.2}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => onSelectConcept(node.id)}
            onNodesChange={onNodesChange}
            proOptions={{ hideAttribution: true }}
            zoomOnScroll={false}
          >
            <Background color="#5e568f" gap={22} size={1} variant={BackgroundVariant.Dots} />
            <Controls
              className="!overflow-hidden !rounded-xl !border !border-white/10 !bg-[#39316d] !shadow-lg [&>button]:!border-white/10 [&>button]:!bg-[#39316d] [&>button]:!fill-white/70"
              showInteractive={false}
            />
            <MiniMap
              className="!rounded-xl !border !border-white/10 !bg-[#39316d]"
              nodeColor={(node) => {
                const status = (node.data as ConceptNodeData).status;
                return status === "mastered"
                  ? "#50c9a1"
                  : status === "unlocked"
                    ? "#9888f5"
                    : "#77728f";
              }}
              maskColor="rgba(22, 17, 61, 0.65)"
            />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">
            This course has no active concepts in its curriculum yet.
          </div>
        )}
      </div>

      {selectedConcept && (
        <div className="grid gap-4 border-t border-white/[0.08] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-white">{selectedConcept.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                selectedConcept.status === "mastered"
                  ? "bg-emerald-300/15 text-emerald-200"
                  : selectedConcept.status === "unlocked"
                    ? "bg-violet-300/15 text-violet-200"
                    : "bg-white/10 text-white/50"
              }`}>
                {selectedConcept.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-white/50">
              {selectedConcept.status === "locked" &&
              selectedConcept.missingPrerequisiteTitles.length
                ? `Locked until mastered: ${selectedConcept.missingPrerequisiteTitles.join(", ")}.`
                : selectedConcept.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[10px] text-white/50">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} /> {selectedConcept.durationMinutes} min
            </span>
            <span>{selectedConcept.lessons.length} lessons</span>
            <span>{selectedConcept.quizAttemptCount} attempts</span>
          </div>
        </div>
      )}
    </section>
  );
}
