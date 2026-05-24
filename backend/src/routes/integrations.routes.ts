import { Router } from "express";
import { applyLinearWebhookEvent, isLinearWebhookAuthorized } from "../services/linear-webhook.service.js";
import { getIntegrationSettings, updateIntegrationSettings } from "../services/integration-settings.service.js";

export const integrationsRouter = Router();

integrationsRouter.get("/settings", (_request, response) => {
  response.json(getIntegrationSettings());
});

integrationsRouter.put("/settings", (request, response) => {
  response.json(updateIntegrationSettings(request.body));
});

integrationsRouter.post("/linear/webhook", async (request, response, next) => {
  try {
    if (!isLinearWebhookAuthorized(request.headers)) {
      response.status(401).json({ received: false, message: "Invalid webhook secret." });
      return;
    }

    response.json(await applyLinearWebhookEvent(request.body));
  } catch (error) {
    next(error);
  }
});
