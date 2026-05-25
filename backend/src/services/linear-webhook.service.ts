import { getIntegrationSettings } from "./integration-settings.service.js";
import { getWorkspaceState, saveWorkspaceState } from "./workspace-state.service.js";
import type { Prisma } from "../generated/prisma/client.js";

type Priority = "Sem prioridade" | "Urgente" | "Alta" | "Media" | "Baixa";
type BoardColor = "blue" | "purple" | "orange" | "red" | "green" | "pink" | "cyan" | "teal" | "indigo" | "slate";
type BoardIcon = "columns" | "dot" | "lock" | "list" | "rocket" | "shield";

interface BacklogItem {
  order: number;
  name: string;
  sprint: string;
  category: string;
  priority: Priority;
  createdAt: string;
  description?: string;
  owner?: string;
  storyPoints?: number;
  estimate?: string;
  client?: string;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
}

interface BoardCard {
  id: string;
  title: string;
  priority: Priority;
  owner: string;
  points: number;
  description?: string;
  estimate?: string;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
  createdAt?: string;
  createdBy?: string;
  done?: boolean;
}

interface BacklogColumn {
  title: string;
  description?: string;
  addToSprint?: boolean;
  color: BoardColor;
  icon: BoardIcon;
  fields: Array<{ id: string; name: string; type: string; required: boolean }>;
  entries: BacklogItem[];
  connections?: unknown[];
}

interface BoardColumn {
  title: string;
  description?: string;
  color: BoardColor;
  icon: BoardIcon;
  fields: Array<{ id: string; name: string; type: string; required: boolean }>;
  cards: BoardCard[];
  connections?: unknown[];
}

interface WorkspaceStateSnapshot {
  backlogConfig?: BacklogColumn[];
  boardConfig?: BoardColumn[];
  [key: string]: unknown;
}

type HydratedWorkspaceStateSnapshot = WorkspaceStateSnapshot & {
  backlogConfig: BacklogColumn[];
  boardConfig: BoardColumn[];
};

interface NormalizedLinearIssue {
  action: "create" | "update" | "delete";
  id?: string;
  identifier?: string;
  title: string;
  description?: string;
  priority: Priority;
  estimate?: number;
  assignee?: string;
  state?: string;
  url?: string;
  sprint?: string;
  category?: string;
  client?: string;
}

const defaultBoardFields = [
  { id: "field-title", name: "Titulo", type: "Texto curto", required: true },
  { id: "field-owner", name: "Responsavel", type: "Pessoa", required: true },
  { id: "field-points", name: "Story points", type: "Numero", required: false }
];

const defaultBacklogColumns: BacklogColumn[] = [
  {
    title: "Intake",
    description: "Entrada inicial das demandas recebidas pelo produto.",
    color: "blue",
    icon: "columns",
    fields: [
      { id: "backlog-field-title", name: "Titulo", type: "Texto curto", required: true },
      { id: "backlog-field-source", name: "Via de entrada", type: "Lista", required: true }
    ],
    entries: [],
    connections: []
  },
  {
    title: "Discovery",
    description: "Demandas em descoberta, refinamento de problema e coleta de evidencias.",
    color: "purple",
    icon: "dot",
    fields: [
      { id: "backlog-field-problem", name: "Problema", type: "Texto longo", required: true },
      { id: "backlog-field-evidence", name: "Evidencias", type: "Texto longo", required: false }
    ],
    entries: [],
    connections: []
  },
  {
    title: "Planning",
    description: "Demandas em planejamento, estimativa e organizacao para execucao.",
    color: "orange",
    icon: "list",
    fields: [
      { id: "backlog-field-effort", name: "Esforco estimado", type: "Numero", required: true },
      { id: "backlog-field-owner", name: "Responsavel", type: "Pessoa", required: true }
    ],
    entries: [],
    connections: []
  },
  {
    title: "Ready of Done",
    description: "Demandas prontas para seguir ao fluxo de delivery.",
    addToSprint: true,
    color: "green",
    icon: "shield",
    fields: [
      { id: "backlog-field-criteria", name: "Criterios de aceite", type: "Texto longo", required: true },
      { id: "backlog-field-ready", name: "Pronto para delivery?", type: "Sim/Nao", required: true }
    ],
    entries: [],
    connections: []
  }
];

const defaultBoardColumns: BoardColumn[] = [
  { title: "Em andamento", description: "Itens que ja foram priorizados e estao em execucao pela equipe.", color: "blue", icon: "columns", fields: defaultBoardFields, cards: [] },
  { title: "Bloqueado", description: "Itens impedidos por dependencia, decisao externa ou pendencia tecnica.", color: "red", icon: "lock", fields: defaultBoardFields, cards: [] },
  { title: "Code Review - HOM", description: "Itens aguardando revisao de codigo antes da homologacao.", color: "purple", icon: "list", fields: defaultBoardFields, cards: [] },
  { title: "Em teste", description: "Itens em validacao funcional ou tecnica antes de seguir para producao.", color: "orange", icon: "dot", fields: defaultBoardFields, cards: [] },
  { title: "Code Review - PROD", description: "Itens revisados para liberacao final em producao.", color: "blue", icon: "shield", fields: defaultBoardFields, cards: [] },
  { title: "Aprovado", description: "Itens aprovados e prontos para encerramento.", color: "green", icon: "rocket", fields: defaultBoardFields, cards: [] }
];

export function isLinearWebhookAuthorized(headers: Record<string, string | string[] | undefined>) {
  const expectedSecret = getIntegrationSettings().linearWebhookSecret || process.env.N8N_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return true;
  }

  return headers["x-toolz-secret"] === expectedSecret || headers["x-linear-signature"] === expectedSecret;
}

export async function applyLinearWebhookEvent(body: unknown) {
  const issue = normalizeLinearIssue(body);
  const currentState = ((await getWorkspaceState()) ?? {}) as WorkspaceStateSnapshot;
  const snapshot = ensureWorkspaceCollections(currentState);

  const result = applyIssueToSnapshot(snapshot, issue);
  await saveWorkspaceState(snapshot as Prisma.InputJsonObject);

  return {
    ...result,
    issue: {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      state: issue.state
    }
  };
}

function ensureWorkspaceCollections(snapshot: WorkspaceStateSnapshot): HydratedWorkspaceStateSnapshot {
  if (!Array.isArray(snapshot.backlogConfig)) {
    snapshot.backlogConfig = clone(defaultBacklogColumns);
  }

  if (!Array.isArray(snapshot.boardConfig)) {
    snapshot.boardConfig = clone(defaultBoardColumns);
  }

  return snapshot as HydratedWorkspaceStateSnapshot;
}

function applyIssueToSnapshot(snapshot: HydratedWorkspaceStateSnapshot, issue: NormalizedLinearIssue) {
  const existing = removeIssueFromSnapshot(snapshot, issue);

  if (issue.action === "delete") {
    return { received: true, action: issue.action, changed: Boolean(existing), location: null };
  }

  if (issue.action === "update" && !existing) {
    return { received: true, action: issue.action, changed: false, skipped: true, reason: "Issue not linked in workspace.", location: null };
  }

  const boardColumnIndex = findColumnIndex(snapshot.boardConfig, issue.state);
  const backlogColumnIndex = findColumnIndex(snapshot.backlogConfig, issue.state);

  if (boardColumnIndex >= 0) {
    snapshot.boardConfig[boardColumnIndex].cards.push(toBoardCard(issue, existing?.boardCard));
    return { received: true, action: issue.action, changed: true, location: { screen: "board", column: snapshot.boardConfig[boardColumnIndex].title } };
  }

  const targetBacklogColumnIndex = backlogColumnIndex >= 0 ? backlogColumnIndex : 0;
  snapshot.backlogConfig[targetBacklogColumnIndex].entries.push(toBacklogItem(issue, snapshot, existing?.backlogItem));

  return { received: true, action: issue.action, changed: true, location: { screen: "backlog", column: snapshot.backlogConfig[targetBacklogColumnIndex].title } };
}

function removeIssueFromSnapshot(snapshot: HydratedWorkspaceStateSnapshot, issue: NormalizedLinearIssue) {
  let backlogItem: BacklogItem | undefined;
  let boardCard: BoardCard | undefined;

  snapshot.backlogConfig = snapshot.backlogConfig.map((column) => ({
    ...column,
    entries: column.entries.filter((entry) => {
      if (matchesIssue(entry, issue)) {
        backlogItem = entry;
        return false;
      }

      return true;
    })
  }));

  snapshot.boardConfig = snapshot.boardConfig.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => {
      if (matchesIssue(card, issue)) {
        boardCard = card;
        return false;
      }

      return true;
    })
  }));

  return backlogItem || boardCard ? { backlogItem, boardCard } : null;
}

function toBacklogItem(issue: NormalizedLinearIssue, snapshot: HydratedWorkspaceStateSnapshot, existing?: BacklogItem): BacklogItem {
  return {
    order: existing?.order ?? getNextBacklogOrder(snapshot),
    name: issue.title,
    sprint: issue.sprint ?? existing?.sprint ?? "",
    category: issue.category ?? existing?.category ?? "",
    priority: issue.priority,
    createdAt: existing?.createdAt ?? new Date().toLocaleDateString("pt-BR"),
    description: issue.description ?? existing?.description,
    owner: issue.assignee ?? existing?.owner,
    storyPoints: issue.estimate ?? existing?.storyPoints,
    client: issue.client ?? existing?.client,
    linearIdentifier: issue.identifier ?? existing?.linearIdentifier,
    linearIssueId: issue.id ?? existing?.linearIssueId,
    linearUrl: issue.url ?? existing?.linearUrl
  };
}

function toBoardCard(issue: NormalizedLinearIssue, existing?: BoardCard): BoardCard {
  return {
    id: existing?.id ?? `#${issue.identifier ?? issue.id ?? Date.now()}`,
    title: issue.title,
    priority: issue.priority,
    owner: issue.assignee ?? existing?.owner ?? "",
    points: issue.estimate ?? existing?.points ?? 0,
    description: issue.description ?? existing?.description,
    linearIdentifier: issue.identifier ?? existing?.linearIdentifier,
    linearIssueId: issue.id ?? existing?.linearIssueId,
    linearUrl: issue.url ?? existing?.linearUrl,
    createdAt: existing?.createdAt ?? new Date().toLocaleDateString("pt-BR"),
    createdBy: existing?.createdBy ?? "Linear",
    done: issue.state?.toLowerCase().includes("aprovado") || existing?.done
  };
}

function normalizeLinearIssue(body: unknown): NormalizedLinearIssue {
  const record = getWebhookRecord(body);
  const payload = asRecord(record.payload) ?? record;
  const issue = asRecord(payload.issue) ?? asRecord(payload.data) ?? asRecord(payload.node) ?? payload;
  const action = normalizeAction(stringValue(payload.action) ?? stringValue(record.action) ?? stringValue(record.event) ?? stringValue(payload.type));
  const state = asRecord(issue.state);
  const assignee = asRecord(issue.assignee);
  const cycle = asRecord(issue.cycle);
  const team = asRecord(issue.team);

  return {
    action,
    id: stringValue(issue.id) ?? stringValue(payload.id) ?? stringValue(payload.issueId) ?? stringValue(payload.linearIssueId),
    identifier: stringValue(issue.identifier) ?? stringValue(payload.identifier) ?? stringValue(payload.linearIdentifier),
    title: stringValue(issue.title) ?? stringValue(payload.title) ?? stringValue(payload.name) ?? getTitleFromNumber(payload) ?? "Issue sem titulo",
    description: stringValue(issue.description) ?? stringValue(payload.description),
    priority: normalizePriority(issue.priority ?? payload.priority ?? payload.priorityLabel),
    estimate: numberValue(issue.estimate) ?? numberValue(payload.estimate) ?? numberValue(payload.storyPoints),
    assignee: stringValue(assignee?.displayName) ?? stringValue(assignee?.name) ?? stringValue(payload.assigneeName) ?? stringValue(payload.assignee) ?? stringValue(payload.owner),
    state: stringValue(state?.name) ?? stringValue(payload.stateName) ?? stringValue(payload.state) ?? stringValue(payload.status),
    url: stringValue(issue.url) ?? stringValue(payload.url) ?? stringValue(payload.linearUrl),
    sprint: stringValue(cycle?.name) ?? stringValue(payload.sprint),
    category: firstLabelName(issue) ?? stringValue(team?.name) ?? stringValue(payload.category),
    client: stringValue(payload.client)
  };
}

function getWebhookRecord(body: unknown): Record<string, unknown> {
  if (Array.isArray(body)) {
    return asRecord(body[0]) ?? {};
  }

  return asRecord(body) ?? {};
}

function normalizeAction(value?: string): NormalizedLinearIssue["action"] {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("remove") || normalized.includes("delete") || normalized.includes("archive")) {
    return "delete";
  }

  if (normalized.includes("create")) {
    return "create";
  }

  return "update";
}

function normalizePriority(value: unknown): Priority {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();

    if (normalized.includes("alta") || normalized.includes("high") || normalized === "1" || normalized === "2") {
      if (normalized === "1" || normalized.includes("urgent")) {
        return "Urgente";
      }

      return "Alta";
    }

    if (normalized.includes("sem prioridade") || normalized.includes("no priority") || normalized === "0") {
      return "Sem prioridade";
    }

    if (normalized.includes("baixa") || normalized.includes("low") || normalized === "4") {
      return "Baixa";
    }
  }

  if (value === 0) {
    return "Sem prioridade";
  }

  if (value === 1) {
    return "Urgente";
  }

  if (value === 2) {
    return "Alta";
  }

  if (value === 4) {
    return "Baixa";
  }

  return "Media";
}

function getTitleFromNumber(payload: Record<string, unknown>) {
  const number = stringValue(payload.number);

  return number ? `#${number}` : undefined;
}

function findColumnIndex<TColumn extends { title: string }>(columns: TColumn[], title?: string) {
  if (!title) {
    return -1;
  }

  const normalizedTitle = normalizeColumnTitle(title);
  return columns.findIndex((column) => normalizeColumnTitle(column.title) === normalizedTitle);
}

function matchesIssue(item: Pick<BacklogItem, "linearIssueId" | "linearIdentifier" | "linearUrl" | "name"> | Pick<BoardCard, "linearIssueId" | "linearIdentifier" | "linearUrl" | "title">, issue: NormalizedLinearIssue) {
  const title = "name" in item ? item.name : item.title;
  const itemHasLinearLink = Boolean(item.linearIssueId || item.linearIdentifier || item.linearUrl);

  return Boolean(
    (issue.id && item.linearIssueId === issue.id) ||
    (issue.identifier && item.linearIssueId === issue.identifier) ||
    (issue.url && item.linearIssueId === issue.url) ||
    (issue.id && item.linearIdentifier === issue.id) ||
    (issue.identifier && item.linearIdentifier === issue.identifier) ||
    (issue.url && item.linearUrl === issue.url) ||
    (!itemHasLinearLink && title.trim().toLowerCase() === issue.title.trim().toLowerCase()) ||
    (!issue.id && !issue.identifier && !issue.url && title === issue.title)
  );
}

function normalizeColumnTitle(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getNextBacklogOrder(snapshot: HydratedWorkspaceStateSnapshot) {
  return snapshot.backlogConfig.reduce((highestOrder, column) => (
    Math.max(highestOrder, ...column.entries.map((entry) => entry.order ?? 0))
  ), 0) + 1;
}

function firstLabelName(issue: Record<string, unknown>) {
  const labels = issue.labels;
  const nodes = Array.isArray(labels) ? labels : asRecord(labels)?.nodes;

  if (!Array.isArray(nodes)) {
    return undefined;
  }

  return stringValue(asRecord(nodes[0])?.name);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
