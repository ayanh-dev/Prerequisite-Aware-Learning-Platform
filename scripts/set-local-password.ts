import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { promptForPassword } from "./prompt-password";

const prisma = new PrismaClient();

async function main() {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const email = (await prompt.question("Existing profile email: ")).trim().toLowerCase();
    prompt.close();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new Error("Enter a valid email address.");
    }

    const password = await promptForPassword();
    const result = await prisma.user.updateMany({
      where: { email },
      data: { passwordHash: await hashPassword(password) },
    });
    if (!result.count) {
      throw new Error("No local profile exists with that email.");
    }
    console.info(`Local password updated for ${email}.`);
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Could not update local password:", error);
  process.exitCode = 1;
});
