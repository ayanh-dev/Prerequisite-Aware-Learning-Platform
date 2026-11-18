import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  pathwisePrisma?: PrismaClient;
};

export function getPrismaClient() {
  if (!globalForPrisma.pathwisePrisma) {
    globalForPrisma.pathwisePrisma = new PrismaClient();
  }

  return globalForPrisma.pathwisePrisma;
}
