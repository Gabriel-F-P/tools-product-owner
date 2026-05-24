import { Router } from "express";
import { getIntegrationSettings, updateIntegrationSettings } from "../services/integration-settings.service.js";

export const integrationsRouter = Router();

integrationsRouter.get("/settings", (_request, response) => {
  response.json(getIntegrationSettings());
});

integrationsRouter.put("/settings", (request, response) => {
  response.json(updateIntegrationSettings(request.body));
});

integrationsRouter.post("/linear/webhook", (request, response) => {
  response.json({
    received: true,
    event: request.body?.action ? `linear.issue.${request.body.action}` : "linear.issue.event"
  });
});
