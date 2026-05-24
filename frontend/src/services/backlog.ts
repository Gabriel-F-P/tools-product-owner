import type { BacklogEpic, BacklogItem } from "../types/backlog";

export interface CreateIssuePayload {
  name: string;
  description?: string;
  sprint?: string;
  category?: string;
  client?: string;
  owner?: string;
  priority?: "Alta" | "Media" | "Baixa";
  storyPoints?: number;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
  integrationSettings?: Record<string, string>;
}

export interface UpdateIssuePayload {
  linearIssueId?: string;
  title: string;
  description?: string;
  linearIdentifier?: string;
  linearUrl?: string;
  priority?: "Alta" | "Media" | "Baixa";
  estimate?: number;
  owner?: string;
  status?: string;
}

export interface UpdateIssueResult {
  success?: boolean;
  statusMatched?: boolean;
  message?: string;
}

export interface ArchiveIssuePayload {
  linearIssueId?: string;
  title?: string;
  linearIdentifier?: string;
  linearUrl?: string;
}

export interface CreateEpicPayload {
  name: string;
  objective?: string;
  items: CreateIssuePayload[];
  integrationSettings?: Record<string, string>;
}

function getStoredIntegrationSettings() {
  const storedApiSettings = window.localStorage.getItem("toolz-api-settings");
  return storedApiSettings ? JSON.parse(storedApiSettings) : undefined;
}

export async function createIssue(payload: CreateIssuePayload) {
  const response = await fetch("/api/backlog/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      integrationSettings: getStoredIntegrationSettings()
    })
  });

  if (!response.ok) {
    throw new Error(await response.text() || "Nao foi possivel criar o item no backend.");
  }

  return response.json();
}

export async function updateIssue(payload: UpdateIssuePayload): Promise<UpdateIssueResult> {
  const issueId = payload.linearIssueId || "__missing_linear_issue_id__";
  const response = await fetch(`/api/backlog/issues/${encodeURIComponent(issueId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      integrationSettings: getStoredIntegrationSettings()
    })
  });

  if (!response.ok) {
    throw new Error(await response.text() || "Nao foi possivel atualizar o item no backend.");
  }

  return response.json();
}

export async function archiveIssue(payload: string | ArchiveIssuePayload) {
  const archivePayload = typeof payload === "string" ? { linearIssueId: payload } : payload;
  const issueId = archivePayload.linearIssueId || "__missing_linear_issue_id__";
  const response = await fetch(`/api/backlog/issues/${encodeURIComponent(issueId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...archivePayload,
      integrationSettings: getStoredIntegrationSettings()
    })
  });

  if (!response.ok) {
    throw new Error(await response.text() || "Nao foi possivel excluir o item no backend.");
  }

  return response.json();
}

export async function createEpic(payload: CreateEpicPayload) {
  const response = await fetch("/api/backlog/epics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      integrationSettings: getStoredIntegrationSettings()
    })
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel criar o epico no backend.");
  }

  return response.json();
}

export function toCreateEpicPayload(epic: Omit<BacklogEpic, "id" | "order" | "createdAt">): CreateEpicPayload {
  return {
    name: epic.name,
    objective: epic.objective,
    items: epic.items.map((item) => ({
      name: item.name,
      description: item.description,
      sprint: item.sprint,
      category: item.category,
      priority: item.priority,
      linearIdentifier: item.linearIdentifier,
      linearIssueId: item.linearIssueId,
      linearUrl: item.linearUrl
    }))
  };
}

function findCreatedIssueRecord(result: unknown): { id?: unknown; identifier?: unknown; url?: unknown } | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  if (Array.isArray(result)) {
    for (const entry of result) {
      const issue = findCreatedIssueRecord(entry);
      if (issue) {
        return issue;
      }
    }

    return null;
  }

  const record = result as Record<string, unknown>;
  const directIssue = record.issue;

  if (directIssue && typeof directIssue === "object") {
    return directIssue as { id?: unknown; identifier?: unknown; url?: unknown };
  }

  if (typeof record.id === "string" || typeof record.identifier === "string" || typeof record.url === "string") {
    return record as { id?: unknown; identifier?: unknown; url?: unknown };
  }

  for (const value of Object.values(record)) {
    const issue = findCreatedIssueRecord(value);
    if (issue) {
      return issue;
    }
  }

  return null;
}

export function applyCreatedIssueLink<TItem extends BacklogItem>(item: TItem, result: unknown): TItem {
  const issueRecord = findCreatedIssueRecord(result);

  if (!issueRecord) {
    return item;
  }

  const issueId = typeof issueRecord.id === "string" && !issueRecord.id.includes("{{") ? issueRecord.id : item.linearIssueId;
  const identifier = typeof issueRecord.identifier === "string" && !issueRecord.identifier.includes("{{")
    ? issueRecord.identifier
    : item.linearIdentifier;
  const url = typeof issueRecord.url === "string" && !issueRecord.url.includes("{{") ? issueRecord.url : item.linearUrl;

  return {
    ...item,
    linearIdentifier: identifier,
    linearIssueId: issueId,
    linearUrl: url
  };
}
