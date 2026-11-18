import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

const createCourseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().min(1).max(2000),
}).strict();

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const where: Prisma.CourseWhereInput =
    user.role === "INSTRUCTOR"
      ? { instructorId: user.id, archivedAt: null }
      : { archivedAt: null };
  const courses = await getPrismaClient().course.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      curriculumRevision: true,
      _count: { select: { concepts: true, enrollments: true } },
      ...(user.role === "LEARNER"
        ? { enrollments: { where: { userId: user.id }, select: { id: true } } }
        : {}),
    },
  });
  return NextResponse.json({
    courses: courses.map((course) => ({
      ...course,
      enrolled: user.role === "INSTRUCTOR" || course.enrollments?.length === 1,
      enrollments: undefined,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();

  const parsed = await parseJson(request, createCourseSchema);
  if ("response" in parsed) return parsed.response;

  const slug = parsed.data.slug ?? parsed.data.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const normalizedSlug = slug.replace(/-+$/g, "");
  if (!normalizedSlug) {
    return NextResponse.json({ error: "Provide a slug for a course title without letters or numbers." }, { status: 400 });
  }
  try {
    const course = await getPrismaClient().course.create({
      data: {
        title: parsed.data.title,
        slug: normalizedSlug,
        description: parsed.data.description,
        instructorId: user.id,
      },
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That course slug is already in use." }, { status: 409 });
    }
    throw error;
  }
}
