import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";

const SESSION_COOKIE = "pathwise_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "LEARNER" | "INSTRUCTOR";
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}): AuthUser {
  if (user.role !== "LEARNER" && user.role !== "INSTRUCTOR") {
    throw new Error(`Unsupported user role: ${user.role}`);
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function createAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const prisma = getPrismaClient();

  await prisma.authSession.deleteMany({
    where: { userId, expiresAt: { lte: new Date() } },
  });
  await prisma.authSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getPrismaClient().authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await getPrismaClient().authSession.delete({ where: { id: session.id } });
    return null;
  }

  return toAuthUser(session.user);
}

export async function destroyAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await getPrismaClient().authSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}
