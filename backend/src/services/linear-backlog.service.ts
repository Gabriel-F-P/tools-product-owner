import { createLinearClient } from "../integrations/linear/linear.client.js";
import { createN8nClient } from "../integrations/n8n/n8n.client.js";
import { getIntegrationSettings } from "./integration-settings.service.js";
import { getWorkspaceState } from "./workspace-state.service.js";
import type {
  ArchiveBacklogIssueInput,
  BacklogPriority,
  CreateBacklogEpicInput,
  CreateBacklogIssueInput,
  UpdateBacklogIssueInput
} from "../types/backlog.types.js";
import { randomUUID } from "node:crypto";

interface CreatedLinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  description?: string;
  priority?: BacklogPriority;
  estimate?: number;
  owner?: string;
  sprint?: string;
  category?: string;
  client?: string;
}

interface LinearLabel {
  id: string;
  name: string;
}

interface LinearCycle {
  id: string;
  name: string;
}

interface LinearWorkflowState {
  id: string;
  name: string;
}

interface LinearUser {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
}

interface LinkedLinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  priority?: number | null;
  estimate?: number | null;
  url: string;
  assignee?: { name?: string | null; displayName?: string | null; email?: string | null } | null;
  cycle?: { name?: string | null } | null;
  labels?: { nodes: Array<{ name: string }> };
}

const createdIssuesByTitle = new Map<string, CreatedLinearIssue>();

const priorityMap: Record<BacklogPriority, number> = {
  Alta: 2,
  Media: 3,
  Baixa: 4
};

type IntegrationSettingsInput = {
  integrationSettings?: CreateBacklogIssueInput["integrationSettings"];
};

function getLinearConfig(input?: IntegrationSettingsInput) {
  const settings = getIntegrationSettings();
  const inputSettings = input?.integrationSettings;

  return {
    apiKey: inputSettings?.linearApiKey || settings.linearApiKey || process.env.LINEAR_API_KEY,
    teamId: inputSettings?.linearTeamId || settings.linearTeamId || process.env.LINEAR_TEAM_ID,
    defaultStateId: inputSettings?.linearDefaultStateId || settings.linearDefaultStateId || process.env.LINEAR_DEFAULT_STATE_ID,
    projectId: inputSettings?.linearProjectId || settings.linearProjectId || process.env.LINEAR_PROJECT_ID,
    relationType: process.env.LINEAR_EPIC_RELATION_TYPE ?? "related"
  };
}

function getN8nConfig(input?: IntegrationSettingsInput) {
  const settings = getIntegrationSettings();
  const inputSettings = input?.integrationSettings;
  const webhookUrl = inputSettings?.linearToolWebhookUrl || settings.linearToolWebhookUrl || process.env.N8N_LINEAR_WEBHOOK_URL;

  return {
    secret: inputSettings?.linearWebhookSecret || settings.linearWebhookSecret || process.env.N8N_WEBHOOK_SECRET,
    webhookUrl: webhookUrl?.startsWith("/")
      ? `${process.env.N8N_BASE_URL ?? "https://toolzz.cloud"}${webhookUrl}`
      : webhookUrl
  };
}

function isLinearConfigured() {
  const config = getLinearConfig();
  return Boolean(config.apiKey && config.teamId);
}

function isN8nConfigured(input?: IntegrationSettingsInput) {
  return Boolean(getN8nConfig(input).webhookUrl);
}

function createMockIssue(input: CreateBacklogIssueInput): CreatedLinearIssue {
  if (input.linearUrl || input.linearIssueId || input.linearIdentifier) {
    const reference = getLinearIssueReference(input);
    const identifier = reference.identifier ?? reference.id ?? reference.url ?? `LINK-${randomUUID().slice(0, 8).toUpperCase()}`;

    return {
      id: reference.id ?? identifier,
      identifier,
      title: input.name,
      url: reference.url ?? `https://linear.app/linked/${identifier}`
    };
  }

  const identifier = `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    id: identifier,
    identifier,
    title: input.name,
    url: `https://linear.app/mock/issue/${identifier}`
  };
}

function getLinearIdentifierFromUrl(url?: string) {
  if (!url?.trim()) {
    return undefined;
  }

  const match = url.match(/\/([A-Z]+-\d+)(?:\b|$)/i) ?? url.match(/\b([A-Z]+-\d+)\b/i);
  return match?.[1]?.toUpperCase();
}

function isLinearUuid(value?: string) {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
}

function isLinearIdentifier(value?: string) {
  return Boolean(value?.match(/^[A-Z]+-\d+$/i));
}

function isHttpUrl(value?: string) {
  return Boolean(value?.match(/^https?:\/\//i));
}

function getLinearIssueReference(input: Pick<CreateBacklogIssueInput | UpdateBacklogIssueInput | ArchiveBacklogIssueInput, "linearIdentifier" | "linearIssueId" | "linearUrl">) {
  const rawIssueId = input.linearIssueId?.trim();
  const rawIdentifier = input.linearIdentifier?.trim();
  const rawUrl = input.linearUrl?.trim();
  const urlFromIssueId = isHttpUrl(rawIssueId) ? rawIssueId : undefined;
  const identifierFromIssueId = isLinearIdentifier(rawIssueId) ? rawIssueId?.toUpperCase() : undefined;
  const identifierFromUrl = getLinearIdentifierFromUrl(rawUrl ?? urlFromIssueId);

  return {
    id: isLinearUuid(rawIssueId) ? rawIssueId : undefined,
    identifier: rawIdentifier?.toUpperCase() ?? identifierFromIssueId ?? identifierFromUrl,
    url: rawUrl ?? urlFromIssueId
  };
}

function normalizeIssuePriority(value: unknown): BacklogPriority {
  const priority = typeof value === "number" ? value : Number(value);

  if (priority <= 2) {
    return "Alta";
  }

  if (priority >= 4) {
    return "Baixa";
  }

  return "Media";
}

function buildDescription(input: CreateBacklogIssueInput, epicName?: string) {
  const lines = [
    input.description,
    epicName ? `Epico: ${epicName}` : undefined,
    input.sprint ? `Sprint: ${input.sprint}` : undefined,
    input.category ? `Categoria: ${input.category}` : undefined
  ].filter(Boolean);

  return lines.join("\n\n");
}

function findCreatedIssueRecord(result: unknown): CreatedLinearIssue | undefined {
  if (typeof result === "string") {
    try {
      return findCreatedIssueRecord(JSON.parse(result));
    } catch {
      return undefined;
    }
  }

  if (!result || typeof result !== "object") {
    return undefined;
  }

  if (Array.isArray(result)) {
    for (const entry of result) {
      const issue = findCreatedIssueRecord(entry);
      if (issue) {
        return issue;
      }
    }

    return undefined;
  }

  const record = result as Record<string, unknown>;
  const issue = record.issue ?? record.data ?? record.node;

  if (issue && typeof issue === "object") {
    const issueRecord = issue as Record<string, unknown>;
    const id = getIssueIdFromRecord(issueRecord);

    if (id) {
      return {
        id,
        identifier: getStringValue(issueRecord.identifier) ?? getStringValue(issueRecord.linearIdentifier) ?? id,
        title: typeof issueRecord.title === "string" ? issueRecord.title : "",
        url: getStringValue(issueRecord.url) ?? getStringValue(issueRecord.linearUrl) ?? ""
      };
    }
  }

  const id = getIssueIdFromRecord(record);

  if (id) {
    return {
      id,
      identifier: getStringValue(record.identifier) ?? getStringValue(record.linearIdentifier) ?? id,
      title: typeof record.title === "string" ? record.title : "",
      url: getStringValue(record.url) ?? getStringValue(record.linearUrl) ?? ""
    };
  }

  for (const value of Object.values(record)) {
    const nestedIssue = findCreatedIssueRecord(value);
    if (nestedIssue) {
      return nestedIssue;
    }
  }

  return undefined;
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() && !value.includes("{{") && value !== "undefined" ? value : undefined;
}

function getIssueIdFromRecord(record: Record<string, unknown>) {
  return getStringValue(record.id) ?? getStringValue(record.issueId) ?? getStringValue(record.linearIssueId);
}

async function resolveLabelId(client: ReturnType<typeof createLinearClient>, category?: string) {
  if (!category) {
    return undefined;
  }

  const data = await client.request<{ issueLabels: { nodes: LinearLabel[] } }>(`
    query IssueLabels {
      issueLabels(first: 100) {
        nodes {
          id
          name
        }
      }
    }
  `);

  return data.issueLabels.nodes.find((label) => label.name.toLowerCase() === category.toLowerCase())?.id;
}

async function resolveLabelIds(client: ReturnType<typeof createLinearClient>, labels: Array<string | undefined>) {
  const wantedLabels = labels.map((label) => label?.trim()).filter(Boolean) as string[];

  if (!wantedLabels.length) {
    return undefined;
  }

  const data = await client.request<{ issueLabels: { nodes: LinearLabel[] } }>(`
    query IssueLabels {
      issueLabels(first: 250) {
        nodes {
          id
          name
        }
      }
    }
  `);
  const labelIds = wantedLabels
    .map((wantedLabel) => {
      const normalizedWantedLabel = normalizeLinearStateName(wantedLabel);
      return data.issueLabels.nodes.find((label) => normalizeLinearStateName(label.name) === normalizedWantedLabel)?.id;
    })
    .filter(Boolean) as string[];

  return labelIds.length ? Array.from(new Set(labelIds)) : undefined;
}

async function resolveCycleId(client: ReturnType<typeof createLinearClient>, teamId: string, sprint?: string) {
  if (!sprint) {
    return undefined;
  }

  const data = await client.request<{ team: { cycles: { nodes: LinearCycle[] } } }>(
    `
      query TeamCycles($teamId: String!) {
        team(id: $teamId) {
          cycles(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    `,
    { teamId }
  );

  const normalizedSprint = normalizeLinearStateName(sprint);
  return data.team.cycles.nodes.find((cycle) => normalizeLinearStateName(cycle.name) === normalizedSprint)?.id;
}

async function resolveAssigneeId(client: ReturnType<typeof createLinearClient>, owner?: string) {
  if (!owner?.trim()) {
    return undefined;
  }

  const data = await client.request<{ users: { nodes: LinearUser[] } }>(`
    query Users {
      users(first: 250) {
        nodes {
          id
          name
          displayName
          email
        }
      }
    }
  `);
  const normalizedOwner = normalizeLinearStateName(owner);

  return data.users.nodes.find((user) => {
    const values = [user.name, user.displayName, user.email].filter(Boolean) as string[];
    return values.some((value) => normalizeLinearStateName(value) === normalizedOwner || normalizeLinearStateName(value).includes(normalizedOwner));
  })?.id;
}

async function resolveLinearStateByName(input: UpdateBacklogIssueInput) {
  if (!input.status?.trim()) {
    return undefined;
  }

  const config = getLinearConfig(input);

  if (!config.apiKey || !config.teamId) {
    return undefined;
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const data = await client.request<{ team: { states: { nodes: LinearWorkflowState[] } } }>(
    `
      query TeamWorkflowStates($teamId: String!) {
        team(id: $teamId) {
          states(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    `,
    { teamId: config.teamId }
  );
  const normalizedStatus = normalizeLinearStateName(input.status);

  return data.team.states.nodes.find((state) => normalizeLinearStateName(state.name) === normalizedStatus);
}

async function findLinearIssueByTitle(input: CreateBacklogIssueInput): Promise<CreatedLinearIssue | undefined> {
  const config = getLinearConfig(input);

  if (!config.apiKey || !input.name.trim()) {
    return undefined;
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const data = await client.request<{ issues: { nodes: Array<CreatedLinearIssue & { createdAt?: string }> } }>(
    `
      query FindIssueByTitle($title: String!) {
        issues(
          first: 10,
          filter: { title: { containsIgnoreCase: $title } },
          orderBy: createdAt
        ) {
          nodes {
            id
            identifier
            title
            url
            createdAt
          }
        }
      }
    `,
    { title: input.name }
  );

  return data.issues.nodes.find((issue) => issue.title === input.name) ?? data.issues.nodes[0];
}

async function findLinkedLinearIssue(input: CreateBacklogIssueInput): Promise<CreatedLinearIssue | undefined> {
  const config = getLinearConfig(input);
  const reference = getLinearIssueReference(input);
  const term = reference.id ?? reference.identifier;

  if (!config.apiKey || !term) {
    return undefined;
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const data = await client.request<{
    issue?: LinkedLinearIssueNode | null;
  }>(
    `
      query FindLinkedIssue($term: String!) {
        issue(id: $term) {
          id
          identifier
          title
          description
          priority
          estimate
          url
          assignee {
            name
            displayName
            email
          }
          cycle {
            name
          }
          labels {
            nodes {
              name
            }
          }
        }
      }
    `,
    { term }
  );

  return data.issue ? toCreatedLinearIssue(data.issue) : undefined;
}

function toCreatedLinearIssue(issue: LinkedLinearIssueNode): CreatedLinearIssue {
  const labels = issue.labels?.nodes.map((label) => label.name) ?? [];

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    description: issue.description ?? undefined,
    priority: normalizeIssuePriority(issue.priority),
    estimate: issue.estimate ?? undefined,
    owner: issue.assignee?.displayName ?? issue.assignee?.name ?? issue.assignee?.email ?? undefined,
    sprint: issue.cycle?.name ?? undefined,
    category: labels[0],
    client: labels[1]
  };
}

async function findLinearIssueByTitleWithRetry(input: CreateBacklogIssueInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const issue = await findLinearIssueByTitle(input);

    if (issue) {
      return issue;
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return undefined;
}

async function createLinearIssue(input: CreateBacklogIssueInput, epicName?: string): Promise<CreatedLinearIssue> {
  if (input.linearUrl || input.linearIssueId || input.linearIdentifier) {
    return createMockIssue(input);
  }

  const config = getLinearConfig(input);

  if (!config.apiKey || !config.teamId) {
    return createMockIssue(input);
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const [labelId, cycleId] = await Promise.all([
    resolveLabelId(client, input.category),
    resolveCycleId(client, config.teamId, input.sprint)
  ]);

  const issueInput = {
    title: input.name,
    description: buildDescription(input, epicName),
    teamId: config.teamId,
    stateId: config.defaultStateId,
    projectId: config.projectId,
    priority: priorityMap[input.priority ?? "Media"],
    labelIds: labelId ? [labelId] : undefined,
    cycleId
  };

  const data = await client.request<{ issueCreate: { success: boolean; issue: CreatedLinearIssue } }>(
    `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `,
    { input: issueInput }
  );

  if (!data.issueCreate.success) {
    throw new Error("Linear did not create the issue.");
  }

  return data.issueCreate.issue;
}

async function createIssueRelation(issueId: string, relatedIssueId: string) {
  const config = getLinearConfig();

  if (!config.apiKey) {
    return { id: `mock-relation-${issueId}-${relatedIssueId}`, type: config.relationType };
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const data = await client.request<{ issueRelationCreate: { success: boolean; issueRelation: { id: string; type: string } } }>(
    `
      mutation IssueRelationCreate($input: IssueRelationCreateInput!) {
        issueRelationCreate(input: $input) {
          success
          issueRelation {
            id
            type
          }
        }
      }
    `,
    {
      input: {
        issueId,
        relatedIssueId,
        type: config.relationType
      }
    }
  );

  return data.issueRelationCreate.issueRelation;
}

async function createN8nIssue(input: CreateBacklogIssueInput) {
  const config = getN8nConfig(input);
  const linearConfig = getLinearConfig(input);

  if (!config.webhookUrl) {
    return undefined;
  }

  const client = createN8nClient({ secret: config.secret, webhookUrl: config.webhookUrl });
  const linearInput = {
    category: input.category,
    client: input.client,
    description: input.description,
    estimate: input.storyPoints,
    priority: priorityMap[input.priority ?? "Media"],
    sprint: input.sprint,
    teamId: linearConfig.teamId,
    title: input.name
  };
  console.log("n8n issue create payload", JSON.stringify(linearInput));

  return client.send<
    {
      title: string;
      category?: string;
      client?: string;
      description?: string;
      teamId?: string;
      priority: number;
      sprint?: string;
      estimate?: number;
    },
    { issue?: CreatedLinearIssue; [key: string]: unknown }
  >({
    event: "linear.issue.create",
    payload: linearInput
  });
}

async function createN8nEpic(input: CreateBacklogEpicInput) {
  const config = getN8nConfig();

  if (!config.webhookUrl) {
    return undefined;
  }

  const client = createN8nClient({ secret: config.secret, webhookUrl: config.webhookUrl });

  return client.send<CreateBacklogEpicInput, { epic?: unknown; issues?: CreatedLinearIssue[]; [key: string]: unknown }>({
    event: "backlog.epic.create",
    payload: input
  });
}

async function updateN8nIssue(input: UpdateBacklogIssueInput) {
  const config = getN8nConfig(input);

  if (!config.webhookUrl) {
    return undefined;
  }

  const client = createN8nClient({ secret: config.secret, webhookUrl: config.webhookUrl });
  const cachedIssue = input.title ? createdIssuesByTitle.get(input.title) : undefined;
  const workspaceIssue = await findLinkedWorkspaceIssue(input.title);
  const reference = getLinearIssueReference(input);
  const issueId = reference.id ?? cachedIssue?.id ?? workspaceIssue?.id ?? reference.identifier ?? workspaceIssue?.identifier ?? reference.url ?? workspaceIssue?.url ?? "";
  const updatePayload = {
    id: issueId,
    issueId,
    linearIssueId: issueId,
    title: input.title,
    description: input.description ?? "",
    category: input.category,
    client: input.client,
    linearIdentifier: reference.identifier ?? cachedIssue?.identifier ?? workspaceIssue?.identifier,
    linearUrl: reference.url ?? cachedIssue?.url ?? workspaceIssue?.url,
    priority: priorityMap[input.priority ?? "Media"],
    estimate: input.estimate ?? input.storyPoints,
    storyPoints: input.storyPoints ?? input.estimate,
    owner: input.owner,
    assignee: input.owner,
    sprint: input.sprint,
    linearStateId: input.linearStateId,
    stateId: input.linearStateId,
    statusId: input.linearStateId,
    status: input.status,
    statusName: input.status,
    stateName: input.status,
    state: input.status
  };
  console.log("n8n issue update payload", JSON.stringify(updatePayload));

  return client.send<
    {
      id: string;
      issueId: string;
      linearIssueId: string;
      title: string;
      description?: string;
      category?: string;
      client?: string;
      linearIdentifier?: string;
      linearUrl?: string;
      priority: number;
      estimate?: number;
      storyPoints?: number;
      owner?: string;
      assignee?: string;
      sprint?: string;
      linearStateId?: string;
      stateId?: string;
      statusId?: string;
      status?: string;
      statusName?: string;
      stateName?: string;
      state?: string;
    },
    { issue?: CreatedLinearIssue; success?: boolean; [key: string]: unknown }
  >({
    event: "linear.issue.update",
    payload: updatePayload
  });
}

function getLinkedLinearIssue(input: Pick<UpdateBacklogIssueInput, "linearIdentifier" | "linearIssueId" | "linearUrl" | "title">) {
  const cachedIssue = input.title ? createdIssuesByTitle.get(input.title) : undefined;
  const reference = getLinearIssueReference(input);
  const cachedIssueId = cachedIssue?.id;

  return {
    id: reference.id ?? (isLinearUuid(cachedIssueId) ? cachedIssueId : undefined) ?? "",
    identifier: reference.identifier ?? cachedIssue?.identifier,
    url: reference.url ?? cachedIssue?.url
  };
}

async function updateLinearIssueDirectly(input: UpdateBacklogIssueInput) {
  const config = getLinearConfig(input);
  const issue = getLinkedLinearIssue(input);

  if (!config.apiKey || !issue.id) {
    return undefined;
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const [labelIds, cycleId, assigneeId] = await Promise.all([
    resolveLabelIds(client, [input.category, input.client]),
    resolveCycleId(client, config.teamId ?? "", input.sprint),
    resolveAssigneeId(client, input.owner)
  ]);
  const issueInput = {
    title: input.title,
    description: input.description ?? "",
    priority: priorityMap[input.priority ?? "Media"],
    estimate: input.estimate ?? input.storyPoints,
    stateId: input.linearStateId,
    labelIds,
    cycleId,
    assigneeId
  };
  console.log("linear direct issue update payload", JSON.stringify({ id: issue.id, input: issueInput }));

  const data = await client.request<{ issueUpdate: { success: boolean; issue: CreatedLinearIssue } }>(
    `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `,
    { id: issue.id, input: issueInput }
  );

  return data.issueUpdate;
}

async function archiveN8nIssue(input: ArchiveBacklogIssueInput) {
  const config = getN8nConfig(input);

  if (!config.webhookUrl) {
    return undefined;
  }

  const client = createN8nClient({ secret: config.secret, webhookUrl: config.webhookUrl });
  const cachedIssue = input.title ? createdIssuesByTitle.get(input.title) : undefined;
  const workspaceIssue = await findLinkedWorkspaceIssue(input.title);
  const reference = getLinearIssueReference(input);
  const issueId = reference.id ?? cachedIssue?.id ?? workspaceIssue?.id ?? reference.identifier ?? workspaceIssue?.identifier ?? reference.url ?? workspaceIssue?.url ?? "";
  const archivePayload = {
    id: issueId,
    issueId,
    linearIssueId: issueId,
    title: input.title,
    linearIdentifier: reference.identifier ?? cachedIssue?.identifier ?? workspaceIssue?.identifier,
    linearUrl: reference.url ?? cachedIssue?.url ?? workspaceIssue?.url
  };
  console.log("n8n issue delete payload", JSON.stringify(archivePayload));

  return client.send<
    { id: string; issueId: string; linearIssueId: string; title?: string; linearIdentifier?: string; linearUrl?: string },
    { success?: boolean; [key: string]: unknown }
  >({
    event: "linear.issue.delete",
    payload: archivePayload
  });
}

export async function createBacklogIssue(input: CreateBacklogIssueInput) {
  if (input.linearUrl || input.linearIssueId || input.linearIdentifier) {
    let issue: CreatedLinearIssue | undefined;

    try {
      issue = await findLinkedLinearIssue(input);
      console.log("linear linked issue lookup", JSON.stringify(issue ?? null));
    } catch (error) {
      console.log("linear linked issue lookup failed", error instanceof Error ? error.message : String(error));
    }

    if (issue) {
      createdIssuesByTitle.set(input.name, issue);
    }

    return {
      mode: issue ? "linked-linear" : "linked",
      issue: issue ?? createMockIssue(input)
    };
  }

  if (isN8nConfigured(input)) {
    const result = await createN8nIssue(input);
    console.log("n8n issue create response", JSON.stringify(result));
    let issue = findCreatedIssueRecord(result);

    if (!issue) {
      try {
        issue = await findLinearIssueByTitleWithRetry(input);
        console.log("linear issue lookup after n8n create", JSON.stringify(issue ?? null));
      } catch (error) {
        console.log("linear issue lookup after n8n create failed", error instanceof Error ? error.message : String(error));
      }
    }

    if (issue) {
      createdIssuesByTitle.set(input.name, issue);
    }

    return {
      mode: "n8n",
      ...result,
      issue
    };
  }

  const issue = await createLinearIssue(input);

  return {
    mode: isLinearConfigured() ? "linear" : "mock",
    issue
  };
}

export async function updateBacklogIssue(input: UpdateBacklogIssueInput) {
  if (isN8nConfigured(input)) {
    input = await hydrateIssueLinkFromWorkspace(input);
    input = await hydrateIssueLinkFromLinear(input);
    const linearConfig = getLinearConfig(input);
    const canResolveLinearState = Boolean(linearConfig.apiKey && linearConfig.teamId);
    let linearState: LinearWorkflowState | undefined;

    if (canResolveLinearState) {
      try {
        linearState = await resolveLinearStateByName(input);
      } catch (error) {
        console.log("linear state lookup failed", error instanceof Error ? error.message : String(error));
      }
    }

    if (input.status && canResolveLinearState && !linearState) {
      const message = `Nao ha status no Linear com o nome "${input.status}".`;
      console.log("n8n issue update skipped", message);

      return {
        mode: "n8n",
        success: false,
        statusMatched: false,
        message
      };
    }

    const updateInput = { ...input, linearStateId: linearState?.id };
    let linearUpdate: Awaited<ReturnType<typeof updateLinearIssueDirectly>> | undefined;

    try {
      linearUpdate = await updateLinearIssueDirectly(updateInput);
      console.log("linear direct issue update response", JSON.stringify(linearUpdate ?? null));
    } catch (error) {
      console.log("linear direct issue update failed", error instanceof Error ? error.message : String(error));
    }

    const result = await updateN8nIssue(updateInput);
    console.log("n8n issue update response", JSON.stringify(result));

    return {
      mode: "n8n",
      statusMatched: input.status ? true : undefined,
      linearState,
      linearUpdate,
      ...result
    };
  }

  if (!input.linearIssueId) {
    return { mode: "skipped", success: false };
  }

  return { mode: "mock", success: true };
}

function normalizeLinearStateName(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export async function archiveBacklogIssue(input: ArchiveBacklogIssueInput) {
  if (isN8nConfigured(input)) {
    input = await hydrateIssueLinkFromWorkspace(input);
    const result = await archiveN8nIssue(input);
    console.log("n8n issue delete response", JSON.stringify(result));

    return {
      mode: "n8n",
      ...result
    };
  }

  if (!input.linearIssueId) {
    return { mode: "skipped", success: false };
  }

  return { mode: "mock", success: true };
}

async function hydrateIssueLinkFromWorkspace<TInput extends {
  title?: string;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
}>(input: TInput) {
  if (input.linearIssueId || input.linearIdentifier || input.linearUrl) {
    return input;
  }

  const issue = await findLinkedWorkspaceIssue(input.title);

  return issue
    ? {
        ...input,
        linearIssueId: issue.id,
        linearIdentifier: issue.identifier,
        linearUrl: issue.url
      }
    : input;
}

async function hydrateIssueLinkFromLinear(input: UpdateBacklogIssueInput): Promise<UpdateBacklogIssueInput> {
  const reference = getLinearIssueReference(input);

  if (reference.id || (!reference.identifier && !reference.url)) {
    return {
      ...input,
      linearIssueId: reference.id ?? input.linearIssueId,
      linearIdentifier: reference.identifier ?? input.linearIdentifier,
      linearUrl: reference.url ?? input.linearUrl
    };
  }

  try {
    const issue = await findLinkedLinearIssue({
      name: input.title,
      description: input.description,
      sprint: input.sprint,
      category: input.category,
      client: input.client,
      owner: input.owner,
      priority: input.priority,
      storyPoints: input.storyPoints ?? input.estimate,
      linearIdentifier: reference.identifier,
      linearIssueId: reference.id,
      linearUrl: reference.url,
      integrationSettings: input.integrationSettings
    });

    return issue
      ? {
          ...input,
          linearIssueId: issue.id,
          linearIdentifier: issue.identifier,
          linearUrl: issue.url
        }
      : {
          ...input,
          linearIdentifier: reference.identifier ?? input.linearIdentifier,
          linearUrl: reference.url ?? input.linearUrl
        };
  } catch (error) {
    console.log("linear issue link hydration failed", error instanceof Error ? error.message : String(error));
    return {
      ...input,
      linearIdentifier: reference.identifier ?? input.linearIdentifier,
      linearUrl: reference.url ?? input.linearUrl
    };
  }
}

async function findLinkedWorkspaceIssue(title?: string): Promise<CreatedLinearIssue | undefined> {
  if (!title?.trim()) {
    return undefined;
  }

  const normalizedTitle = title.trim().toLowerCase();
  const snapshot = await getWorkspaceState() as {
    backlogConfig?: Array<{ entries?: unknown[] }>;
    boardConfig?: Array<{ cards?: unknown[] }>;
  };
  const candidates = [
    ...(snapshot.backlogConfig ?? []).flatMap((column) => column.entries ?? []),
    ...(snapshot.boardConfig ?? []).flatMap((column) => column.cards ?? [])
  ];

  for (const candidate of candidates) {
    const issue = getWorkspaceIssueRecord(candidate);

    if (issue && issue.title.trim().toLowerCase() === normalizedTitle) {
      return issue;
    }
  }

  return undefined;
}

function getWorkspaceIssueRecord(value: unknown): CreatedLinearIssue | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const title = getStringValue(record.name) ?? getStringValue(record.title);
  const reference = getLinearIssueReference({
    linearIssueId: getStringValue(record.linearIssueId),
    linearIdentifier: getStringValue(record.linearIdentifier),
    linearUrl: getStringValue(record.linearUrl)
  });
  const id = reference.id;
  const identifier = reference.identifier;
  const url = reference.url;

  if (title && (id || identifier || url)) {
    return {
      id: id ?? identifier ?? url ?? "",
      identifier: identifier ?? id ?? "",
      title,
      url: url ?? ""
    };
  }

  if (Array.isArray(record.items)) {
    for (const item of record.items) {
      const issue = getWorkspaceIssueRecord(item);

      if (issue) {
        return issue;
      }
    }
  }

  return undefined;
}

export async function createBacklogEpic(input: CreateBacklogEpicInput) {
  if (isN8nConfigured()) {
    const result = await createN8nEpic(input);

    return {
      mode: "n8n",
      ...result
    };
  }

  const issues = await Promise.all(
    input.items.map((item) =>
      createLinearIssue(
        {
          ...item,
          description: [item.description, input.objective].filter(Boolean).join("\n\n")
        },
        input.name
      )
    )
  );

  const [anchorIssue, ...relatedIssues] = issues;
  const relations = anchorIssue
    ? await Promise.all(relatedIssues.map((issue) => createIssueRelation(anchorIssue.id, issue.id)))
    : [];

  return {
    mode: isLinearConfigured() ? "linear" : "mock",
    epic: {
      name: input.name,
      objective: input.objective,
      relationType: getLinearConfig().relationType,
      anchorIssue,
      issues,
      relations
    }
  };
}
