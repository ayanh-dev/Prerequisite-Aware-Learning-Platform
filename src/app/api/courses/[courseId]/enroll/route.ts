import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "LEARNER") return forbiddenResponse();

  const { courseId } = await params;
  const prisma = getPrismaClient();
  const course = await prisma.course.findFirst({
    where: { id: courseId, archivedAt: null },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  try {
    const enrollment = await prisma.enrollment.create({
      data: { userId: user.id, courseId },
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "You are already enrolled in this course." }, { status: 409 });
    }
    throw error;
  }
}
