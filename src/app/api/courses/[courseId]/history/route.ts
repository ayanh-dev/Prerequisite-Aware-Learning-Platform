import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { courseId } = await params;
  const prisma = getPrismaClient();
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      ...(user.role === "INSTRUCTOR"
        ? { instructorId: user.id }
        : { enrollments: { some: { userId: user.id } } }),
    },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const changes = await prisma.curriculumChange.findMany({
    where: { courseId },
    orderBy: { revision: "desc" },
    include: { actor: { select: { name: true, role: true } } },
  });
  return NextResponse.json({ changes });
}
