import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_PRIVATE_URL ?? process.env.DATABASE_PUBLIC_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL, DATABASE_PRIVATE_URL, or DATABASE_PUBLIC_URL is required.");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
