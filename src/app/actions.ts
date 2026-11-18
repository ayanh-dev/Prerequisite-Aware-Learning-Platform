"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroyAuthSession, getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";

async function getPathwiseUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in before updating PathWise data.");
  return user.id;
}

export async function signOutAction() {
  await destroyAuthSession();
  redirect("/login");
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string" || notificationId.length === 0) {
    throw new Error("A notification ID is required.");
  }

  const userId = await getPathwiseUserId();
  await getPrismaClient().notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const userId = await getPathwiseUserId();
  await getPrismaClient().notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/");
}
