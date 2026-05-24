export type BacklogPriority = "Alta" | "Media" | "Baixa";

export interface CreateBacklogIssueInput {
  name: string;
  description?: string;
  sprint?: string;
  category?: string;
  client?: string;
  owner?: string;
  priority?: BacklogPriority;
  storyPoints?: number;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
  integrationSettings?: {
    linearApiKey?: string;
    linearDefaultStateId?: string;
    linearProjectId?: string;
    linearTeamId?: string;
    linearToolWebhookUrl?: string;
    linearWebhookSecret?: string;
  };
}

export interface CreateBacklogEpicInput {
  name: string;
  objective?: string;
  items: CreateBacklogIssueInput[];
  integrationSettings?: CreateBacklogIssueInput["integrationSettings"];
}

export interface UpdateBacklogIssueInput {
  linearIssueId?: string;
  title: string;
  description?: string;
  linearIdentifier?: string;
  linearUrl?: string;
  priority?: BacklogPriority;
  estimate?: number;
  owner?: string;
  status?: string;
  linearStateId?: string;
  integrationSettings?: CreateBacklogIssueInput["integrationSettings"];
}

export interface ArchiveBacklogIssueInput {
  linearIssueId?: string;
  title?: string;
  linearIdentifier?: string;
  linearUrl?: string;
  integrationSettings?: CreateBacklogIssueInput["integrationSettings"];
}
