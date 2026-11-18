import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { promptForPassword } from "./prompt-password";

const prisma = new PrismaClient();

async function main() {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const name = (await prompt.question("Instructor name: ")).trim();
    const email = (await prompt.question("Instructor email: ")).trim().toLowerCase();
    if (name.length < 2 || name.length > 80) {
      throw new Error("Name must contain 2 to 80 characters.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new Error("Enter a valid email address.");
    }
    prompt.close();

    const password = await promptForPassword();
    const passwordHash = await hashPassword(password);
    await prisma.user.upsert({
      where: { email },
      update: { name, role: "INSTRUCTOR", passwordHash },
      create: { name, email, role: "INSTRUCTOR", passwordHash },
    });
    console.info(`Instructor profile saved for ${email}.`);
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Could not create instructor:", error);
  process.exitCode = 1;
});
