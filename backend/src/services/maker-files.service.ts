import { randomUUID } from "node:crypto";
import { prisma } from "../database/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

/**
 * Arquivos do Maker (fotos e arquivos 3D dos modelos).
 * Ficam na mesma tabela WorkspaceState, com a chave "maker-file:<id>", para não exigir migração.
 * Sem banco disponível, ficam em memória enquanto o servidor estiver rodando.
 */
export interface MakerFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: Buffer;
}

const KEY_PREFIX = "maker-file:";
const memoryFiles = new Map<string, MakerFile>();

type StoredFile = { name: string; type: string; size: number; base64: string };

export async function saveMakerFile(input: { name: string; type: string; data: Buffer }): Promise<MakerFile> {
  const file: MakerFile = { id: randomUUID(), name: input.name, type: input.type, size: input.data.length, data: input.data };
  memoryFiles.set(file.id, file);

  const stored: StoredFile = { name: file.name, type: file.type, size: file.size, base64: file.data.toString("base64") };

  try {
    await prisma.workspaceState.create({
      data: { key: `${KEY_PREFIX}${file.id}`, data: stored as unknown as Prisma.InputJsonValue }
    });
  } catch (error) {
    console.log("maker-file save fallback", error instanceof Error ? error.message : String(error));
  }

  return file;
}

export async function getMakerFile(id: string): Promise<MakerFile | null> {
  const cached = memoryFiles.get(id);
  if (cached) {
    return cached;
  }

  try {
    const record = await prisma.workspaceState.findUnique({ where: { key: `${KEY_PREFIX}${id}` } });
    const stored = record?.data as unknown as StoredFile | undefined;
    if (!stored?.base64) {
      return null;
    }

    const file: MakerFile = { id, name: stored.name, type: stored.type, size: stored.size, data: Buffer.from(stored.base64, "base64") };
    memoryFiles.set(id, file);
    return file;
  } catch (error) {
    console.log("maker-file read fallback", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function deleteMakerFile(id: string) {
  memoryFiles.delete(id);

  try {
    await prisma.workspaceState.deleteMany({ where: { key: `${KEY_PREFIX}${id}` } });
  } catch (error) {
    console.log("maker-file delete fallback", error instanceof Error ? error.message : String(error));
  }
}
