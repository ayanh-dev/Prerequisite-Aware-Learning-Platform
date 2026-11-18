import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthSession } from "@/lib/auth";
import { parseJson } from "@/lib/api-utils";
import { verifyPassword } from "@/lib/password";
import { getPrismaClient } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export async function POST(request: Request) {
  const parsed = await parseJson(request, loginSchema);
  if ("response" in parsed) return parsed.response;

  const user = await getPrismaClient().user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  if (user.role !== "LEARNER" && user.role !== "INSTRUCTOR") {
    throw new Error(`Unsupported user role: ${user.role}`);
  }

  await createAuthSession(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
