import { NextResponse } from "next/server";
import { z } from "zod";

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return {
      response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: NextResponse.json(
        {
          error: "Request validation failed.",
          issues: result.error.issues.map(({ path, message }) => ({
            path: path.join("."),
            message,
          })),
        },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
}
