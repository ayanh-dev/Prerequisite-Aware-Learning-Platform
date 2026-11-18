import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthSession } from "@/lib/auth";
import { parseJson } from "@/lib/api-utils";
import { hashPassword } from "@/lib/password";
import { getPrismaClient } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();

export async function POST(request: Request) {
  const parsed = await parseJson(request, registerSchema);
  if ("response" in parsed) return parsed.response;

  const prisma = getPrismaClient();
  const passwordHash = await hashPassword(parsed.data.password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "LEARNER",
      },
      select: { id: true, name: true, email: true, role: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    throw error;
  }

  await createAuthSession(user.id);
  return NextResponse.json({ user }, { status: 201 });
}
