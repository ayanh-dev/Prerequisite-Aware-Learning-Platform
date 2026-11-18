import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getCycleIfPrerequisiteAdded } from "@/lib/learning-graph";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ conceptId: string }> };

const prerequisiteSchema = z.object({
  prerequisiteConceptId: z.string().min(1).max(128),
}).strict();

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, prerequisiteSchema);
  if ("response" in parsed) return parsed.response;
  const { conceptId } = await params;
  const prisma = getPrismaClient();
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const concept = await transaction.concept.findFirst({
        where: { id: conceptId, archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
        select: { id: true, courseId: true, title: true },
      });
      if (!concept) return { error: "Concept not found.", status: 404 } as const;
      const prerequisite = await transaction.concept.findFirst({
        where: {
          id: parsed.data.prerequisiteConceptId,
          courseId: concept.courseId,
          archivedAt: null,
        },
        select: { id: true, title: true },
      });
      if (!prerequisite) {
        return {
          error: "Prerequisite must be an active concept in the same course.",
          status: 400,
        } as const;
      }

      const concepts = await transaction.concept.findMany({
        where: { courseId: concept.courseId, archivedAt: null },
        select: { id: true, title: true, order: true, lessonDurationMinutes: true },
      });
      const prerequisites = await transaction.prerequisite.findMany({
        where: {
          concept: { courseId: concept.courseId, archivedAt: null },
          prerequisite: { archivedAt: null },
        },
        select: { conceptId: true, prerequisiteConceptId: true },
      });
      const cycle = getCycleIfPrerequisiteAdded(
        concept.id,
        prerequisite.id,
        concepts.map((item) => ({
          id: item.id,
          title: item.title,
          order: item.order,
          durationMinutes: item.lessonDurationMinutes,
        })),
        prerequisites.map(({ conceptId: dependentId, prerequisiteConceptId }) => ({
          conceptId: dependentId,
          prerequisiteId: prerequisiteConceptId,
        })),
      );
      if (cycle) {
        const titleById = new Map(concepts.map(({ id, title }) => [id, title]));
        return {
          error: `This prerequisite would create a cycle: ${cycle.map((id) => titleById.get(id) ?? id).join(" → ")}.`,
          cycle,
          status: 409,
        } as const;
      }

      const created = await transaction.prerequisite.create({
        data: { conceptId: concept.id, prerequisiteConceptId: prerequisite.id },
      });
      await recordCurriculumChange(transaction, {
        courseId: concept.courseId,
        actorId: user.id,
        conceptId: concept.id,
        kind: "PREREQUISITE_ADDED",
        summary: `New prerequisite: ${prerequisite.title} is now required before ${concept.title}.`,
        afterSnapshot: { conceptId, prerequisiteConceptId: prerequisite.id },
      });
      return { prerequisite: created } as const;
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, ...("cycle" in result ? { cycle: result.cycle } : {}) },
        { status: result.status },
      );
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This prerequisite relationship already exists." }, { status: 409 });
    }
    throw error;
  }
}
