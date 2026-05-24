import type { DashboardData } from "../types/dashboard";

export const mockDashboard: DashboardData = {
  period: "20/05/2024 - 26/05/2024",
  metrics: [
    { id: "development", label: "Em desenvolvimento", value: 12 },
    { id: "testing", label: "Em teste", value: 5 },
    { id: "done", label: "Concluídos", value: 28 }
  ],
  delayedCards: [
    { id: "CARD-192", title: "Fluxo de discovery", owner: "Marina", extraHours: "+3h", lastMovement: "18/05 09:42" },
    { id: "CARD-204", title: "Priorização da sprint", owner: "Bruno", extraHours: "+5h", lastMovement: "18/05 11:30" },
    { id: "CARD-221", title: "Mapa de stakeholders", owner: "Ana", extraHours: "+2h", lastMovement: "19/05 08:10" },
    { id: "CARD-233", title: "Validação de critérios", owner: "Lucas", extraHours: "+1h", lastMovement: "19/05 12:05" },
    { id: "CARD-241", title: "Ajustes de backlog", owner: "Diego", extraHours: "+4h", lastMovement: "19/05 14:18" }
  ],
  movements: [
    { id: "MOVE-1", developer: "Nina", card: "CARD-302", status: "development", elapsed: "15 min" },
    { id: "MOVE-2", developer: "Rafa", card: "CARD-298", status: "testing", elapsed: "1 h" },
    { id: "MOVE-3", developer: "Lia", card: "CARD-287", status: "done", elapsed: "2 h" },
    { id: "MOVE-4", developer: "Caio", card: "CARD-280", status: "development", elapsed: "3 h" },
    { id: "MOVE-5", developer: "Maya", card: "CARD-276", status: "testing", elapsed: "5 h" }
  ]
};
