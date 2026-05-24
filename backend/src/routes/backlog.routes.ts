import { Router } from "express";
import {
  archiveBacklogIssue,
  createBacklogEpic,
  createBacklogIssue,
  updateBacklogIssue
} from "../services/linear-backlog.service.js";

export const backlogRouter = Router();

backlogRouter.post("/issues", async (request, response, next) => {
  try {
    response.status(201).json(await createBacklogIssue(request.body));
  } catch (error) {
    next(error);
  }
});

backlogRouter.patch("/issues/:id", async (request, response, next) => {
  try {
    const linearIssueId = request.params.id === "__missing_linear_issue_id__" ? request.body.linearIssueId : request.params.id;
    response.json(await updateBacklogIssue({ ...request.body, linearIssueId }));
  } catch (error) {
    next(error);
  }
});

backlogRouter.delete("/issues/:id", async (request, response, next) => {
  try {
    const linearIssueId = request.params.id === "__missing_linear_issue_id__" ? request.body.linearIssueId : request.params.id;
    response.json(await archiveBacklogIssue({ ...request.body, linearIssueId }));
  } catch (error) {
    next(error);
  }
});

backlogRouter.post("/epics", async (request, response, next) => {
  try {
    response.status(201).json(await createBacklogEpic(request.body));
  } catch (error) {
    next(error);
  }
});
