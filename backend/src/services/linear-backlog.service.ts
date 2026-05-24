import { createLinearClient } from "../integrations/linear/linear.client.js";
import { createN8nClient } from "../integrations/n8n/n8n.client.js";
import { getIntegrationSettings } from "./integration-settings.service.js";
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
    const identifier = input.linearIdentifier ?? input.linearIssueId ?? input.linearUrl ?? `LINK-${randomUUID().slice(0, 8).toUpperCase()}`;

    return {
      id: input.linearIssueId ?? identifier,
      identifier,
      title: input.name,
      url: input.linearUrl ?? `https://linear.app/linked/${identifier}`
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
  const issue = record.issue;

  if (issue && typeof issue === "object") {
    const issueRecord = issue as Record<string, unknown>;

    if (typeof issueRecord.id === "string") {
      return {
        id: issueRecord.id,
        identifier: typeof issueRecord.identifier === "string" ? issueRecord.identifier : issueRecord.id,
        title: typeof issueRecord.title === "string" ? issueRecord.title : "",
        url: typeof issueRecord.url === "string" ? issueRecord.url : ""
      };
    }
  }

  if (typeof record.id === "string") {
    return {
      id: record.id,
      identifier: typeof record.identifier === "string" ? record.identifier : record.id,
      title: typeof record.title === "string" ? record.title : "",
      url: typeof record.url === "string" ? record.url : ""
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

  return data.team.cycles.nodes.find((cycle) => cycle.name.toLowerCase() === sprint.toLowerCase())?.id;
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
  const normalizedStatus = input.status.trim().toLowerCase();

  return data.team.states.nodes.find((state) => state.name.trim().toLowerCase() === normalizedStatus);
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
    description: input.description,
    estimate: input.storyPoints,
    priority: priorityMap[input.priority ?? "Media"],
    teamId: linearConfig.teamId,
    title: input.name
  };
  console.log("n8n issue create payload", JSON.stringify(linearInput));

  return client.send<
    {
      title: string;
      description?: string;
      teamId?: string;
      priority: number;
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
  const issueId = input.linearIssueId ?? cachedIssue?.id ?? input.linearIdentifier ?? input.linearUrl ?? "";
  const updatePayload = {
    id: issueId,
    issueId,
    linearIssueId: issueId,
    title: input.title,
    description: input.description ?? "",
    linearIdentifier: input.linearIdentifier ?? cachedIssue?.identifier,
    linearUrl: input.linearUrl ?? cachedIssue?.url,
    priority: priorityMap[input.priority ?? "Media"],
    estimate: input.estimate,
    owner: input.owner,
    assignee: input.owner,
    linearStateId: input.linearStateId,
    stateId: input.linearStateId,
    statusId: input.linearStateId,
    status: input.status,
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
      linearIdentifier?: string;
      linearUrl?: string;
      priority: number;
      estimate?: number;
      owner?: string;
      assignee?: string;
      linearStateId?: string;
      stateId?: string;
      statusId?: string;
      status?: string;
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

  return {
    id: input.linearIssueId ?? cachedIssue?.id ?? input.linearIdentifier ?? input.linearUrl ?? "",
    identifier: input.linearIdentifier ?? cachedIssue?.identifier,
    url: input.linearUrl ?? cachedIssue?.url
  };
}

async function updateLinearIssueDirectly(input: UpdateBacklogIssueInput) {
  const config = getLinearConfig(input);
  const issue = getLinkedLinearIssue(input);

  if (!config.apiKey || !issue.id) {
    return undefined;
  }

  const client = createLinearClient({ apiKey: config.apiKey });
  const issueInput = {
    title: input.title,
    description: input.description ?? "",
    priority: priorityMap[input.priority ?? "Media"],
    estimate: input.estimate,
    stateId: input.linearStateId
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
  const issueId = input.linearIssueId ?? cachedIssue?.id ?? input.linearIdentifier ?? input.linearUrl ?? "";
  const archivePayload = {
    id: issueId,
    issueId,
    linearIssueId: issueId,
    title: input.title,
    linearIdentifier: input.linearIdentifier ?? cachedIssue?.identifier,
    linearUrl: input.linearUrl ?? cachedIssue?.url
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
    return {
      mode: "linked",
      issue: createMockIssue(input)
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
    let linearState: LinearWorkflowState | undefined;

    try {
      linearState = await resolveLinearStateByName(input);
    } catch (error) {
      console.log("linear state lookup failed", error instanceof Error ? error.message : String(error));
    }

    if (input.status && !linearState) {
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

export async function archiveBacklogIssue(input: ArchiveBacklogIssueInput) {
  if (isN8nConfigured(input)) {
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
