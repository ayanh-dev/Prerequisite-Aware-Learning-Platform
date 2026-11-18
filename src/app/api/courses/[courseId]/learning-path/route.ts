import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getShortestLearningPath } from "@/lib/learning-graph";
import { getPrismaClient } from "@/lib/prisma";
import { loadLearnerCourseState } from "@/lib/progress";

type RouteContext = { params: Promise<{ courseId: string }> };
type LearnerState = NonNullable<Awaited<ReturnType<typeof loadLearnerCourseState>>>;

const learningPathSchema = z.object({
  targetConceptId: z.string().min(1).max(128),
}).strict();

function calculatePath(state: LearnerState, targetConceptId: string) {
  const target = state.concepts.find(({ id }) => id === targetConceptId);
  if (!target) return null;
  const path = getShortestLearningPath(
    target.id,
    state.concepts,
    state.edges,
    state.masteredConceptIds,
  );
  const conceptsById = new Map(state.concepts.map((concept) => [concept.id, concept]));
  return {
    targetConceptId: target.id,
    targetTitle: target.title,
    conceptIds: path.conceptIds,
    concepts: path.conceptIds.map((id) => conceptsById.get(id)),
    estimatedMinutes: path.estimatedMinutes,
    curriculumRevision: state.course.curriculumRevision,
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "LEARNER") return forbiddenResponse();
  const targetConceptId = new URL(request.url).searchParams.get("targetConceptId");
  if (!targetConceptId) {
    return NextResponse.json({ error: "targetConceptId is required." }, { status: 400 });
  }
  const { courseId } = await params;
  const state = await loadLearnerCourseState(getPrismaClient(), user.id, courseId);
  if (!state) return NextResponse.json({ error: "Course not found or you are not enrolled." }, { status: 404 });
  const learningPath = calculatePath(state, targetConceptId);
  if (!learningPath) {
    return NextResponse.json({ error: "Target concept is not active in this course." }, { status: 400 });
  }
  return NextResponse.json({ learningPath });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "LEARNER") return forbiddenResponse();
  const parsed = await parseJson(request, learningPathSchema);
  if ("response" in parsed) return parsed.response;
  const { courseId } = await params;
  const prisma = getPrismaClient();

  const result = await prisma.$transaction(async (transaction) => {
    const state = await loadLearnerCourseState(transaction, user.id, courseId);
    if (!state) return null;
    const learningPath = calculatePath(state, parsed.data.targetConceptId);
    if (!learningPath) return { error: "Target concept is not active in this course." } as const;
    const savedPath = await transaction.learningPath.create({
      data: {
        userId: user.id,
        courseId,
        targetConceptId: learningPath.targetConceptId,
        curriculumRevision: state.course.curriculumRevision,
        conceptIds: learningPath.conceptIds,
        estimatedMinutes: learningPath.estimatedMinutes,
      },
    });
    return {
      ...learningPath,
      calculatedAt: savedPath.calculatedAt,
    };
  });
  if (!result) return NextResponse.json({ error: "Course not found or you are not enrolled." }, { status: 404 });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ learningPath: result }, { status: 201 });
}
