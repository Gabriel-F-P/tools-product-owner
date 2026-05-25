import type { DashboardData } from "../types/dashboard";
import { apiUrl } from "./api";
import { mockDashboard } from "./mockDashboard";

export async function getDashboard(): Promise<DashboardData> {
  try {
    const response = await fetch(apiUrl("/api/dashboard"));
    if (!response.ok) {
      throw new Error("Dashboard API unavailable");
    }
    return await response.json();
  } catch {
    return mockDashboard;
  }
}
