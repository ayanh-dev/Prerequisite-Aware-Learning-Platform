import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function PATCH(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { notificationId } = await params;
  const result = await getPrismaClient().notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await getPrismaClient().notification.findFirst({
      where: { id: notificationId, userId: user.id },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
