import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ courseId: string }> };

const updateCourseSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one course field is required.");

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { courseId } = await params;
  const course = await getPrismaClient().course.findFirst({
    where: {
      id: courseId,
      archivedAt: null,
      ...(user.role === "INSTRUCTOR"
        ? { instructorId: user.id }
        : { enrollments: { some: { userId: user.id } } }),
    },
    include: {
      concepts: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, title: true, description: true, order: true, lessonDurationMinutes: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  return NextResponse.json({ course });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();

  const parsed = await parseJson(request, updateCourseSchema);
  if ("response" in parsed) return parsed.response;
  const { courseId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.course.findFirst({
    where: { id: courseId, instructorId: user.id, archivedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  try {
    const course = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.course.update({
        where: { id: courseId },
        data: parsed.data,
      });
      await recordCurriculumChange(transaction, {
        courseId,
        actorId: user.id,
        kind: "COURSE_UPDATED",
        summary: `Course details updated for ${updated.title}.`,
        beforeSnapshot: { title: existing.title, slug: existing.slug, description: existing.description },
        afterSnapshot: { title: updated.title, slug: updated.slug, description: updated.description },
      });
      return updated;
    });
    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That course slug is already in use." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const { courseId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.course.findFirst({
    where: { id: courseId, instructorId: user.id, archivedAt: null },
    select: { id: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  await prisma.$transaction(async (transaction) => {
    await transaction.course.update({
      where: { id: courseId },
      data: { archivedAt: new Date() },
    });
    await recordCurriculumChange(transaction, {
      courseId,
      actorId: user.id,
      kind: "COURSE_ARCHIVED",
      summary: `${existing.title} was archived by its instructor.`,
      beforeSnapshot: { archivedAt: null },
      afterSnapshot: { archivedAt: new Date().toISOString() },
    });
  });
  return new NextResponse(null, { status: 204 });
}
