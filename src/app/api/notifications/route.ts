import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const notifications = await getPrismaClient().notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter(({ readAt }) => readAt === null).length,
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  await getPrismaClient().notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return new NextResponse(null, { status: 204 });
}
