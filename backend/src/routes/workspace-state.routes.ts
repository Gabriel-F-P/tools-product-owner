import { Router } from "express";
import { getWorkspaceState, saveWorkspaceState } from "../services/workspace-state.service.js";

export const workspaceStateRouter = Router();

workspaceStateRouter.get("/", async (_request, response, next) => {
  try {
    response.json({ data: await getWorkspaceState() });
  } catch (error) {
    next(error);
  }
});

workspaceStateRouter.put("/", async (request, response, next) => {
  try {
    response.json({ data: await saveWorkspaceState(request.body) });
  } catch (error) {
    next(error);
  }
});
