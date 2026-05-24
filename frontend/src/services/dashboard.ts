import type { DashboardData } from "../types/dashboard";
import { mockDashboard } from "./mockDashboard";

export async function getDashboard(): Promise<DashboardData> {
  try {
    const response = await fetch("/api/dashboard");
    if (!response.ok) {
      throw new Error("Dashboard API unavailable");
    }
    return await response.json();
  } catch {
    return mockDashboard;
  }
}
