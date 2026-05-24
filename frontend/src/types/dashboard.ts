export type Status = "development" | "testing" | "done";

export interface Metric {
  id: Status;
  label: string;
  value: number;
}

export interface DelayedCard {
  id: string;
  title: string;
  owner: string;
  extraHours: string;
  lastMovement: string;
}

export interface TeamMovement {
  id: string;
  developer: string;
  card: string;
  status: Status;
  elapsed: string;
}

export interface DashboardData {
  period: string;
  metrics: Metric[];
  delayedCards: DelayedCard[];
  movements: TeamMovement[];
}
