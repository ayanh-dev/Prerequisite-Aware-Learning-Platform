import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  return NextResponse.json({ user });
}
