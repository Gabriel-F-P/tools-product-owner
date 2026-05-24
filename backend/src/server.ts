import cors from "cors";
import "dotenv/config";
import express from "express";
import { backlogRouter } from "./routes/backlog.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { integrationsRouter } from "./routes/integrations.routes.js";
import { workspaceStateRouter } from "./routes/workspace-state.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3333);

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://127.0.0.1:5173" }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/dashboard", dashboardRouter);
app.use("/api/backlog", backlogRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/workspace-state", workspaceStateRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  response.status(500).json({ message });
});

app.listen(port, () => {
  console.log(`API running on http://127.0.0.1:${port}`);
});
