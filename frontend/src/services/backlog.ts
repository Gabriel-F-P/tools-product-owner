import type { BacklogEpic, BacklogItem } from "../types/backlog";
import { apiUrl } from "./api";

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
  sprint?: string;
  category?: string;
  client?: string;
  linearIdentifier?: string;
  linearUrl?: string;
  priority?: "Alta" | "Media" | "Baixa";
  estimate?: number;
  storyPoints?: number;
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
  const response = await fetch(apiUrl("/api/backlog/issues"), {
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
  const response = await fetch(apiUrl(`/api/backlog/issues/${encodeURIComponent(issueId)}`), {
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
  const response = await fetch(apiUrl(`/api/backlog/issues/${encodeURIComponent(issueId)}`), {
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
  const response = await fetch(apiUrl("/api/backlog/epics"), {
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

function findCreatedIssueRecord(result: unknown): Record<string, unknown> | null {
  if (typeof result === "string") {
    try {
      return findCreatedIssueRecord(JSON.parse(result));
    } catch {
      return null;
    }
  }

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
  const directIssue = record.issue ?? record.data ?? record.node;

  if (directIssue && typeof directIssue === "object") {
    const issue = findCreatedIssueRecord(directIssue);

    if (issue) {
      return issue;
    }
  }

  if (
    typeof record.id === "string" ||
    typeof record.issueId === "string" ||
    typeof record.linearIssueId === "string" ||
    typeof record.identifier === "string" ||
    typeof record.linearIdentifier === "string" ||
    typeof record.url === "string" ||
    typeof record.linearUrl === "string"
  ) {
    return record;
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

  const issueId = getResponseString(issueRecord.id) ?? getResponseString((issueRecord as Record<string, unknown>).issueId) ?? getResponseString((issueRecord as Record<string, unknown>).linearIssueId) ?? item.linearIssueId;
  const identifier = getResponseString(issueRecord.identifier) ?? getResponseString((issueRecord as Record<string, unknown>).linearIdentifier)
    ? getResponseString(issueRecord.identifier) ?? getResponseString((issueRecord as Record<string, unknown>).linearIdentifier)
    : item.linearIdentifier;
  const url = getResponseString(issueRecord.url) ?? getResponseString((issueRecord as Record<string, unknown>).linearUrl) ?? item.linearUrl;
  const title = getResponseString(issueRecord.title) ?? getResponseString(issueRecord.name);
  const description = getResponseString(issueRecord.description);
  const owner = getResponseString(issueRecord.owner) ?? getResponseString(issueRecord.assignee);
  const sprint = getResponseString(issueRecord.sprint);
  const category = getResponseString(issueRecord.category);
  const client = getResponseString(issueRecord.client);
  const priority = getPriorityValue(issueRecord.priority) ?? item.priority;
  const storyPoints = getNumberValue(issueRecord.storyPoints) ?? getNumberValue(issueRecord.estimate);

  return {
    ...item,
    name: title ?? item.name,
    description: description ?? item.description,
    owner: owner ?? item.owner,
    sprint: sprint ?? item.sprint,
    category: category ?? item.category,
    client: client ?? item.client,
    priority,
    storyPoints: storyPoints ?? item.storyPoints,
    linearIdentifier: identifier,
    linearIssueId: issueId,
    linearUrl: url
  };
}

function getResponseString(value: unknown) {
  return typeof value === "string" && value.trim() && !value.includes("{{") && value !== "undefined" ? value : undefined;
}

function getNumberValue(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function getPriorityValue(value: unknown): BacklogItem["priority"] | undefined {
  if (value === "Alta" || value === "Media" || value === "Baixa") {
    return value;
  }

  const priority = Number(value);

  if (!Number.isFinite(priority)) {
    return undefined;
  }

  if (priority <= 2) {
    return "Alta";
  }

  if (priority >= 4) {
    return "Baixa";
  }

  return "Media";
}
