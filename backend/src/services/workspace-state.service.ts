import { prisma } from "../database/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

const WORKSPACE_STATE_KEY = "default";
let fallbackWorkspaceState: Prisma.JsonValue | null = null;

export async function getWorkspaceState() {
  try {
    const state = await prisma.workspaceState.findUnique({
      where: { key: WORKSPACE_STATE_KEY }
    });

    fallbackWorkspaceState = state?.data ?? fallbackWorkspaceState;
    return state?.data ?? fallbackWorkspaceState;
  } catch (error) {
    console.log("workspace-state read fallback", error instanceof Error ? error.message : String(error));
    return fallbackWorkspaceState;
  }
}

export async function getWorkspaceStateRecord() {
  try {
    const state = await prisma.workspaceState.findUnique({
      where: { key: WORKSPACE_STATE_KEY }
    });

    fallbackWorkspaceState = state?.data ?? fallbackWorkspaceState;

    return {
      data: state?.data ?? fallbackWorkspaceState,
      updatedAt: state?.updatedAt?.toISOString() ?? null
    };
  } catch (error) {
    console.log("workspace-state read fallback", error instanceof Error ? error.message : String(error));

    return {
      data: fallbackWorkspaceState,
      updatedAt: null
    };
  }
}

export async function saveWorkspaceState(data: Prisma.InputJsonValue) {
  fallbackWorkspaceState = JSON.parse(JSON.stringify(data ?? {})) as Prisma.JsonValue;

  try {
    const state = await prisma.workspaceState.upsert({
      create: {
        data: fallbackWorkspaceState as Prisma.InputJsonValue,
        key: WORKSPACE_STATE_KEY
      },
      update: {
        data: fallbackWorkspaceState as Prisma.InputJsonValue
      },
      where: { key: WORKSPACE_STATE_KEY }
    });

    fallbackWorkspaceState = state.data;
    return state.data;
  } catch (error) {
    console.log("workspace-state save fallback", error instanceof Error ? error.message : String(error));
    return fallbackWorkspaceState;
  }
}
