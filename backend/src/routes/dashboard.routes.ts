import { Router } from "express";
import { getDashboard } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", (_request, response) => {
  response.json(getDashboard());
});
