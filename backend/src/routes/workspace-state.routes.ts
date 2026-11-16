import { Router } from "express";
import { getWorkspaceStateRecord, saveWorkspaceState } from "../services/workspace-state.service.js";

export const workspaceStateRouter = Router();

workspaceStateRouter.get("/", async (_request, response, next) => {
  try {
    response.json(await getWorkspaceStateRecord());
  } catch (error) {
    next(error);
  }
});

workspaceStateRouter.put("/", async (request, response, next) => {
  try {
    await saveWorkspaceState(request.body);
    // Devolve também o updatedAt para o cliente não reaplicar o próprio estado salvo.
    response.json(await getWorkspaceStateRecord());
  } catch (error) {
    next(error);
  }
});
