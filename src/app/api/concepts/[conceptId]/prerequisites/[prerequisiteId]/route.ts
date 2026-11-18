import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ conceptId: string; prerequisiteId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const { conceptId, prerequisiteId } = await params;
  const prisma = getPrismaClient();
  const link = await prisma.prerequisite.findFirst({
    where: {
      conceptId,
      prerequisiteConceptId: prerequisiteId,
      concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
      prerequisite: { archivedAt: null },
    },
    include: {
      concept: { select: { title: true, courseId: true } },
      prerequisite: { select: { title: true } },
    },
  });
  if (!link) return NextResponse.json({ error: "Prerequisite relationship not found." }, { status: 404 });

  await prisma.$transaction(async (transaction) => {
    await transaction.prerequisite.delete({ where: { id: link.id } });
    await recordCurriculumChange(transaction, {
      courseId: link.concept.courseId,
      actorId: user.id,
      conceptId,
      kind: "PREREQUISITE_REMOVED",
      summary: `${link.prerequisite.title} is no longer a prerequisite for ${link.concept.title}.`,
      beforeSnapshot: { conceptId, prerequisiteConceptId: prerequisiteId },
    });
  });
  return new NextResponse(null, { status: 204 });
}
