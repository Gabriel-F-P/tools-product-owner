import type { DashboardData } from "../types/dashboard";

export const mockDashboard: DashboardData = {
  period: "Sem dados",
  metrics: [
    { id: "development", label: "Em desenvolvimento", value: 0 },
    { id: "testing", label: "Em teste", value: 0 },
    { id: "done", label: "Concluidos", value: 0 }
  ],
  delayedCards: [],
  movements: []
};
