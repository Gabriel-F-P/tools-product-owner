import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode, SyntheticEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Code2,
  Columns3,
  ClipboardList,
  MessageCircle,
  ExternalLink,
  FileSpreadsheet,
  FlaskConical,
  GitBranch,
  Hand,
  KanbanSquare,
  LayoutDashboard,
  LayoutGrid,
  ListFilter,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  Moon,
  PanelTop,
  PanelLeft,
  Play,
  Plus,
  RefreshCcw,
  Rocket,
  Search,
  Save,
  Settings,
  ShieldCheck,
  SquareKanban,
  Square,
  Sun,
  Table2,
  Trash2,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData, Metric, Status } from "./types/dashboard";
import type { BacklogEntry, BacklogEpic, BacklogItem, BacklogPriority } from "./types/backlog";
import { applyCreatedIssueLink, archiveIssue, createEpic, createIssue, toCreateEpicPayload, updateIssue } from "./services/backlog";
import type { UpdateIssueResult } from "./services/backlog";
import { apiUrl } from "./services/api";
import { getDashboard } from "./services/dashboard";
import { mockDashboard } from "./services/mockDashboard";

type Page = "dashboard" | "backlog" | "board" | "sprints" | "clients" | "reports" | "ceremonies" | "apis" | "permissions";
type Theme = "light" | "dark";
type ViewMode = "card" | "list";
type UserPermission = "Membro" | "Admin";
type LinearCreateAction = "none" | "link" | "create";
type BoardTabColor = "blue" | "purple" | "orange" | "red" | "green" | "pink" | "cyan" | "teal" | "indigo" | "slate";
type BoardTabIcon = "columns" | "dot" | "lock" | "list" | "rocket" | "shield";
type BoardFieldType = "Texto curto" | "Texto longo" | "Numero" | "Data" | "Lista" | "Sim/Nao" | "Pessoa";
const linearEstimateOptions = [1, 2, 3, 5, 8] as const;
const priorityOptions: Priority[] = ["Sem prioridade", "Urgente", "Alta", "Media", "Baixa"];
type WorkspaceStateSnapshot = Partial<{
  activeProductId: string;
  backlogConfig: BacklogColumn[];
  boardConfig: BoardColumn[];
  categoryConfig: CategoryConfig[];
  clientConfig: ClientAccount[];
  dailyConfig: DailyRecord[];
  initialVisibleTabs: number;
  planningConfig: PlanningRecord[];
  products: ProductAccess[];
  retroConfig: Retrospective[];
  sprintConfig: SprintPlan[];
  sprintStatusConfig: SprintStatus[];
}>;
type WorkspaceStateResponse = {
  data?: WorkspaceStateSnapshot | null;
  updatedAt?: string | null;
};
type CreateItemInput = {
  item: Omit<BacklogItem, "order" | "createdAt">;
  linearAction: LinearCreateAction;
};

const workspaceStateStorageKey = "toolz-workspace-state-v2";
const authSessionStorageKey = "toolz-auth-session";

interface BoardTabField {
  id: string;
  name: string;
  type: BoardFieldType;
  required: boolean;
}

interface TaskFieldValue {
  id: string;
  label: string;
  value: string;
  type?: BoardFieldType;
}

interface DeliveryEntry {
  tabTitle: string;
  tabIndex: number;
  movedBy: string;
  movedAt: string;
  fields: TaskFieldValue[];
}

interface CategoryConfig {
  id: string;
  name: string;
  color: BoardTabColor;
}

interface ClientAccount {
  id: string;
  name: string;
  hasSquad: boolean;
  squadHours: number;
}

interface ProductAccess {
  id: string;
  name: string;
  members: ProductMember[];
}

interface ProductMember {
  id: string;
  name: string;
  email: string;
  permission: UserPermission;
}

interface RetroColumn {
  id: string;
  title: string;
  color?: BoardTabColor;
  cards: string[];
}

interface Retrospective {
  id: string;
  title: string;
  isOpen: boolean;
  columns: RetroColumn[];
}

interface PlanningRecord {
  id: string;
  title: string;
  sprintId: string;
  sprintName: string;
  start: string;
  end: string;
  objective: string;
  createdAt: string;
  items: BacklogItem[];
}

interface DailyRecord {
  id: string;
  title: string;
  date: string;
  sprintId: string;
  sprintName: string;
  displayMode: "membro" | "tarefas";
  createdAt: string;
  cards: BoardCard[];
  columns: Array<{ title: string; color: BoardTabColor; cards: BoardCard[] }>;
}

const boardColorOptions = [
  { value: "blue", label: "Azul" },
  { value: "purple", label: "Roxo" },
  { value: "orange", label: "Laranja" },
  { value: "red", label: "Vermelho" },
  { value: "green", label: "Verde" },
  { value: "pink", label: "Rosa" },
  { value: "cyan", label: "Ciano" },
  { value: "teal", label: "Turquesa" },
  { value: "indigo", label: "Indigo" },
  { value: "slate", label: "Grafite" }
] satisfies Array<{ value: BoardTabColor; label: string }>;

const boardIconOptions = [
  { value: "columns", label: "Colunas", icon: Columns3 },
  { value: "dot", label: "Status", icon: CircleDot },
  { value: "lock", label: "Bloqueio", icon: LockKeyhole },
  { value: "list", label: "Checklist", icon: ClipboardList },
  { value: "rocket", label: "Entrega", icon: Rocket },
  { value: "shield", label: "Aprovacao", icon: ShieldCheck }
] satisfies Array<{ value: BoardTabIcon; label: string; icon: typeof Columns3 }>;

const boardFieldTypes: BoardFieldType[] = ["Texto curto", "Texto longo", "Numero", "Data", "Lista", "Sim/Nao", "Pessoa"];

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "backlog", label: "Backlog", icon: Table2 },
  { id: "board", label: "Board", icon: PanelTop },
  { id: "sprints", label: "Sprints", icon: KanbanSquare },
  { id: "clients", label: "Clientes", icon: Building2 },
  { id: "reports", label: "Relatorios", icon: BarChart3 },
  { id: "ceremonies", label: "Cerimonias", icon: SquareKanban },
  { id: "apis", label: "API's", icon: GitBranch }
] satisfies Array<{ id: Page; label: string; icon: typeof LayoutDashboard }>;

const defaultProducts = [
  {
    id: "product-lxp",
    name: "LXP",
    members: [
      { id: "member-gabriel", name: "Gabriel Fonseca", email: "gabriel.fonseca@toolzz.me", permission: "Admin" }
    ]
  }
] satisfies ProductAccess[];

const localUsers = [
  { email: "gabriel.fonseca@toolzz.me", password: "Gabr1el=12" }
];

interface SessionContextValue {
  activeProduct: ProductAccess;
  activeProductId: string;
  currentMember?: ProductMember;
  currentPermission: UserPermission;
  isAdmin: boolean;
  products: ProductAccess[];
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  onProductsChange: (products: ProductAccess[]) => void;
  onProductChange: (productId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("SessionContext indisponivel");
  }
  return session;
}

const statusConfig: Record<Status, { label: string; icon: typeof Code2; className: string }> = {
  development: { label: "Em desenvolvimento", icon: Code2, className: "development" },
  testing: { label: "Em teste", icon: FlaskConical, className: "testing" },
  done: { label: "Concluido", icon: Check, className: "done" }
};

const backlogItems = [
  {
    order: 1,
    name: "Aluno nao conseguindo concluir prova",
    sprint: "Sprint 12",
    category: "SLA",
    priority: "Alta",
    createdAt: "23/04/2026"
  },
  {
    order: 2,
    name: "Falha ao enviar e-mail de recuperacao de senha",
    sprint: "Sprint 12",
    category: "Squad",
    priority: "Media",
    createdAt: "22/04/2026"
  },
  {
    order: 3,
    name: "Relatorio de acessos nao carrega",
    sprint: "Sprint 13",
    category: "Seguranca",
    priority: "Alta",
    createdAt: "21/04/2026"
  },
  {
    order: 4,
    name: "Ajuste no tempo de expiracao da sessao",
    sprint: "Sprint 13",
    category: "Infraestrutura",
    priority: "Media",
    createdAt: "20/04/2026"
  },
  {
    order: 5,
    name: "Melhorias na performance do dashboard",
    sprint: "Sprint 14",
    category: "Melhoria",
    priority: "Baixa",
    createdAt: "19/04/2026"
  },
  {
    order: 6,
    name: "Revisao do fluxo de onboarding",
    sprint: "Sprint 14",
    category: "Melhoria",
    priority: "Media",
    createdAt: "18/04/2026"
  },
  {
    order: 7,
    name: "Criar alerta para falha de pagamento",
    sprint: "Sprint 14",
    category: "SLA",
    priority: "Alta",
    createdAt: "17/04/2026"
  },
  {
    order: 8,
    name: "Separar permissoes por perfil de usuario",
    sprint: "Sprint 15",
    category: "Seguranca",
    priority: "Alta",
    createdAt: "16/04/2026"
  },
  {
    order: 9,
    name: "Ajustar deploy do servico de notificacoes",
    sprint: "Sprint 15",
    category: "Infraestrutura",
    priority: "Media",
    createdAt: "15/04/2026"
  },
  {
    order: 10,
    name: "Adicionar filtro por status no relatorio",
    sprint: "Sprint 15",
    category: "Melhoria",
    priority: "Baixa",
    createdAt: "14/04/2026"
  },
  {
    order: 11,
    name: "Mapear squads responsaveis por modulo",
    sprint: "Sprint 15",
    category: "Squad",
    priority: "Media",
    createdAt: "13/04/2026"
  },
  {
    order: 12,
    name: "Corrigir timeout ao carregar anexos",
    sprint: "Sprint 16",
    category: "Infraestrutura",
    priority: "Alta",
    createdAt: "12/04/2026"
  },
  {
    order: 13,
    name: "Padronizar mensagens de erro no checkout",
    sprint: "Sprint 16",
    category: "SLA",
    priority: "Media",
    createdAt: "11/04/2026"
  },
  {
    order: 14,
    name: "Auditar alteracoes de dados sensiveis",
    sprint: "Sprint 16",
    category: "Seguranca",
    priority: "Alta",
    createdAt: "10/04/2026"
  },
  {
    order: 15,
    name: "Melhorar busca por aluno no painel",
    sprint: "Sprint 16",
    category: "Melhoria",
    priority: "Baixa",
    createdAt: "09/04/2026"
  },
  {
    order: 16,
    name: "Definir squad para integracao financeira",
    sprint: "Sprint 17",
    category: "Squad",
    priority: "Media",
    createdAt: "08/04/2026"
  },
  {
    order: 17,
    name: "Criar fallback para indisponibilidade externa",
    sprint: "Sprint 17",
    category: "Infraestrutura",
    priority: "Alta",
    createdAt: "07/04/2026"
  },
  {
    order: 18,
    name: "Ajustar SLA de atendimento para chamados VIP",
    sprint: "Sprint 17",
    category: "SLA",
    priority: "Alta",
    createdAt: "06/04/2026"
  },
  {
    order: 19,
    name: "Reorganizar cards por ownership",
    sprint: "Sprint 17",
    category: "Squad",
    priority: "Baixa",
    createdAt: "05/04/2026"
  },
  {
    order: 20,
    name: "Adicionar confirmacao antes de excluir item",
    sprint: "Sprint 18",
    category: "Seguranca",
    priority: "Media",
    createdAt: "04/04/2026"
  }
];

const defaultBacklogCategories = [
  { id: "category-sla", name: "SLA", color: "blue" },
  { id: "category-squad", name: "Squad", color: "orange" },
  { id: "category-security", name: "Seguranca", color: "pink" },
  { id: "category-infra", name: "Infraestrutura", color: "red" },
  { id: "category-improvement", name: "Melhoria", color: "green" }
] satisfies CategoryConfig[];

const sprintCalendar = [
  { sprint: "Sprint 12", start: "13/05/2024", end: "26/05/2024" },
  { sprint: "Sprint 13", start: "27/05/2024", end: "09/06/2024" },
  { sprint: "Sprint 14", start: "10/06/2024", end: "23/06/2024" },
  { sprint: "Sprint 15", start: "24/06/2024", end: "07/07/2024" },
  { sprint: "Sprint 16", start: "08/07/2024", end: "21/07/2024" },
  { sprint: "Sprint 17", start: "22/07/2024", end: "04/08/2024" },
  { sprint: "Sprint 18", start: "05/08/2024", end: "18/08/2024" }
];

const currentSprint = "Sprint 17";
const categoryHourRates: Record<string, number> = {
  SLA: 4,
  Squad: 5,
  Seguranca: 6,
  Infraestrutura: 6,
  Melhoria: 5,
  Bug: 4
};

const fieldMappings = [
  "Tipo de Melhoria",
  "Via de Entrada",
  "Existem Cards Relacionados?",
  "Link Notion",
  "Issue ID (Github)",
  "Cliente VIP?",
  "Cliente com Squad?"
];

type Priority = BacklogPriority;

const defaultBoardFields: BoardTabField[] = [
  { id: "field-title", name: "Titulo", type: "Texto curto", required: true },
  { id: "field-owner", name: "Responsavel", type: "Pessoa", required: true },
  { id: "field-points", name: "Story points", type: "Numero", required: false }
];

interface BoardCard {
  id: string;
  title: string;
  priority: Priority;
  owner: string;
  assistants?: string[];
  points: number;
  sprint?: string;
  category?: string;
  client?: string;
  description?: string;
  estimate?: string;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
  createdAt?: string;
  createdBy?: string;
  generalFields?: TaskFieldValue[];
  deliveryHistory?: DeliveryEntry[];
  done?: boolean;
}

interface BoardColumn {
  title: string;
  description?: string;
  connections?: BoardConnection[];
  color: BoardTabColor;
  icon: BoardTabIcon;
  fields: BoardTabField[];
  cards: BoardCard[];
}

type BoardConnectionScreen = "Backlog" | "Sprint";
type ConnectionDirection = "Receber de" | "Mover para";

interface BoardConnection {
  id: string;
  direction: ConnectionDirection;
  screen: BoardConnectionScreen;
  targetId: string;
}

interface BacklogColumn {
  title: string;
  description?: string;
  addToSprint?: boolean;
  aiStoryEnabled?: boolean;
  aiCriteriaEnabled?: boolean;
  aiStoryPointsEnabled?: boolean;
  connections?: BacklogConnection[];
  color: BoardTabColor;
  icon: BoardTabIcon;
  fields: BoardTabField[];
  entries: BacklogEntry[];
}

type BacklogConnectionScreen = "Board" | "Sprint";

interface BacklogConnection {
  id: string;
  direction: ConnectionDirection;
  screen: BacklogConnectionScreen;
  targetId: string;
}

interface SprintStatus {
  id: string;
  name: string;
  color: BoardTabColor;
}

interface SprintPlan {
  id: string;
  name: string;
  start: string;
  end: string;
  objective: string;
  statusId: string;
  capacityByMember?: Record<string, number>;
}

interface DraggedCard {
  columnIndex: number;
  cardIndex: number;
}

interface DraggedBacklogEntry {
  columnIndex: number;
  entryIndex: number;
  itemIndex?: number;
}

interface DraggedColumn {
  columnIndex: number;
}

interface TaskDetail {
  id: string;
  title: string;
  source: "Backlog" | "Board";
  priority: Priority;
  description?: string;
  createdBy?: string;
  sprint?: string;
  category?: string;
  client?: string;
  createdAt?: string;
  status?: string;
  owner?: string;
  assistants?: string[];
  points?: number;
  estimate?: string;
  generalFields?: TaskFieldValue[];
  deliveryHistory?: DeliveryEntry[];
}

const boardColumns = [
  {
    title: "Em andamento",
    description: "Itens que ja foram priorizados e estao em execucao pela equipe.",
    color: "blue",
    icon: "columns",
    fields: defaultBoardFields,
    cards: [
      { id: "#512", title: "Aluno nao conseguindo concluir prova", priority: "Baixa", owner: "JP", points: 5 },
      { id: "#513", title: "Falha ao enviar e-mail de recuperacao de senha", priority: "Media", owner: "LC", points: 8 },
      { id: "#514", title: "Relatorio de acessos nao carrega", priority: "Alta", owner: "RP", points: 3 },
      { id: "#515", title: "Ajuste no tempo de expiracao da sessao", priority: "Media", owner: "MG", points: 5 },
      { id: "#516", title: "Melhorias na performance do dashboard", priority: "Baixa", owner: "DS", points: 8 }
    ]
  },
  {
    title: "Bloqueado",
    description: "Itens impedidos por dependencia, decisao externa ou pendencia tecnica.",
    color: "red",
    icon: "lock",
    fields: [
      ...defaultBoardFields,
      { id: "field-blocker", name: "Motivo do bloqueio", type: "Texto longo", required: true }
    ],
    cards: []
  },
  {
    title: "Code Review - HOM",
    description: "Itens aguardando revisao de codigo antes da homologacao.",
    color: "purple",
    icon: "list",
    fields: defaultBoardFields,
    cards: [
      { id: "#498", title: "Exportacao de relatorio em PDF com erro", priority: "Media", owner: "FS", points: 5 },
      { id: "#499", title: "Usuario com permissao errada no modulo financeiro", priority: "Alta", owner: "TC", points: 8 },
      { id: "#500", title: "Validacao de campos no formulario de cadastro", priority: "Media", owner: "JP", points: 3 }
    ]
  },
  {
    title: "Em teste",
    description: "Itens em validacao funcional ou tecnica antes de seguir para producao.",
    color: "orange",
    icon: "dot",
    fields: defaultBoardFields,
    cards: [
      { id: "#487", title: "Integracao com sistema de pagamento", priority: "Baixa", owner: "LC", points: 8 },
      { id: "#488", title: "Erro ao importar planilha com caracteres especiais", priority: "Alta", owner: "RP", points: 5 },
      { id: "#489", title: "Notificacao por e-mail nao esta sendo enviada", priority: "Media", owner: "MG", points: 3 },
      { id: "#490", title: "Ajuste de layout na tela de relatorios", priority: "Baixa", owner: "DS", points: 2 }
    ]
  },
  {
    title: "Code Review - PROD",
    description: "Itens revisados para liberacao final em producao.",
    color: "blue",
    icon: "shield",
    fields: defaultBoardFields,
    cards: [
      { id: "#477", title: "Correcao de calculo de juros no financeiro", priority: "Alta", owner: "FS", points: 8 },
      { id: "#478", title: "Ajuste de permissao para edicao de usuario", priority: "Media", owner: "TC", points: 5 }
    ]
  },
  {
    title: "Aprovado",
    description: "Itens aprovados e prontos para encerramento.",
    color: "green",
    icon: "rocket",
    fields: defaultBoardFields,
    cards: [
      { id: "#470", title: "Implementacao de logs de auditoria", priority: "Baixa", owner: "JP", points: 3, done: true },
      { id: "#471", title: "Melhoria na busca global do sistema", priority: "Media", owner: "LC", points: 5, done: true },
      { id: "#472", title: "Ajuste no redirecionamento apos login", priority: "Baixa", owner: "RP", points: 2, done: true }
    ]
  }
] satisfies BoardColumn[];

const backlogColumns = [
  {
    title: "Intake",
    description: "Entrada inicial das demandas recebidas pelo produto.",
    color: "blue",
    icon: "columns",
    fields: [
      { id: "backlog-field-title", name: "Titulo", type: "Texto curto", required: true },
      { id: "backlog-field-source", name: "Via de entrada", type: "Lista", required: true }
    ],
    entries: backlogItems.map((item) => ({ ...item, priority: item.priority as Priority })),
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
] satisfies BacklogColumn[];

const sprintStatuses = [
  { id: "planning", name: "Planejamento", color: "purple" },
  { id: "active", name: "Em andamento", color: "blue" },
  { id: "done", name: "Concluida", color: "green" }
] satisfies SprintStatus[];

const sprintPlans = sprintCalendar.map((sprint) => ({
  id: sprint.sprint.toLowerCase().replace(/\s+/g, "-"),
  name: sprint.sprint,
  start: sprint.start,
  end: sprint.end,
  objective: sprint.sprint === currentSprint ? "Concluir os itens priorizados para a proxima entrega." : "Organizar capacidade e prioridades da sprint.",
  statusId: sprint.sprint === currentSprint ? "active" : "planning"
})) satisfies SprintPlan[];

const boardMembers = ["AS", "JP", "LC", "RP", "MG"];
const defaultClients = [
  { id: "client-lxp", name: "LXP", hasSquad: true, squadHours: 120 },
  { id: "client-toolz", name: "Toolz.me", hasSquad: false, squadHours: 0 },
  { id: "client-academy", name: "Academy Pro", hasSquad: true, squadHours: 80 }
] satisfies ClientAccount[];

const defaultRetrospectives = [
  {
    id: "retro-1",
    title: "Retro Sprint 17",
    isOpen: true,
    columns: [
      { id: "retro-good", title: "Funcionou bem", color: "green", cards: ["Alinhamento rapido nas prioridades"] },
      { id: "retro-improve", title: "Pode melhorar", color: "orange", cards: ["Quebrar cards grandes antes da planning"] },
      { id: "retro-actions", title: "Acoes", color: "blue", cards: ["Criar checklist de handoff"] }
    ]
  }
] satisfies Retrospective[];

export function App() {
  const [authenticatedEmail, setAuthenticatedEmail] = useState(() => {
    const storedSession = window.localStorage.getItem(authSessionStorageKey);
    return storedSession && localUsers.some((user) => user.email === storedSession) ? storedSession : "gabriel.fonseca@toolzz.me";
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const storedSession = window.localStorage.getItem(authSessionStorageKey);
    return Boolean(storedSession && localUsers.some((user) => user.email === storedSession));
  });
  const [page, setPage] = useState<Page>("board");
  const [products, setProducts] = useState<ProductAccess[]>(() => defaultProducts.map((product) => ({ ...product, members: product.members.map((member) => ({ ...member })) })));
  const [activeProductId, setActiveProductId] = useState(defaultProducts[0]?.id ?? "");
  const [boardConfig, setBoardConfig] = useState<BoardColumn[]>(() => hydrateBoardColumns(boardColumns).map((column) => ({ ...column, cards: [] })));
  const [backlogConfig, setBacklogConfig] = useState<BacklogColumn[]>(() => backlogColumns.map((column) => ({ ...column, fields: [...column.fields], entries: [], connections: [...(column.connections ?? [])] })));
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig[]>(() => defaultBacklogCategories.map((category) => ({ ...category })));
  const [clientConfig, setClientConfig] = useState<ClientAccount[]>([]);
  const [dailyConfig, setDailyConfig] = useState<DailyRecord[]>([]);
  const [planningConfig, setPlanningConfig] = useState<PlanningRecord[]>([]);
  const [retroConfig, setRetroConfig] = useState<Retrospective[]>([]);
  const [sprintConfig, setSprintConfig] = useState<SprintPlan[]>(() => sprintPlans.map((sprint) => ({ ...sprint })));
  const [sprintStatusConfig, setSprintStatusConfig] = useState<SprintStatus[]>(() => sprintStatuses.map((status) => ({ ...status })));
  const [initialVisibleTabs, setInitialVisibleTabs] = useState(4);
  const [isWorkspaceStateLoaded, setIsWorkspaceStateLoaded] = useState(false);
  const [lastWorkspaceUpdatedAt, setLastWorkspaceUpdatedAt] = useState<string | null>(null);
  const skipNextWorkspaceSaveRef = useRef(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = window.localStorage.getItem("toolz-theme");
    return storedTheme === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("toolz-theme", theme);
  }, [theme]);

  function applyWorkspaceSnapshot(snapshot?: WorkspaceStateSnapshot | null) {
    if (!snapshot) {
      return;
    }

    skipNextWorkspaceSaveRef.current = true;
    if (snapshot.backlogConfig) setBacklogConfig(snapshot.backlogConfig);
    if (snapshot.boardConfig) setBoardConfig(snapshot.boardConfig);
    if (snapshot.categoryConfig) setCategoryConfig(snapshot.categoryConfig);
    if (snapshot.clientConfig) setClientConfig(snapshot.clientConfig);
    if (snapshot.dailyConfig) setDailyConfig(snapshot.dailyConfig);
    if (typeof snapshot.initialVisibleTabs === "number") setInitialVisibleTabs(snapshot.initialVisibleTabs);
    if (snapshot.planningConfig) setPlanningConfig(snapshot.planningConfig);
    if (snapshot.products) setProducts(snapshot.products);
    if (snapshot.activeProductId) setActiveProductId(snapshot.activeProductId);
    if (snapshot.retroConfig) setRetroConfig(snapshot.retroConfig);
    if (snapshot.sprintConfig) setSprintConfig(snapshot.sprintConfig);
    if (snapshot.sprintStatusConfig) setSprintStatusConfig(snapshot.sprintStatusConfig);
  }

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    fetch(apiUrl("/api/workspace-state"))
      .then((response) => response.ok ? response.json() : { data: null })
      .then(({ data, updatedAt }: WorkspaceStateResponse) => {
        const storedState = window.localStorage.getItem(workspaceStateStorageKey);
        const snapshot = data ?? (storedState ? JSON.parse(storedState) as WorkspaceStateSnapshot : null);

        applyWorkspaceSnapshot(snapshot);
        setLastWorkspaceUpdatedAt(updatedAt ?? null);
      })
      .catch(() => {
        const storedState = window.localStorage.getItem(workspaceStateStorageKey);
        const snapshot = storedState ? JSON.parse(storedState) as WorkspaceStateSnapshot : null;
        applyWorkspaceSnapshot(snapshot);
      })
      .finally(() => setIsWorkspaceStateLoaded(true));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isWorkspaceStateLoaded) {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetch(apiUrl("/api/workspace-state"))
        .then((response) => response.ok ? response.json() : null)
        .then((state: WorkspaceStateResponse | null) => {
          if (!state?.updatedAt || state.updatedAt === lastWorkspaceUpdatedAt) {
            return;
          }

          applyWorkspaceSnapshot(state.data);
          setLastWorkspaceUpdatedAt(state.updatedAt);
        })
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, isWorkspaceStateLoaded, lastWorkspaceUpdatedAt]);

  useEffect(() => {
    if (!isAuthenticated || !isWorkspaceStateLoaded) {
      return;
    }

    if (skipNextWorkspaceSaveRef.current) {
      skipNextWorkspaceSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const snapshot = {
        activeProductId,
        backlogConfig,
        boardConfig,
        categoryConfig,
        clientConfig,
        dailyConfig,
        initialVisibleTabs,
        planningConfig,
        products,
        retroConfig,
        sprintConfig,
        sprintStatusConfig
      };

      window.localStorage.setItem(workspaceStateStorageKey, JSON.stringify(snapshot));

      fetch(apiUrl("/api/workspace-state"), {
        body: JSON.stringify(snapshot),
        headers: { "Content-Type": "application/json" },
        method: "PUT"
      })
        .then((response) => response.ok ? response.json() : null)
        .then((state: WorkspaceStateResponse | null) => {
          if (state?.updatedAt) setLastWorkspaceUpdatedAt(state.updatedAt);
        })
        .catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [activeProductId, backlogConfig, boardConfig, categoryConfig, clientConfig, dailyConfig, initialVisibleTabs, isAuthenticated, isWorkspaceStateLoaded, planningConfig, products, retroConfig, sprintConfig, sprintStatusConfig]);

  useEffect(() => {
    if (!isAuthenticated || !isWorkspaceStateLoaded) {
      return;
    }

    const activeSprint = getActiveSprint(sprintConfig, sprintStatusConfig);

    if (!activeSprint) {
      return;
    }

    setBoardConfig((currentColumns) => {
      let changed = false;
      const nextColumns = currentColumns.map((column) => ({
        ...column,
        cards: column.cards.map((card) => {
          if (card.sprint || card.createdBy !== "Board") {
            return card;
          }

          changed = true;
          return { ...card, sprint: activeSprint.name };
        })
      }));

      return changed ? nextColumns : currentColumns;
    });
  }, [isAuthenticated, isWorkspaceStateLoaded, sprintConfig, sprintStatusConfig]);

  const sprintBacklogItems = getSprintReadyBacklogItems(backlogConfig);
  const sprintBoardItems = getSprintReadyBoardItems(boardConfig, sprintConfig);
  const sprintDeliveryItems = mergeSprintItems(sprintBacklogItems, sprintBoardItems);
  const activeProduct = products.find((product) => product.id === activeProductId) ?? products[0];
  const currentMember = activeProduct?.members.find((member) => member.email === authenticatedEmail) ?? activeProduct?.members[0];
  const currentPermission = currentMember?.permission ?? "Membro";
  const isAdmin = currentPermission === "Admin";

  function handleNavigate(nextPage: Page) {
    if (nextPage === "permissions" && !isAdmin) {
      return;
    }
    setPage(nextPage);
  }

  function handleProductChange(productId: string) {
    setActiveProductId(productId);
    if (page === "permissions") {
      const nextProduct = products.find((product) => product.id === productId);
      const nextPermission = nextProduct?.members.find((member) => member.email === authenticatedEmail)?.permission ?? nextProduct?.members[0]?.permission ?? "Membro";
      if (nextPermission !== "Admin") {
        setPage("dashboard");
      }
    }
  }

  function updateBacklogItemEstimates(estimates: Record<number, string>) {
    setBacklogConfig((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        entries: column.entries.map((entry) => {
          if (isEpic(entry)) {
            return {
              ...entry,
              items: entry.items.map((item) => item.order in estimates ? { ...item, estimate: estimates[item.order] } : item)
            };
          }

          return entry.order in estimates ? { ...entry, estimate: estimates[entry.order] } : entry;
        })
      }))
    );
    setBoardConfig((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        cards: column.cards.map((card) => {
          const order = getBoardCardOrder(card);
          return order in estimates ? { ...card, estimate: estimates[order] } : card;
        })
      }))
    );
  }

  function updateBacklogItemEstimate(order: number, estimate: string) {
    updateBacklogItemEstimates({ [order]: estimate });
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={(email) => {
      window.localStorage.setItem(authSessionStorageKey, email);
      setAuthenticatedEmail(email);
      setIsAuthenticated(true);
    }} />;
  }

  if (!activeProduct) {
    return null;
  }

  const sessionValue: SessionContextValue = {
    activeProduct,
    activeProductId,
    currentMember,
    currentPermission,
    isAdmin,
    products,
    onLogout: () => {
      window.localStorage.removeItem(authSessionStorageKey);
      setIsAuthenticated(false);
      setPage("board");
    },
    onNavigate: handleNavigate,
    onProductsChange: setProducts,
    onProductChange: handleProductChange
  };

  return (
    <SessionContext.Provider value={sessionValue}>
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={handleNavigate} productName={activeProduct.name} permission={currentPermission} />
      {page === "backlog" && (
        <BacklogPage
          boardColumns={boardConfig}
          categories={categoryConfig}
          clients={clientConfig}
          columns={backlogConfig}
          members={activeProduct.members}
          onColumnsChange={setBacklogConfig}
          onCategoriesChange={setCategoryConfig}
          onEntryMovedToColumn={(entry, columnTitle) => {
            const movedItems = flattenBacklogEntries([entry]);
            const movedNames = new Set(movedItems.map((item) => item.name));
            const outgoingBoardTarget = getOutgoingBacklogConnection(backlogConfig, columnTitle, "Board")?.targetId;

            setBoardConfig((currentColumns) => {
              const receivedColumns = moveConnectedBoardCardsToColumn(currentColumns, "Backlog", columnTitle, (card) => movedNames.has(card.title));
              return outgoingBoardTarget ? upsertBoardCardsToColumn(receivedColumns, outgoingBoardTarget, movedItems) : receivedColumns;
            });
          }}
          sprints={sprintConfig}
          theme={theme}
          onToggleTheme={() => setTheme(toggleTheme)}
        />
      )}
      {page === "board" && (
        <BoardPage
          columns={boardConfig}
          initialVisibleTabs={initialVisibleTabs}
          members={activeProduct.members}
          onColumnsChange={setBoardConfig}
          onCardMovedToColumn={(cardTitle, columnTitle) => {
            const outgoingBacklogTarget = getOutgoingBoardConnection(boardConfig, columnTitle, "Backlog")?.targetId;

            setBacklogConfig((currentColumns) => {
              const receivedColumns = moveConnectedBacklogItemsToColumn(currentColumns, "Board", columnTitle, (item) => item.name === cardTitle);
              return outgoingBacklogTarget
                ? moveBacklogItemsToColumnByTitle(receivedColumns, outgoingBacklogTarget, (item) => item.name === cardTitle)
                : receivedColumns;
            });
          }}
          onInitialVisibleTabsChange={setInitialVisibleTabs}
          backlogColumns={backlogConfig}
          categories={categoryConfig}
          clients={clientConfig}
          sprintBacklogItems={sprintBacklogItems}
          sprints={sprintConfig}
          sprintStatuses={sprintStatusConfig}
          onSprintsChange={setSprintConfig}
          theme={theme}
          onToggleTheme={() => setTheme(toggleTheme)}
        />
      )}
      {page === "sprints" && (
        <SprintsPage
          backlogItems={sprintDeliveryItems}
          categories={categoryConfig}
          clients={clientConfig}
          members={activeProduct.members}
          sprints={sprintConfig}
          statuses={sprintStatusConfig}
          onSprintsChange={setSprintConfig}
          onStatusesChange={setSprintStatusConfig}
          onUpdateItemEstimate={updateBacklogItemEstimate}
          onUpdateSprintEstimates={updateBacklogItemEstimates}
          theme={theme}
          onToggleTheme={() => setTheme(toggleTheme)}
        />
      )}
      {page === "clients" && (
        <ClientsPage
          backlogColumns={backlogConfig}
          clients={clientConfig}
          members={activeProduct.members}
          onBacklogColumnsChange={setBacklogConfig}
          onClientsChange={setClientConfig}
          sprints={sprintConfig}
          theme={theme}
          onToggleTheme={() => setTheme(toggleTheme)}
        />
      )}
      {page === "reports" && <ReportsPage backlogColumns={backlogConfig} boardColumns={boardConfig} categories={categoryConfig} clients={clientConfig} theme={theme} onToggleTheme={() => setTheme(toggleTheme)} />}
      {page === "ceremonies" && (
        <CeremoniesPage
          backlogColumns={backlogConfig}
          boardColumns={boardConfig}
          dailyRecords={dailyConfig}
          planningRecords={planningConfig}
          sprintBacklogItems={sprintBacklogItems}
          retrospectives={retroConfig}
          sprints={sprintConfig}
          sprintStatuses={sprintStatusConfig}
          onDailyRecordsChange={setDailyConfig}
          onPlanningRecordsChange={setPlanningConfig}
          onRetrospectivesChange={setRetroConfig}
          theme={theme}
          onToggleTheme={() => setTheme(toggleTheme)}
        />
      )}
      {page === "apis" && <ApisPage theme={theme} onToggleTheme={() => setTheme(toggleTheme)} />}
      {page === "permissions" && isAdmin && <PermissionsPage theme={theme} onToggleTheme={() => setTheme(toggleTheme)} />}
      {page === "dashboard" && <DashboardPage theme={theme} onToggleTheme={() => setTheme(toggleTheme)} />}
    </div>
    </SessionContext.Provider>
  );
}

function toggleTheme(currentTheme: Theme): Theme {
  return currentTheme === "dark" ? "light" : "dark";
}

function getInitials(name?: string) {
  const [firstName = "", lastName = ""] = (name ?? "").trim().split(/\s+/);
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "GF";
}

function getMemberInitials(name?: string) {
  const trimmedName = name?.trim() ?? "";

  if (!trimmedName) {
    return "--";
  }

  return /^[A-Z]{1,3}$/.test(trimmedName) ? trimmedName : getInitials(trimmedName);
}

function LoginPage({ onLogin }: { onLogin: (email: string) => void }) {
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [email, setEmail] = useState("gabriel.fonseca@toolzz.me");
  const [password, setPassword] = useState("Gabr1el=12");
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    setFeedback(null);

    if (mode === "recover") {
      const existingUser = localUsers.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
      setFeedback({
        type: existingUser ? "success" : "error",
        message: existingUser
          ? `Enviamos as instrucoes de recuperacao para ${existingUser.email}.`
          : "Nao encontramos uma conta com esse e-mail."
      });
      return;
    }

    const existingUser = localUsers.find((user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password);

    if (!existingUser) {
      setFeedback({ type: "error", message: "E-mail ou senha incorretos." });
      return;
    }

    onLogin(existingUser.email);
  }

  function toggleLoginMode() {
    setFeedback(null);
    setMode(mode === "login" ? "recover" : "login");
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark" />
          <strong>Toolz.me</strong>
        </div>
        <h1>{mode === "login" ? "Entrar na plataforma" : "Recuperar senha"}</h1>
        <p>{mode === "login" ? "Acesse seus produtos, boards, sprints e cerimonias." : "Informe seu e-mail para receber as instrucoes de redefinicao."}</p>
        <form onSubmit={handleSubmit}>
          <label>
            <span>E-mail</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          {mode === "login" && (
            <label>
              <span>Senha</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
          )}
          {feedback && <div className={`login-feedback ${feedback.type}`}>{feedback.message}</div>}
          <button className="primary-button" type="submit">{mode === "login" ? "Entrar" : "Enviar recuperacao"}</button>
        </form>
        <button className="login-link" type="button" onClick={toggleLoginMode}>
          {mode === "login" ? "Esqueci minha senha" : "Voltar para login"}
        </button>
      </section>
    </main>
  );
}

function PermissionsPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { products, onProductsChange } = useSession();
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];

  function createProduct() {
    const product: ProductAccess = {
      id: `product-${Date.now()}`,
      name: `Novo produto ${products.length + 1}`,
      members: [{ id: `member-${Date.now()}`, name: "Amanda Silva", email: "amanda@toolz.me", permission: "Admin" }]
    };
    onProductsChange([...products, product]);
    setSelectedProductId(product.id);
  }

  function updateProduct(productId: string, updates: Partial<ProductAccess>) {
    onProductsChange(products.map((product) => product.id === productId ? { ...product, ...updates } : product));
  }

  function updateMember(memberId: string, updates: Partial<ProductMember>) {
    if (!selectedProduct) {
      return;
    }
    updateProduct(selectedProduct.id, {
      members: selectedProduct.members.map((member) => member.id === memberId ? { ...member, ...updates } : member)
    });
  }

  function addMember() {
    if (!selectedProduct) {
      return;
    }
    updateProduct(selectedProduct.id, {
      members: [...selectedProduct.members, { id: `member-${Date.now()}`, name: "Novo membro", email: "membro@produto.com", permission: "Membro" }]
    });
  }

  if (!selectedProduct) {
    return null;
  }

  return (
    <main className="dashboard permissions-page">
      <Topbar title="Permissoes" subtitle="Crie produtos e gerencie pessoas e permissoes por produto." theme={theme} onToggleTheme={onToggleTheme} />
      <section className="permissions-layout">
        <aside className="permissions-products">
          <header>
            <h2>Produtos</h2>
            <button type="button" onClick={createProduct}><Plus size={16} /></button>
          </header>
          {products.map((product) => (
            <button className={product.id === selectedProduct.id ? "active" : ""} type="button" key={product.id} onClick={() => setSelectedProductId(product.id)}>
              <strong>{product.name}</strong>
              <span>{product.members.length} pessoas</span>
            </button>
          ))}
        </aside>
        <section className="permissions-panel">
          <label>
            <span>Nome do produto</span>
            <input value={selectedProduct.name} onChange={(event) => updateProduct(selectedProduct.id, { name: event.target.value })} />
          </label>
          <header className="permissions-members-header">
            <div>
              <h2>Pessoas no produto</h2>
              <p>Defina quem participa e se a permissao e de Membro ou Admin.</p>
            </div>
            <button className="primary-button" type="button" onClick={addMember}><Plus size={16} />Adicionar pessoa</button>
          </header>
          <div className="permissions-member-list">
            {selectedProduct.members.map((member) => (
              <article className="permissions-member-row" key={member.id}>
                <input value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} />
                <input value={member.email} onChange={(event) => updateMember(member.id, { email: event.target.value })} />
                <select value={member.permission} onChange={(event) => updateMember(member.id, { permission: event.target.value as UserPermission })}>
                  <option>Membro</option>
                  <option>Admin</option>
                </select>
                <button type="button" onClick={() => updateProduct(selectedProduct.id, { members: selectedProduct.members.filter((currentMember) => currentMember.id !== member.id) })}><X size={16} /></button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function getActiveSprint(sprints: SprintPlan[], statuses: SprintStatus[]) {
  const activeStatus = statuses.find((status) => status.name === "Em andamento");
  return sprints.find((sprint) => activeStatus ? sprint.statusId === activeStatus.id : sprint.name === currentSprint) ?? sprints[0];
}

function hydrateBoardColumns(columns: BoardColumn[]): BoardColumn[] {
  return columns.map((column, columnIndex) => ({
    ...column,
    fields: [...column.fields],
    connections: [...(column.connections ?? [])],
    cards: column.cards.map((card, cardIndex) => hydrateBoardCard(card, columns, columnIndex, cardIndex))
  }));
}

function hydrateBoardCard(card: BoardCard, columns: BoardColumn[], columnIndex: number, cardIndex: number): BoardCard {
  const createdAt = card.createdAt ?? `0${Math.min(cardIndex + 1, 9)}/05/2026`;
  const createdBy = card.createdBy ?? "Amanda Silva";

  return {
    ...card,
    createdAt,
    createdBy,
    generalFields: card.generalFields ?? getGeneralFieldValues(card.title, card.owner, card.points),
    deliveryHistory: card.deliveryHistory ?? createDeliveryHistory(columns, columnIndex, card.owner)
  };
}

function getOutgoingBacklogConnection(columns: BacklogColumn[], columnTitle: string, screen: BacklogConnectionScreen) {
  return columns
    .find((column) => column.title === columnTitle)
    ?.connections?.find((connection) => connection.direction === "Mover para" && connection.screen === screen);
}

function getOutgoingBoardConnection(columns: BoardColumn[], columnTitle: string, screen: BoardConnectionScreen) {
  return columns
    .find((column) => column.title === columnTitle)
    ?.connections?.find((connection) => connection.direction === "Mover para" && connection.screen === screen);
}

function moveConnectedBacklogItemsToColumn(
  columns: BacklogColumn[],
  screen: BacklogConnectionScreen,
  targetId: string,
  matcher: (item: BacklogItem) => boolean
) {
  const targetColumnIndex = columns.findIndex((column) =>
    (column.connections ?? []).some((connection) =>
      (connection.direction ?? "Receber de") === "Receber de" &&
      connection.screen === screen &&
      (screen === "Sprint" || connection.targetId === targetId)
    )
  );

  return targetColumnIndex >= 0 ? moveBacklogItemsToColumn(columns, targetColumnIndex, matcher) : columns;
}

function moveBacklogItemsToColumnByTitle(columns: BacklogColumn[], targetTitle: string, matcher: (item: BacklogItem) => boolean) {
  const targetColumnIndex = columns.findIndex((column) => column.title === targetTitle);
  return targetColumnIndex >= 0 ? moveBacklogItemsToColumn(columns, targetColumnIndex, matcher) : columns;
}

function moveBacklogItemsToColumn(columns: BacklogColumn[], targetColumnIndex: number, matcher: (item: BacklogItem) => boolean): BacklogColumn[] {
  const nextColumns = columns.map((column) => ({ ...column, entries: column.entries.map(cloneBacklogEntry), fields: [...column.fields], connections: [...(column.connections ?? [])] }));
  const movedEntries: BacklogEntry[] = [];

  nextColumns.forEach((column) => {
    const remainingEntries: BacklogEntry[] = [];

    column.entries.forEach((entry) => {
      if (isEpic(entry)) {
        const movedItems = entry.items.filter(matcher);
        const remainingItems = entry.items.filter((item) => !matcher(item));

        if (movedItems.length > 0) {
          movedEntries.push({ ...entry, items: movedItems });
        }

        if (remainingItems.length > 0) {
          remainingEntries.push({ ...entry, items: remainingItems });
        }
        return;
      }

      if (matcher(entry)) {
        movedEntries.push(entry);
        return;
      }

      remainingEntries.push(entry);
    });

    column.entries = remainingEntries;
  });

  movedEntries.forEach((entry) => insertDraggedBacklogEntry(nextColumns[targetColumnIndex], entry, nextColumns[targetColumnIndex].entries.length));

  return nextColumns;
}

function cloneBacklogEntry(entry: BacklogEntry): BacklogEntry {
  return isEpic(entry) ? { ...entry, items: entry.items.map((item) => ({ ...item })) } : { ...entry };
}

function getSprintReadyBacklogItems(columns: BacklogColumn[]) {
  return columns
    .filter((column) =>
      column.addToSprint ||
      (column.connections ?? []).some((connection) => connection.direction === "Mover para" && connection.screen === "Sprint")
    )
    .flatMap((column) => flattenBacklogEntries(column.entries))
    .filter((item) => item.sprint !== "Em planejamento");
}

function getSprintReadyBoardItems(columns: BoardColumn[], sprints: SprintPlan[]): BacklogItem[] {
  const sprintNames = new Set(sprints.map((sprint) => sprint.name));

  return columns.flatMap((column) =>
    column.cards
      .filter((card) => card.sprint && card.sprint !== "Em planejamento" && sprintNames.has(card.sprint))
      .map((card) => boardCardToSprintItem(card))
  );
}

function boardCardToSprintItem(card: BoardCard): BacklogItem {
  return {
    order: getBoardCardOrder(card),
    name: card.title,
    sprint: card.sprint ?? "Em planejamento",
    category: card.category ?? "Board",
    priority: card.priority,
    createdAt: card.createdAt ?? new Date().toLocaleDateString("pt-BR"),
    client: card.client,
    description: card.description,
    estimate: card.estimate,
    linearIdentifier: card.linearIdentifier,
    linearIssueId: card.linearIssueId,
    linearUrl: card.linearUrl,
    owner: card.owner || undefined,
    assistants: card.assistants,
    storyPoints: card.points || undefined
  };
}

function getBoardCardOrder(card: BoardCard) {
  const numericId = Number(card.id.replace(/\D/g, "").slice(-9));
  return Number.isFinite(numericId) && numericId > 0 ? numericId : Math.abs(hashString(card.id || card.title));
}

function hashString(value: string) {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function mergeSprintItems(backlogItems: BacklogItem[], boardItems: BacklogItem[]) {
  const seen = new Set(backlogItems.map(getSprintItemKey));
  const uniqueBoardItems = boardItems.filter((item) => {
    const key = getSprintItemKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return [...backlogItems, ...uniqueBoardItems];
}

function getSprintItemKey(item: BacklogItem) {
  return item.linearIssueId ?? item.linearIdentifier ?? item.linearUrl ?? item.name.trim().toLowerCase();
}

function moveConnectedBoardCardsToColumn(
  columns: BoardColumn[],
  screen: BoardConnectionScreen,
  targetId: string,
  matcher: (card: BoardCard) => boolean
) {
  const targetColumnIndex = columns.findIndex((column) =>
    (column.connections ?? []).some((connection) =>
      (connection.direction ?? "Receber de") === "Receber de" &&
      connection.screen === screen &&
      (screen === "Sprint" || connection.targetId === targetId)
    )
  );

  if (targetColumnIndex < 0) {
    return columns;
  }

  const nextColumns = columns.map((column) => ({
    ...column,
    fields: [...column.fields],
    connections: [...(column.connections ?? [])],
    cards: [...column.cards]
  }));
  const movedCards: BoardCard[] = [];

  nextColumns.forEach((column, columnIndex) => {
    if (columnIndex === targetColumnIndex) {
      return;
    }

    const remainingCards: BoardCard[] = [];
    column.cards.forEach((card) => {
      if (matcher(card)) {
        movedCards.push(card);
        return;
      }

      remainingCards.push(card);
    });
    column.cards = remainingCards;
  });

  const existingTitles = new Set(nextColumns[targetColumnIndex].cards.map((card) => card.title));
  nextColumns[targetColumnIndex].cards = [
    ...nextColumns[targetColumnIndex].cards,
    ...movedCards.filter((card) => !existingTitles.has(card.title))
  ];

  return nextColumns;
}

function upsertBoardCardsToColumn(columns: BoardColumn[], targetTitle: string, items: BacklogItem[]) {
  const targetColumnIndex = columns.findIndex((column) => column.title === targetTitle);

  if (targetColumnIndex < 0 || items.length === 0) {
    return columns;
  }

  const movedNames = new Set(items.map((item) => item.name));
  const nextColumns = columns.map((column) => ({
    ...column,
    fields: [...column.fields],
    connections: [...(column.connections ?? [])],
    cards: column.cards.filter((card) => !movedNames.has(card.title))
  }));
  const existingTitles = new Set(nextColumns[targetColumnIndex].cards.map((card) => card.title));
  const newCards = items
    .filter((item) => !existingTitles.has(item.name))
    .map((item) => boardCardFromBacklogItem(item));

  nextColumns[targetColumnIndex].cards = [...nextColumns[targetColumnIndex].cards, ...newCards];

  return nextColumns;
}

function boardCardFromBacklogItem(item: BacklogItem): BoardCard {
  return {
    id: `#${item.order}`,
    title: item.name,
    priority: item.priority,
    owner: item.owner ?? "",
    assistants: item.assistants,
    points: item.storyPoints ?? 0,
    sprint: item.sprint,
    category: item.category,
    client: item.client,
    description: item.description,
    estimate: item.estimate,
    linearIdentifier: item.linearIdentifier,
    linearIssueId: item.linearIssueId,
    linearUrl: item.linearUrl,
    createdAt: item.createdAt,
    createdBy: "Backlog",
    generalFields: getBacklogFieldValues(item),
    deliveryHistory: []
  };
}

function getGeneralFieldValues(title: string, owner: string, points: number): TaskFieldValue[] {
  return [
    { id: "general-title", label: "Titulo", value: title, type: "Texto curto" },
    { id: "general-entry", label: "Via de Entrada", value: "Backlog", type: "Lista" },
    { id: "general-owner", label: "Responsavel inicial", value: owner, type: "Pessoa" },
    { id: "general-points", label: "Story points", value: String(points), type: "Numero" }
  ];
}

function getBacklogFieldValues(item: BacklogItem): TaskFieldValue[] {
  return [
    { id: `backlog-${item.order}-estimate`, label: "Estimativa", value: item.estimate ?? "Sem estimativa", type: "Data" as BoardFieldType },
    { id: `backlog-${item.order}-linear`, label: "Link Linear", value: item.linearUrl ?? item.linearIdentifier ?? "Sem vinculo", type: "Texto curto" as BoardFieldType },
    ...fieldMappings.map((field, index) => ({
      id: `backlog-${item.order}-${index}`,
      label: field,
      value: getBacklogFieldValue(field, item),
      type: (field.includes("Link") || field.includes("Issue") ? "Texto curto" : field.includes("?") ? "Sim/Nao" : "Lista") as BoardFieldType
    }))
  ];
}

function getBacklogFieldValue(field: string, item: BacklogItem) {
  if (field === "Link Notion" || field === "Issue ID (Github)") {
    return item.linearUrl ?? item.linearIdentifier ?? "Nao vinculado";
  }

  if (field === "Tipo de Melhoria") {
    return item.category;
  }

  if (field === "Via de Entrada") {
    return item.priority === "Alta" ? "SLA" : "Produto";
  }

  if (field === "Existem Cards Relacionados?") {
    return item.order % 2 === 0 ? "Sim" : "Nao";
  }

  if (field === "Link Notion") {
    return `notion.so/card-${item.order}`;
  }

  if (field === "Issue ID (Github)") {
    return `GH-${420 + item.order}`;
  }

  if (field === "Cliente VIP?") {
    return item.priority === "Alta" ? "Sim" : "Nao";
  }

  return item.category === "Squad" ? "Sim" : "Nao";
}

function createDeliveryHistory(columns: BoardColumn[], columnIndex: number, movedBy: string): DeliveryEntry[] {
  return columns.slice(0, columnIndex + 1).map((column, index) => createDeliveryEntry(column, index, movedBy));
}

function createDeliveryEntry(column: BoardColumn, tabIndex: number, movedBy: string): DeliveryEntry {
  return {
    tabTitle: column.title,
    tabIndex,
    movedBy,
    movedAt: formatMovementDate(),
    fields: column.fields.map((field) => ({
      id: field.id,
      label: field.name,
      type: field.type,
      value: getDeliveryFieldValue(field)
    }))
  };
}

function getDeliveryFieldValue(field: BoardTabField) {
  if (field.type === "Pessoa") {
    return "Amanda Silva";
  }

  if (field.type === "Numero") {
    return "5";
  }

  if (field.type === "Data") {
    return "18/05/2026";
  }

  if (field.type === "Sim/Nao") {
    return field.required ? "Sim" : "Nao";
  }

  if (field.type === "Lista") {
    return "Padrao";
  }

  return field.required ? "Preenchido" : "Pendente";
}

function formatMovementDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function Sidebar({ activePage, onNavigate, permission, productName }: { activePage: Page; onNavigate: (page: Page) => void; permission: UserPermission; productName: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`} aria-label="Menu lateral">
      <div className="sidebar-header">
        <a className="brand" href="/" aria-label="Toolz.me" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark" />
          <span className="brand-copy">
            Toolz.me
            <small>{productName} - {permission}</small>
          </span>
        </a>
        <button
          aria-label={isCollapsed ? "Expandir menu lateral" : "Recuar menu lateral"}
          className="sidebar-toggle"
          onClick={() => setIsCollapsed((current) => !current)}
          title={isCollapsed ? "Expandir menu" : "Recuar menu"}
          type="button"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            className={`nav-item ${activePage === item.id ? "active" : ""}`}
            key={item.id}
            aria-label={item.label}
            title={isCollapsed ? item.label : undefined}
            type="button"
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={21} strokeWidth={1.9} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

    </aside>
  );
}

function DashboardPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [dashboard, setDashboard] = useState<DashboardData>(mockDashboard);

  useEffect(() => {
    getDashboard().then(setDashboard);
  }, []);

  return (
    <main className="dashboard">
      <Topbar
        title="Dashboard"
        subtitle="Visao geral dos cards e atividades do time"
        period={dashboard.period}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <section className="metric-grid" aria-label="Resumo dos cards">
        {dashboard.metrics.map((metric) => (
          <MetricCard metric={metric} key={metric.id} />
        ))}
      </section>

      <section className="content-grid">
        <article className="panel delayed-panel">
          <PanelHeader
            tone="danger"
            title="Cards em desenvolvimento atrasados"
            subtitle="Story points ultrapassaram a hora estimada e nao houve movimentacao"
          />
          <div className="table delayed-table">
            <div className="table-row table-head">
              <span>Card</span>
              <span>Responsavel</span>
              <span>Story Points</span>
              <span>Ultima movimentacao</span>
            </div>
            {dashboard.delayedCards.map((card) => (
              <div className="table-row" key={card.id}>
                <span className="card-cell">
                  <span className="thumb" />
                  <span>
                    <strong>{card.id}</strong>
                    <small>{card.title}</small>
                  </span>
                </span>
                <span className="owner-cell">
                  <span className="mini-avatar" />
                  <span>{card.owner}</span>
                </span>
                <span>
                  <span className="delay-badge">{card.extraHours}</span>
                </span>
                <span className="muted">{card.lastMovement}</span>
              </div>
            ))}
          </div>
          <PanelFooter label="Ver todos os atrasados" />
        </article>

        <article className="panel movement-panel">
          <PanelHeader tone="team" title="Area Dev" subtitle="Ultimas movimentacoes de cards" />
          <div className="table movement-table">
            <div className="table-row table-head">
              <span>Dev</span>
              <span>Card</span>
              <span>Movimentacao</span>
              <span>Ha</span>
            </div>
            {dashboard.movements.map((movement) => (
              <div className="table-row" key={movement.id}>
                <span className="owner-cell">
                  <span className="mini-avatar" />
                  <span>{movement.developer}</span>
                </span>
                <span className="card-title">{movement.card}</span>
                <span>
                  <StatusBadge status={movement.status} />
                </span>
                <span>{movement.elapsed}</span>
              </div>
            ))}
          </div>
          <PanelFooter label="Ver todas as movimentacoes" />
        </article>
      </section>
    </main>
  );
}

function ClientsPage({
  backlogColumns,
  clients,
  members,
  onBacklogColumnsChange,
  onClientsChange,
  sprints,
  theme,
  onToggleTheme
}: {
  backlogColumns: BacklogColumn[];
  clients: ClientAccount[];
  members: ProductMember[];
  onBacklogColumnsChange: (columns: BacklogColumn[]) => void;
  onClientsChange: (clients: ClientAccount[]) => void;
  sprints: SprintPlan[];
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [hasSquad, setHasSquad] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [squadHours, setSquadHours] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("Media");
  const [taskCategory, setTaskCategory] = useState(defaultBacklogCategories[0]?.name ?? "SLA");
  const [taskSprint, setTaskSprint] = useState(sprints[0]?.name ?? "Em planejamento");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskStoryPoints, setTaskStoryPoints] = useState("");
  const [targetBacklogColumn, setTargetBacklogColumn] = useState(backlogColumns[0]?.title ?? "");

  function addClient() {
    if (!clientName.trim()) {
      return;
    }

    onClientsChange([
      ...clients,
      {
        id: `client-${Date.now()}`,
        name: clientName.trim(),
        hasSquad,
        squadHours: hasSquad ? Number(squadHours) || 0 : 0
      }
    ]);
    setClientName("");
    setHasSquad(false);
    setSquadHours("");
    setIsClientModalOpen(false);
  }

  function updateClient(clientId: string, updates: Partial<Pick<ClientAccount, "name" | "hasSquad" | "squadHours">>) {
    onClientsChange(clients.map((client) => client.id === clientId ? { ...client, ...updates } : client));
  }

  function addClientTask() {
    const selectedClient = clients.find((client) => client.id === selectedClientId);

    if (!selectedClient || !taskName.trim() || backlogColumns.length === 0) {
      return;
    }

    const targetColumnIndex = Math.max(backlogColumns.findIndex((column) => column.title === targetBacklogColumn), 0);
    const totalBacklogItems = backlogColumns.reduce((total, column) => total + flattenBacklogEntries(column.entries).length, 0);
    const newTask: BacklogItem = {
      order: totalBacklogItems + 1,
      name: taskName.trim(),
      sprint: taskSprint.trim() || "Em planejamento",
      category: taskCategory,
      priority: taskPriority,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      owner: taskOwner || undefined,
      storyPoints: taskStoryPoints ? Number(taskStoryPoints) || undefined : undefined,
      client: selectedClient.name
    };

    onBacklogColumnsChange(backlogColumns.map((column, columnIndex) => (
      columnIndex === targetColumnIndex ? { ...column, entries: [newTask, ...column.entries] } : column
    )));
    setTaskName("");
    setTaskPriority("Media");
    setTaskCategory(defaultBacklogCategories[0]?.name ?? "SLA");
    setTaskSprint(sprints[0]?.name ?? "Em planejamento");
    setTaskOwner("");
    setTaskStoryPoints("");
    setTargetBacklogColumn(backlogColumns[targetColumnIndex]?.title ?? backlogColumns[0]?.title ?? "");
  }

  const squadClients = clients.filter((client) => client.hasSquad);
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const clientTaskRows = selectedClient
    ? backlogColumns.flatMap((column) => flattenBacklogEntries(column.entries)
      .filter((item) => item.client === selectedClient.name)
      .map((item) => ({ item, columnTitle: column.title })))
    : [];

  if (selectedClient) {
    return (
      <main className="dashboard clients-page">
        <Topbar title={selectedClient.name} subtitle="Tarefas vinculadas ao cliente e envio direto para o backlog." theme={theme} onToggleTheme={onToggleTheme} />
        <section className="client-detail-header">
          <button className="secondary-button" type="button" onClick={() => setSelectedClientId(null)}><ChevronLeft size={16} />Voltar para clientes</button>
          <div>
            <span className={selectedClient.hasSquad ? "squad-positive" : "squad-muted"}>{selectedClient.hasSquad ? <UsersRound size={18} /> : <UserRound size={18} />}<strong>{selectedClient.hasSquad ? "Tem squad" : "Sem squad"}</strong></span>
            <small>{selectedClient.hasSquad ? `${selectedClient.squadHours}h/mes dedicadas` : "Demanda sob demanda"}</small>
          </div>
        </section>

        <section className="workspace-panel client-task-create-panel">
          <header>
            <h2>Nova tarefa do cliente</h2>
            <span>Crie a atividade e escolha em qual aba do backlog ela entra.</span>
          </header>
          <div className="client-task-form">
            <label>
              <span>Titulo</span>
              <input value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="Nome da tarefa" />
            </label>
            <label>
              <span>Aba do backlog</span>
              <select value={targetBacklogColumn} onChange={(event) => setTargetBacklogColumn(event.target.value)}>
                {backlogColumns.map((column) => <option key={column.title} value={column.title}>{column.title}</option>)}
              </select>
            </label>
            <label>
              <span>Responsavel</span>
              <select value={taskOwner} onChange={(event) => setTaskOwner(event.target.value)}>
                <option value="">Sem responsavel</option>
                {members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
              </select>
            </label>
            <label>
              <span>SP</span>
              <input min={0} type="number" value={taskStoryPoints} onChange={(event) => setTaskStoryPoints(event.target.value)} placeholder="SP" />
            </label>
            <label>
              <span>Categoria</span>
              <select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value)}>
                {defaultBacklogCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </label>
            <label>
              <span>Prioridade</span>
              <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Priority)}>
                <option value="Baixa">Baixa</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </label>
            <label>
              <span>Sprint</span>
              <select value={taskSprint} onChange={(event) => setTaskSprint(event.target.value)}>
                <option value="Em planejamento">Em planejamento</option>
                {sprints.map((sprint) => <option key={sprint.id} value={sprint.name}>{sprint.name}</option>)}
              </select>
            </label>
            <button className="primary-button" type="button" onClick={addClientTask}><Plus size={16} />Adicionar tarefa</button>
          </div>
        </section>

        <section className="workspace-panel clients-model-panel">
          <div className="client-task-table">
            <div className="client-task-row client-task-head"><span>Tarefa</span><span>Responsavel</span><span>SP</span><span>Criada em</span><span>Aba</span></div>
            {clientTaskRows.length === 0 && <div className="client-task-empty">Nenhuma tarefa vinculada a este cliente ainda.</div>}
            {clientTaskRows.map(({ item, columnTitle }) => (
              <div className="client-task-row" key={`${columnTitle}-${item.order}-${item.name}`}>
                <strong>{item.name}</strong>
                <span>{item.owner || "Sem responsavel"}</span>
                <span>{item.storyPoints ?? "-"}</span>
                <span>{item.createdAt}</span>
                <span>{columnTitle}</span>
              </div>
            ))}
          </div>
          <footer className="client-table-footer"><span>{clientTaskRows.length} tarefas encontradas</span><span>Cliente: {selectedClient.name}</span></footer>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard clients-page">
      <Topbar title="Clientes" subtitle="Gerencie seus clientes e as informacoes das squads associadas." theme={theme} onToggleTheme={onToggleTheme} />
      <section className="clients-command-bar">
        <label className="search-field client-search"><Search size={18} /><input placeholder="Buscar cliente..." /></label>
        <button className="secondary-button" type="button"><ListFilter size={16} />Filtrar</button>
        <button className="primary-button" type="button" onClick={() => setIsClientModalOpen(true)}><Plus size={16} />Novo cliente</button>
      </section>
      <section className="client-metrics">
        <article><UsersRound size={24} /><strong>{clients.length}</strong><span>Total de clientes</span></article>
        <article><UsersRound size={24} /><strong>{squadClients.length}</strong><span>Clientes com squad</span></article>
      </section>
      <section className="workspace-panel clients-model-panel">
        <div className="client-table">
          <div className="client-table-row client-table-head"><span>Cliente</span><span>Squad</span><span>Horas dedicadas</span><span>Status</span><span>Contato</span><span>Acoes</span></div>
          {clients.map((client) => (
            <div className="client-table-row client-table-row-clickable" key={client.id} role="button" tabIndex={0} onClick={() => setSelectedClientId(client.id)} onKeyDown={(event) => event.key === "Enter" && setSelectedClientId(client.id)}>
              <span className="client-name-cell"><i>{client.name.slice(0, 1).toUpperCase()}</i><span><input value={client.name} onClick={(event) => event.stopPropagation()} onChange={(event) => updateClient(client.id, { name: event.target.value })} /><small>Cliente desde 12/01/2024</small></span></span>
              <span className={client.hasSquad ? "squad-positive" : "squad-muted"}>{client.hasSquad ? <UsersRound size={18} /> : <UserRound size={18} />}<span><strong>{client.hasSquad ? "Tem squad" : "Sem squad"}</strong><small>{client.hasSquad ? `Squad ${client.name}` : "Demanda sob demanda"}</small></span></span>
              <span className="hours-cell"><input min={0} type="number" value={client.squadHours || ""} disabled={!client.hasSquad} onClick={(event) => event.stopPropagation()} onChange={(event) => updateClient(client.id, { squadHours: Number(event.target.value) || 0 })} /><small>{client.hasSquad ? "Dedicadas ao desenvolvimento" : "Nao possui horas dedicadas"}</small></span>
              <span className="status-pill">Ativo</span>
              <span>Contato<small>contato@{client.name.toLowerCase().replace(/\s+/g, "")}.com</small></span>
              <span className="client-actions"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedClientId(client.id); }} aria-label={`Ver tarefas de ${client.name}`}><Settings size={16} /></button><button type="button" onClick={(event) => { event.stopPropagation(); onClientsChange(clients.filter((currentClient) => currentClient.id !== client.id)); }} aria-label={`Remover ${client.name}`}><X size={16} /></button></span>
            </div>
          ))}
        </div>
        <footer className="client-table-footer"><span>Mostrando 1 a {clients.length} de {clients.length} clientes</span><span>Itens por pagina: 10</span></footer>
      </section>
      {isClientModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsClientModalOpen(false)}>
          <section className="create-item-panel modal-panel client-create-modal" role="dialog" aria-modal="true" aria-labelledby="client-create-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2 id="client-create-title">Novo cliente</h2>
                <p>Cadastre o cliente e, se houver squad, informe as horas mensais.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setIsClientModalOpen(false)}>
                <X size={22} />
              </button>
            </header>
            <form>
              <label>
                <span>Nome do cliente</span>
                <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ex.: LXP" />
              </label>
              <label className="inline-check client-squad-check">
                <input checked={hasSquad} type="checkbox" onChange={(event) => setHasSquad(event.target.checked)} />
                <span>Cliente possui Squad</span>
              </label>
              {hasSquad && (
                <label>
                  <span>Horas dedicadas por mes</span>
                  <input min={0} type="number" value={squadHours} onChange={(event) => setSquadHours(event.target.value)} placeholder="Horas/mes" />
                </label>
              )}
            </form>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setIsClientModalOpen(false)}>Cancelar</button>
              <button className="primary-button" type="button" onClick={addClient}>Cadastrar cliente</button>
            </footer>
          </section>
        </div>
      )}
      <section className="workspace-panel clients-layout">
        <div className="settings-subpanel">
          <h3>Novo cliente</h3>
          <label>
            <span>Nome do cliente</span>
            <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Ex.: LXP" />
          </label>
          <label className="inline-check client-squad-check">
            <input checked={hasSquad} type="checkbox" onChange={(event) => setHasSquad(event.target.checked)} />
            <span>Cliente possui Squad</span>
          </label>
          {hasSquad && (
            <label>
              <span>Horas dedicadas</span>
              <input min={0} type="number" value={squadHours} onChange={(event) => setSquadHours(event.target.value)} placeholder="Horas/mês" />
            </label>
          )}
          <button className="primary-button" type="button" onClick={addClient}>Cadastrar cliente</button>
        </div>
        <div className="client-list">
          {clients.map((client) => (
            <article className={`client-row ${client.hasSquad ? "with-squad" : ""}`} key={client.id}>
              <span className="client-icon">{client.hasSquad ? <UsersRound size={18} /> : <Building2 size={18} />}</span>
              <input value={client.name} onChange={(event) => updateClient(client.id, { name: event.target.value })} aria-label={`Nome do cliente ${client.name}`} />
              <label className="inline-check">
                <input checked={client.hasSquad} type="checkbox" onChange={(event) => updateClient(client.id, { hasSquad: event.target.checked, squadHours: event.target.checked ? client.squadHours : 0 })} />
                <span>Squad</span>
              </label>
              <input min={0} type="number" value={client.squadHours || ""} disabled={!client.hasSquad} onChange={(event) => updateClient(client.id, { squadHours: Number(event.target.value) || 0 })} aria-label={`Horas de squad de ${client.name}`} />
              <button type="button" onClick={() => onClientsChange(clients.filter((currentClient) => currentClient.id !== client.id))} aria-label={`Remover ${client.name}`}>
                <X size={17} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ReportsPage({
  backlogColumns,
  boardColumns,
  categories,
  clients,
  theme,
  onToggleTheme
}: {
  backlogColumns: BacklogColumn[];
  boardColumns: BoardColumn[];
  categories: CategoryConfig[];
  clients: ClientAccount[];
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [periodStart, setPeriodStart] = useState(backlogColumns[0]?.title ?? "");
  const [periodEnd, setPeriodEnd] = useState(backlogColumns.at(-1)?.title ?? "");
  const backlogItemsForReports = flattenBacklogEntries(backlogColumns.flatMap((column) => column.entries));
  const categoryRows = categories.map((category) => ({ label: category.name, value: backlogItemsForReports.filter((item) => item.category === category.name).length, color: getBoardColorHex(category.color) }));
  const clientRows = clients.map((client) => ({ label: client.name, value: backlogItemsForReports.filter((item) => item.client === client.name).length, color: client.hasSquad ? "#7a5af8" : "#1f6fff" }));

  return (
    <main className="dashboard reports-page">
      <Topbar title="2. Relatorios" subtitle="Exportacao e visualizacao de metricas e analises do board." theme={theme} onToggleTheme={onToggleTheme} />
      <section className="workspace-panel reports-toolbar">
        <button className="primary-button export-pdf-button" type="button" onClick={() => window.print()}>Exportar PDF</button>
      </section>
      <section className="reports-grid">
        <ExecutionTimeChart
          periodEnd={periodEnd}
          periodStart={periodStart}
          rows={backlogColumns.map((column) => ({ label: column.title, value: 0, color: getBoardColorHex(column.color) }))}
          columns={backlogColumns}
          onPeriodEndChange={setPeriodEnd}
          onPeriodStartChange={setPeriodStart}
        />
        <ReportChart title="Media no Backlog" subtitle="Tempo medio por aba" rows={backlogColumns.map((column) => ({ label: column.title, value: 0, color: getBoardColorHex(column.color) }))} />
        <ReportChart title="Media no Board" subtitle="Local dos cards no sistema" rows={boardColumns.map((column) => ({ label: column.title, value: 0, color: getBoardColorHex(column.color) }))} />
        <ReportChart title="Categorias" subtitle="Proporcao de tarefas" rows={categoryRows} />
        <ReportChart title="Clientes" subtitle="Distribuicao por cliente" rows={clientRows} />
        <RollbackChart />
      </section>
    </main>
  );
}

type ApiTool = "linear" | "sheets" | "discord";

interface ApiSettings {
  discordWebhookUrl: string;
  linearApiKey: string;
  linearDefaultStateId: string;
  linearListWebhookUrl: string;
  linearProjectId: string;
  linearTeamId: string;
  linearToolWebhookUrl: string;
  linearWebhookSecret: string;
  sheetsWebhookUrl: string;
}

const defaultApiSettings: ApiSettings = {
  discordWebhookUrl: "",
  linearApiKey: "",
  linearDefaultStateId: "",
  linearListWebhookUrl: "/webhook/linear-update-listen",
  linearProjectId: "",
  linearTeamId: "",
  linearToolWebhookUrl: "/webhook/tool-update-n8n",
  linearWebhookSecret: "",
  sheetsWebhookUrl: ""
};
const apiSettingsStorageKey = "toolz-api-settings";

function ApisPage({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [selectedTool, setSelectedTool] = useState<ApiTool>("linear");
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    const storedSettings = window.localStorage.getItem(apiSettingsStorageKey);
    return storedSettings ? { ...defaultApiSettings, ...JSON.parse(storedSettings) } : defaultApiSettings;
  });
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/integrations/settings"))
      .then((response) => response.ok ? response.json() : defaultApiSettings)
      .then((settings: Partial<ApiSettings>) => {
        const storedSettings = window.localStorage.getItem(apiSettingsStorageKey);
        const localSettings = storedSettings ? JSON.parse(storedSettings) as Partial<ApiSettings> : {};
        setApiSettings({ ...defaultApiSettings, ...settings, ...localSettings });
      })
      .catch(() => setApiSettings(defaultApiSettings));
  }, []);

  function updateApiSetting(key: keyof ApiSettings, value: string) {
    setApiSettings((currentSettings) => ({ ...currentSettings, [key]: value }));
  }

  async function saveApiSettings() {
    setSaveStatus("Salvando...");
    window.localStorage.setItem(apiSettingsStorageKey, JSON.stringify(apiSettings));
    const response = await fetch(apiUrl("/api/integrations/settings"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiSettings)
    });

    setSaveStatus(response.ok ? "Configuracoes salvas." : "Nao foi possivel salvar.");
  }

  return (
    <main className="dashboard apis-page">
      <Topbar title="API's" subtitle="Configure URLs de integracao das ferramentas conectadas." theme={theme} onToggleTheme={onToggleTheme} />
      <section className="workspace-panel api-integrations-panel">
        <div className="integration-panel api-tools-grid">
          <IntegrationCard
            active={selectedTool === "linear"}
            logo="linear"
            items={["Workspace: Toolz.me", "Team: Product Owner"]}
            action="Configurar Linear"
            onClick={() => setSelectedTool("linear")}
          />
          <IntegrationCard
            active={selectedTool === "sheets"}
            logo="sheets"
            title="Google Sheets"
            items={["Planilha: Backlog Toolz.me", "Aba: Backlog"]}
            action="Configurar Google Sheets"
            onClick={() => setSelectedTool("sheets")}
          />
          <IntegrationCard
            active={selectedTool === "discord"}
            logo="discord"
            title="Discord"
            items={["Servidor: Toolz.me", "Canal: #produto"]}
            action="Configurar Discord"
            onClick={() => setSelectedTool("discord")}
          />
          <div className="info-callout">
            <span>i</span>
            Ao adicionar um novo item, ele pode ser enviado para as ferramentas conectadas por estes endpoints.
          </div>
        </div>

        <div className="api-settings-panel">
          {selectedTool === "linear" && (
            <>
              <h2>Linear</h2>
              <div className="api-fields-grid">
                <label>
                  <span>Chave API Linear</span>
                  <input value={apiSettings.linearApiKey} onChange={(event) => updateApiSetting("linearApiKey", event.target.value)} placeholder="lin_api_..." type="password" />
                </label>
                <label>
                  <span>Team ID</span>
                  <input value={apiSettings.linearTeamId} onChange={(event) => updateApiSetting("linearTeamId", event.target.value)} placeholder="TEAM_ID" />
                </label>
                <label>
                  <span>Project ID</span>
                  <input value={apiSettings.linearProjectId} onChange={(event) => updateApiSetting("linearProjectId", event.target.value)} placeholder="PROJECT_ID" />
                </label>
                <label>
                  <span>State ID padrao</span>
                  <input value={apiSettings.linearDefaultStateId} onChange={(event) => updateApiSetting("linearDefaultStateId", event.target.value)} placeholder="STATE_ID" />
                </label>
                <label>
                  <span>Linear envia para</span>
                  <input value={apiSettings.linearListWebhookUrl} onChange={(event) => updateApiSetting("linearListWebhookUrl", event.target.value)} placeholder="/webhook/linear-update-listen" />
                </label>
                <label>
                  <span>Toolzz envia para</span>
                  <input value={apiSettings.linearToolWebhookUrl} onChange={(event) => updateApiSetting("linearToolWebhookUrl", event.target.value)} placeholder="/webhook/tool-update-n8n" />
                </label>
                <label>
                  <span>Segredo webhook</span>
                  <input value={apiSettings.linearWebhookSecret} onChange={(event) => updateApiSetting("linearWebhookSecret", event.target.value)} placeholder="Opcional" type="password" />
                </label>
              </div>
            </>
          )}
          {selectedTool === "sheets" && (
            <>
              <h2>Google Sheets</h2>
              <label>
                <span>URL de integracao</span>
                <input value={apiSettings.sheetsWebhookUrl} onChange={(event) => updateApiSetting("sheetsWebhookUrl", event.target.value)} placeholder="https://..." />
              </label>
            </>
          )}
          {selectedTool === "discord" && (
            <>
              <h2>Discord</h2>
              <label>
                <span>URL de integracao</span>
                <input value={apiSettings.discordWebhookUrl} onChange={(event) => updateApiSetting("discordWebhookUrl", event.target.value)} placeholder="https://discord.com/api/webhooks/..." />
              </label>
            </>
          )}
          <footer className="api-settings-footer">
            <span>{saveStatus}</span>
            <button className="primary-button" type="button" onClick={saveApiSettings}>Salvar configuracoes</button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function ExecutionTimeChart({
  columns,
  onPeriodEndChange,
  onPeriodStartChange,
  periodEnd,
  periodStart,
  rows
}: {
  columns: BacklogColumn[];
  onPeriodEndChange: (value: string) => void;
  onPeriodStartChange: (value: string) => void;
  periodEnd: string;
  periodStart: string;
  rows: Array<{ label: string; value: number; color: string }>;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <article className="report-card execution-report-card">
      <header className="report-card-header-with-filters">
        <div>
          <h2>Tempo de execucao</h2>
          <span>{periodStart} ate {periodEnd}</span>
        </div>
        <div className="execution-period-filters">
          <label>
            <span>De</span>
            <select value={periodStart} onChange={(event) => onPeriodStartChange(event.target.value)}>
              {columns.map((column) => <option key={column.title}>{column.title}</option>)}
            </select>
          </label>
          <label>
            <span>Para</span>
            <select value={periodEnd} onChange={(event) => onPeriodEndChange(event.target.value)}>
              {columns.map((column) => <option key={column.title}>{column.title}</option>)}
            </select>
          </label>
        </div>
      </header>
      <div className="report-stat-strip">
        <span><strong>0</strong>Tempo medio</span>
        <span><strong>0</strong>Mediana</span>
        <span><strong>0</strong>Maximo</span>
      </div>
      <div className="bar-chart">
        {rows.map((row) => (
          <div className="bar-row" key={row.label}>
            <span>{row.label}</span>
            <div><i style={{ width: `${Math.max((row.value / maxValue) * 100, row.value ? 8 : 0)}%`, background: row.color }} /></div>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ReportChart({ title, subtitle, rows }: { title: string; subtitle: string; rows: Array<{ label: string; value: number; color: string }> }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (title === "Categorias" || title === "Clientes") {
    return (
      <article className="report-card donut-report">
        <header><h2>{title}</h2><span>{subtitle}</span></header>
        <div className="donut-report-body">
          <div className="donut-chart" style={{ background: `conic-gradient(${rows.map((row, index) => `${row.color} ${index * (100 / rows.length)}% ${(index + 1) * (100 / rows.length)}%`).join(", ")})` }} />
          <div className="donut-legend">
            {rows.map((row) => <span key={row.label}><i style={{ background: row.color }} />{row.label}<strong>{total ? Math.round((row.value / total) * 100) : 0}%</strong></span>)}
          </div>
        </div>
        <footer>Total: {total} cards</footer>
      </article>
    );
  }

  if (title.includes("Media")) {
    return (
      <article className="report-card table-report">
        <header><h2>{title}</h2><span>{subtitle}</span></header>
        <div className="report-mini-table">
          <div><span>Etapa</span><span>Media</span><span>% ciclo</span><span>WIP</span></div>
          {rows.map((row) => (
            <div key={row.label}><span><i style={{ background: row.color }} />{row.label}</span><span>{row.value}</span><span>0%</span><strong>0</strong></div>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="report-card">
      <header>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </header>
      {title.includes("Tempo") && (
        <div className="report-stat-strip">
          <span><strong>0</strong>Tempo medio</span>
          <span><strong>0</strong>Mediana</span>
          <span><strong>0</strong>Maximo</span>
        </div>
      )}
      <div className="bar-chart">
        {rows.map((row) => (
          <div className="bar-row" key={row.label}>
            <span>{row.label}</span>
            <div><i style={{ width: `${Math.max((row.value / maxValue) * 100, row.value ? 8 : 0)}%`, background: row.color }} /></div>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function RollbackChart() {
  const rollbackData = [
    { date: "01/05", backlog: 0, board: 0 },
    { date: "06/05", backlog: 0, board: 0 },
    { date: "11/05", backlog: 0, board: 0 },
    { date: "16/05", backlog: 0, board: 0 },
    { date: "21/05", backlog: 0, board: 0 },
    { date: "26/05", backlog: 0, board: 0 },
    { date: "31/05", backlog: 0, board: 0 }
  ];

  return (
    <article className="report-card rollback-report-card">
      <header>
        <h2>Taxa de rollback</h2>
        <span>Backlog x Board</span>
      </header>
      <div className="line-chart">
        <ResponsiveContainer height={260} width="100%">
          <LineChart data={rollbackData} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} width={34} />
            <Tooltip contentStyle={{ border: "1px solid #e1e6ef", borderRadius: 8, boxShadow: "0 12px 28px rgba(31, 47, 73, 0.12)" }} />
            <Line type="monotone" dataKey="backlog" name="Backlog" stroke="#7a5af8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="board" name="Board" stroke="#17b26a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend"><span><i style={{ background: "#7a5af8" }} />Backlog</span><span><i style={{ background: "#17b26a" }} />Board</span></div>
    </article>
  );
}

function CeremoniesPage({
  backlogColumns,
  boardColumns,
  dailyRecords,
  planningRecords,
  sprintBacklogItems,
  retrospectives,
  sprints,
  sprintStatuses,
  onDailyRecordsChange,
  onPlanningRecordsChange,
  onRetrospectivesChange,
  theme,
  onToggleTheme
}: {
  backlogColumns: BacklogColumn[];
  boardColumns: BoardColumn[];
  dailyRecords: DailyRecord[];
  planningRecords: PlanningRecord[];
  sprintBacklogItems: BacklogItem[];
  retrospectives: Retrospective[];
  sprints: SprintPlan[];
  sprintStatuses: SprintStatus[];
  onDailyRecordsChange: (dailyRecords: DailyRecord[]) => void;
  onPlanningRecordsChange: (planningRecords: PlanningRecord[]) => void;
  onRetrospectivesChange: (retrospectives: Retrospective[]) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [ceremony, setCeremony] = useState<"Planning" | "Daily" | "Review" | "Retrospectiva">("Planning");

  return (
    <main className="dashboard ceremonies-page">
      <Topbar title="3. Cerimonias" subtitle="Acompanhe e conduza as cerimonias do time de forma estruturada." theme={theme} onToggleTheme={onToggleTheme} />
      <section className="workspace-panel ceremony-model-panel">
        <div className="segmented-control ceremony-tabs">
          {["Planning", "Daily", "Review", "Retrospectiva"].map((item) => (
            <button className={ceremony === item ? "active" : ""} type="button" key={item} onClick={() => setCeremony(item as typeof ceremony)}>{item}</button>
          ))}
        </div>
        {ceremony === "Planning" && <PlanningCeremony backlogColumns={backlogColumns} planningRecords={planningRecords} onPlanningRecordsChange={onPlanningRecordsChange} sprints={sprints} />}
        {ceremony === "Daily" && <DailyCeremony boardColumns={boardColumns} dailyRecords={dailyRecords} onDailyRecordsChange={onDailyRecordsChange} sprintBacklogItems={sprintBacklogItems} sprints={sprints} sprintStatuses={sprintStatuses} />}
        {ceremony === "Review" && <ReviewCeremony boardColumns={boardColumns} sprints={sprints} />}
        {ceremony === "Retrospectiva" && <RetroCeremony retrospectives={retrospectives} onRetrospectivesChange={onRetrospectivesChange} />}
      </section>
    </main>
  );
}

function PlanningCeremony({
  backlogColumns,
  planningRecords,
  onPlanningRecordsChange,
  sprints
}: {
  backlogColumns: BacklogColumn[];
  planningRecords: PlanningRecord[];
  onPlanningRecordsChange: (planningRecords: PlanningRecord[]) => void;
  sprints: SprintPlan[];
}) {
  const [selectedPlanningId, setSelectedPlanningId] = useState("");
  const [mode, setMode] = useState<"list" | "create" | "detail">("list");
  const [isPresentationExpanded, setIsPresentationExpanded] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState(sprints.find((currentSprint) => currentSprint.statusId === "active")?.id ?? sprints[0]?.id ?? "");
  const sprint = sprints.find((currentSprint) => currentSprint.id === selectedSprintId) ?? sprints[0];
  const selectedRecord = planningRecords.find((planning) => planning.id === selectedPlanningId);
  const sprintItems = getPlanningItemsForSprint(backlogColumns, sprint?.name);
  const activePlanning = mode === "detail" ? selectedRecord : undefined;
  const items = activePlanning?.items ?? [];
  const totalPoints = items.reduce((total, item) => total + (item.storyPoints ?? 0), 0);
  const selectedItem = items[0];
  const slideTotal = Math.max(items.length + 1, 1);

  function createPlanning() {
    setMode("create");
    setSelectedPlanningId("");
  }

  function generatePlanning() {
    if (!sprint) {
      return;
    }

    const planning: PlanningRecord = {
      id: `planning-${Date.now()}`,
      title: `Planning - ${sprint.name}`,
      sprintId: sprint.id,
      sprintName: sprint.name,
      start: sprint.start,
      end: sprint.end,
      objective: sprint.objective,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      items: sprintItems.map((item) => ({ ...item }))
    };

    onPlanningRecordsChange([planning, ...planningRecords]);
    setSelectedPlanningId(planning.id);
    setMode("detail");
  }

  function deletePlanning(planningId: string) {
    if (!window.confirm("Deseja excluir esta planning?")) {
      return;
    }

    onPlanningRecordsChange(planningRecords.filter((planning) => planning.id !== planningId));
    if (selectedPlanningId === planningId) {
      setSelectedPlanningId("");
      setMode("list");
    }
  }

  function openPlanning(planningId: string) {
    setSelectedPlanningId(planningId);
    setMode("detail");
  }

  if (mode === "list") {
    return (
      <div className="planning-history-layout">
        <section className="ceremony-presentation planning-history-panel">
          <header className="planning-history-header">
            <div>
              <h2>Plannings</h2>
              <p>Acesse o historico das plannings geradas ou crie uma nova apresentacao.</p>
            </div>
            <button className="primary-button" type="button" onClick={createPlanning}><Plus size={16} />Nova Planning</button>
          </header>
          {planningRecords.length > 0 ? (
            <div className="planning-history-list">
              {planningRecords.map((planning) => (
                <article className="planning-history-item" key={planning.id}>
                  <div>
                    <span>{planning.sprintName}</span>
                    <h3>{planning.title}</h3>
                    <p>{planning.start} - {planning.end} - {planning.items.length} tarefas - criada em {planning.createdAt}</p>
                  </div>
                  <strong>{planning.items.reduce((total, item) => total + (item.storyPoints ?? 0), 0)} pts</strong>
                  <button type="button" onClick={() => openPlanning(planning.id)}>Acessar</button>
                  <button className="danger-icon-button" type="button" onClick={() => deletePlanning(planning.id)} aria-label="Excluir planning"><X size={16} /></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="planning-empty-state">
              <Rocket size={42} />
              <h3>Nenhuma planning criada</h3>
              <p>Crie uma nova planning para salvar o objetivo da sprint e as tarefas incluidas naquele momento.</p>
            </div>
          )}
        </section>
        <aside className="ceremony-context-panel">
          <h3>Sobre a Cerimonia</h3>
          <strong>Planning</strong>
          <p>O historico guarda cada apresentacao gerada, com objetivo, periodo, pontos e tarefas da sprint selecionada.</p>
          <hr />
          <strong>O que sera incluido</strong>
          <ul><li>Informacoes da sprint</li><li>Snapshot das tarefas da sprint</li><li>Resumo de pontos</li><li>Detalhes de cada card</li></ul>
        </aside>
        <CeremonySteps />
      </div>
    );
  }

  return (
    <div className="ceremony-model-grid">
      <aside className="ceremony-config-panel">
        <button className="secondary-button" type="button" onClick={() => setMode("list")}><ChevronLeft size={16} />Voltar ao historico</button>
        <h3>{mode === "detail" ? "Planning salva" : "Configurar Planning"}</h3>
        <label><span>Selecione a Sprint</span><select value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)}>{sprints.map((currentSprint) => <option value={currentSprint.id} key={currentSprint.id}>{currentSprint.name}</option>)}</select></label>
        <div className="planning-sprint-preview"><strong>{sprintItems.length}</strong><span>tarefas vinculadas a {sprint?.name ?? "sprint"}</span></div>
        {mode === "create" && <button className="primary-button" type="button" onClick={generatePlanning}>Gerar apresentacao <Play size={15} /></button>}
        {mode === "detail" && selectedRecord && <button className="danger-secondary-button" type="button" onClick={() => deletePlanning(selectedRecord.id)}>Excluir planning</button>}
        <div className="ceremony-help-card"><strong>Sobre o Planning</strong><p>A apresentacao usa automaticamente os cards vinculados a sprint escolhida. Os dados aparecem somente apos gerar a apresentacao.</p></div>
      </aside>
      <section className={`ceremony-presentation ${isPresentationExpanded ? "ceremony-presentation-expanded" : ""}`}>
        {activePlanning ? (
          <>
            <header className="presentation-toolbar">
              <div className="presentation-nav"><button type="button" aria-label="Slide anterior"><ChevronLeft size={16} /></button><span>1 / {slideTotal}</span><button type="button" aria-label="Proximo slide"><ChevronRight size={16} /></button></div>
              <div className="presentation-actions"><button type="button" onClick={() => setIsPresentationExpanded((current) => !current)}><LayoutGrid size={15} />{isPresentationExpanded ? "Sair da tela cheia" : "Tela cheia"}</button><button type="button" onClick={() => window.print()}><FileSpreadsheet size={15} />Exportar PDF</button>{isPresentationExpanded && <button type="button" onClick={() => setIsPresentationExpanded(false)} aria-label="Fechar tela cheia"><X size={16} /></button>}</div>
            </header>
            <article className="planning-hero-slide ceremony-slide">
              <div className="planning-hero-copy"><span>{activePlanning.sprintName}</span><h2>Planning</h2><p>{activePlanning.start} - {activePlanning.end} (14 dias)</p></div>
              <div className="planning-target"><Rocket size={66} /><CalendarDays size={42} /></div>
              <div className="planning-kpis"><span><small>Objetivo da Sprint</small>{activePlanning.objective}</span><span><small>Story Points Total</small><strong>{totalPoints}</strong> pts</span><span><small>Tarefas</small><strong>{items.length}</strong> tarefas</span><span><small>Membros</small><strong>{boardMembers.length}</strong> membros</span><span><small>Progresso</small><strong>0%</strong> iniciado</span></div>
            </article>
            <article className="planning-task-slide ceremony-slide">
              <span className="slide-count">1 / {Math.max(items.length, 1)}</span>
              <h3>{selectedItem?.name ?? "Nenhuma tarefa vinculada"}</h3>
              <div className="slide-tags"><Badge tone="blue">{selectedItem?.category ?? "Categoria"}</Badge><Badge tone="yellow">{selectedItem?.priority ?? "Media"}</Badge><Badge tone="blue">{selectedItem?.client ?? "Cliente"}</Badge></div>
              <p>{selectedItem ? "Permitir que o time visualize o contexto, prioridade e informacoes principais do card." : "A planning foi gerada sem tarefas vinculadas a esta sprint."}</p>
              <div className="task-slide-grid"><span><small>Responsavel</small>{selectedItem?.owner || "Sem responsavel"}</span><span><small>Estimativa</small>16h</span><span><small>Origem</small>Sprint</span><span><small>Sprint</small>{activePlanning.sprintName}</span><strong>{selectedItem?.storyPoints ?? 0} pts</strong></div>
            </article>
            <div className="slide-dots">{Array.from({ length: Math.min(Math.max(items.length, 6), 14) }).map((_, index) => <i className={index === 0 ? "active" : ""} key={index} />)}</div>
          </>
        ) : (
          <div className="planning-generate-placeholder">
            <Rocket size={48} />
            <h2>Configure a sprint e gere a apresentacao</h2>
            <p>As informacoes da planning e das tarefas serao exibidas aqui somente depois de pressionar Gerar apresentacao.</p>
          </div>
        )}
      </section>
      <aside className="ceremony-context-panel">
        <h3>Sobre a Cerimonia</h3><strong>Planning</strong><p>Apresentacao com visao geral da sprint e detalhamento de todas as atividades da aba selecionada.</p>
        <hr /><strong>O que sera incluido</strong><ul><li>Informacoes da sprint</li><li>Resumo de pontos e tarefas</li><li>Cards vinculados a sprint</li><li>Detalhes de cada card</li></ul>
        <div className="ceremony-tip">Use as setas para navegar entre os slides.</div>
      </aside>
      <CeremonySteps />
    </div>
  );
}

function DailyCeremony({
  boardColumns,
  dailyRecords,
  onDailyRecordsChange,
  sprintBacklogItems,
  sprints,
  sprintStatuses
}: {
  boardColumns: BoardColumn[];
  dailyRecords: DailyRecord[];
  onDailyRecordsChange: (dailyRecords: DailyRecord[]) => void;
  sprintBacklogItems: BacklogItem[];
  sprints: SprintPlan[];
  sprintStatuses: SprintStatus[];
}) {
  const [selectedDailyId, setSelectedDailyId] = useState("");
  const [screenMode, setScreenMode] = useState<"list" | "create" | "detail">("list");
  const [isPresentationExpanded, setIsPresentationExpanded] = useState(false);
  const activeSprint = getActiveSprint(sprints, sprintStatuses);
  const [selectedSprintId, setSelectedSprintId] = useState(activeSprint?.id ?? sprints[0]?.id ?? "");
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [displayMode, setDisplayMode] = useState<"membro" | "tarefas">("membro");
  const [selectedDailyColumnIndex, setSelectedDailyColumnIndex] = useState(0);
  const [selectedDailyMemberIndex, setSelectedDailyMemberIndex] = useState(0);
  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) ?? activeSprint ?? sprints[0];
  const sprintColumns = selectedSprint
    ? mergeBoardColumnsWithSprintConnections(boardColumns, sprintBacklogItems, selectedSprint.name)
    : boardColumns;
  const allSprintCards = sprintColumns.flatMap((column) => column.cards);
  const selectedDaily = dailyRecords.find((daily) => daily.id === selectedDailyId);
  const activeDaily = screenMode === "detail" ? selectedDaily : undefined;
  const cards = activeDaily?.cards ?? [];
  const activeDailyColumn = activeDaily?.columns[selectedDailyColumnIndex] ?? activeDaily?.columns[0];
  const dailyMembers = getDailyMembers(cards);
  const activeDailyMember = dailyMembers[selectedDailyMemberIndex] ?? dailyMembers[0] ?? "Sem responsavel";
  const activeMemberColumns = activeDaily?.columns
    .map((column) => ({
      ...column,
      cards: column.cards.filter((card) => isDailyCardForMember(card, activeDailyMember))
    }))
    .filter((column) => column.cards.length > 0) ?? [];
  const visibleDailyCards = activeDaily?.displayMode === "tarefas"
    ? activeDailyColumn?.cards ?? []
    : activeMemberColumns.flatMap((column) => column.cards);

  useEffect(() => {
    if (selectedDailyMemberIndex >= dailyMembers.length) {
      setSelectedDailyMemberIndex(0);
    }
  }, [dailyMembers.length, selectedDailyMemberIndex]);

  function createDaily() {
    setSelectedDailyId("");
    setScreenMode("create");
  }

  function generateDaily() {
    if (!selectedSprint) {
      return;
    }

    const daily: DailyRecord = {
      id: `daily-${Date.now()}`,
      title: `Daily - ${selectedSprint.name}`,
      date: dailyDate,
      sprintId: selectedSprint.id,
      sprintName: selectedSprint.name,
      displayMode,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      cards: allSprintCards.map((card) => ({ ...card })),
      columns: sprintColumns.map((column) => ({
        title: column.title,
        color: column.color,
        cards: column.cards.map((card) => ({ ...card }))
      }))
    };

    onDailyRecordsChange([daily, ...dailyRecords]);
    setSelectedDailyId(daily.id);
    setScreenMode("detail");
  }

  function deleteDaily(dailyId: string) {
    if (!window.confirm("Deseja excluir esta daily?")) {
      return;
    }

    onDailyRecordsChange(dailyRecords.filter((daily) => daily.id !== dailyId));
    if (selectedDailyId === dailyId) {
      setSelectedDailyId("");
      setScreenMode("list");
    }
  }

  if (screenMode === "list") {
    return (
      <div className="planning-history-layout">
        <section className="ceremony-presentation planning-history-panel">
          <header className="planning-history-header">
            <div>
              <h2>Dailys</h2>
              <p>Acesse o historico das dailys geradas ou crie uma nova apresentacao.</p>
            </div>
            <button className="primary-button" type="button" onClick={createDaily}><Plus size={16} />Nova Daily</button>
          </header>
          {dailyRecords.length > 0 ? (
            <div className="planning-history-list">
              {dailyRecords.map((daily) => (
                <article className="planning-history-item" key={daily.id}>
                  <div>
                    <span>{daily.displayMode === "membro" ? "Membros" : "Tarefas"}</span>
                    <h3>{daily.title}</h3>
                    <p>{daily.sprintName} - {daily.displayMode === "membro" ? "Modo responsavel" : "Modo abas"} - {daily.cards.length} cards - criada em {daily.createdAt}</p>
                  </div>
                  <strong>{daily.cards.length}</strong>
                  <button type="button" onClick={() => { setSelectedDailyId(daily.id); setScreenMode("detail"); }}>Acessar</button>
                  <button className="danger-icon-button" type="button" onClick={() => deleteDaily(daily.id)} aria-label="Excluir daily"><X size={16} /></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="planning-empty-state">
              <CalendarDays size={42} />
              <h3>Nenhuma daily criada</h3>
              <p>Crie uma nova daily para salvar data, modo, aba escolhida e cards incluidos.</p>
            </div>
          )}
        </section>
        <aside className="ceremony-context-panel"><h3>Sobre a Cerimonia</h3><strong>Daily</strong><p>O historico guarda cada apresentacao gerada, com os cards da sprint no momento da criacao.</p><hr /><strong>O que sera incluido</strong><ul><li>Data selecionada</li><li>Sprint selecionada</li><li>Todas as abas da sprint</li><li>Resumo por responsavel</li></ul></aside>
        <CeremonySteps />
      </div>
    );
  }

  return (
    <div className="ceremony-model-grid">
      <aside className="ceremony-config-panel"><button className="secondary-button" type="button" onClick={() => setScreenMode("list")}><ChevronLeft size={16} />Voltar ao historico</button><h3>{screenMode === "detail" ? "Daily salva" : "Configurar Daily"}</h3><label><span>Selecione a data</span><input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} /></label><label><span>Selecione a sprint</span><select value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)}>{sprints.map((sprint) => <option value={sprint.id} key={sprint.id}>{sprint.name}</option>)}</select></label><label><span>Modo da Daily</span><select value={displayMode} onChange={(event) => setDisplayMode(event.target.value as "membro" | "tarefas")}><option value="membro">Por responsavel</option><option value="tarefas">Por aba</option></select></label><div className="planning-sprint-preview"><strong>{allSprintCards.length}</strong><span>cards em {sprintColumns.length} abas da {selectedSprint?.name ?? "sprint"}</span></div>{screenMode === "create" && <button className="primary-button" type="button" onClick={generateDaily}>Gerar apresentacao <Play size={15} /></button>}{screenMode === "detail" && activeDaily && <button className="danger-secondary-button" type="button" onClick={() => deleteDaily(activeDaily.id)}>Excluir daily</button>}<div className="ceremony-help-card"><strong>Sobre a Daily</strong><p>O modo por responsavel cria uma pagina por pessoa e agrupa os cards pelas abas da sprint.</p></div></aside>
      <section className={`ceremony-presentation daily-presentation ${isPresentationExpanded ? "ceremony-presentation-expanded" : ""}`}>
        {activeDaily ? (
          <>
            <header className="presentation-toolbar"><div><strong>Apresentacao - Daily ({activeDaily.displayMode === "membro" ? "Por responsavel" : "Por aba"})</strong><p>{activeDaily.sprintName} - {activeDaily.date}</p></div><div className="presentation-actions"><button type="button" onClick={() => setIsPresentationExpanded((current) => !current)}><LayoutGrid size={15} />{isPresentationExpanded ? "Sair da tela cheia" : "Tela cheia"}</button>{isPresentationExpanded && <button type="button" onClick={() => setIsPresentationExpanded(false)} aria-label="Fechar tela cheia"><X size={16} /></button>}</div></header>
            <div className="daily-slide-layout ceremony-slide">
              <nav className="daily-slide-nav">
                {activeDaily.displayMode === "membro"
                  ? dailyMembers.map((member, index) => <button className={index === selectedDailyMemberIndex ? "active" : ""} key={member} type="button" onClick={() => setSelectedDailyMemberIndex(index)}><span className="owner-pill">{getMemberInitials(member)}</span><strong>{member}</strong><small>{cards.filter((card) => isDailyCardForMember(card, member)).length} atividades</small></button>)
                  : activeDaily.columns.map((column, index) => <button className={index === selectedDailyColumnIndex ? "active" : ""} key={column.title} type="button" onClick={() => setSelectedDailyColumnIndex(index)}><span className="owner-pill" style={{ background: getBoardColorHex(column.color) }}>{index + 1}</span><strong>{column.title}</strong><small>{column.cards.length} atividades</small></button>)}
              </nav>
              <article className="daily-slide-main">
                <div className="daily-slide-head">
                  <span className="owner-pill" style={activeDaily.displayMode === "tarefas" ? { background: getBoardColorHex(activeDailyColumn?.color ?? "blue") } : undefined}>{activeDaily.displayMode === "membro" ? getMemberInitials(activeDailyMember) : selectedDailyColumnIndex + 1}</span>
                  <div><h2>{activeDaily.displayMode === "membro" ? activeDailyMember : activeDailyColumn?.title ?? "Aba"}</h2><p>{activeDaily.sprintName} - {activeDaily.date}</p></div>
                  <strong>{activeDaily.displayMode === "membro" ? selectedDailyMemberIndex + 1 : selectedDailyColumnIndex + 1} / {activeDaily.displayMode === "membro" ? dailyMembers.length : activeDaily.columns.length}</strong>
                </div>
                <section className="daily-period-panel">
                  <header><h3>{activeDaily.displayMode === "membro" ? "Cards por aba" : "Cards da aba"}</h3><span>{visibleDailyCards.length} cards</span></header>
                  {activeDaily.displayMode === "membro" ? (
                    <div className="daily-member-column-list">
                      {activeMemberColumns.length > 0 ? activeMemberColumns.map((column) => (
                        <div className="daily-member-column" key={`${activeDaily.id}-${activeDailyMember}-${column.title}`}>
                          <strong style={{ borderColor: getBoardColorHex(column.color) }}>{column.title}</strong>
                          <div className="daily-task-list">
                            {column.cards.map((card) => <DailyTaskPill card={card} key={`${column.title}-${card.id}`} />)}
                          </div>
                        </div>
                      )) : <p>Nenhum card para este responsavel nesta sprint.</p>}
                    </div>
                  ) : (
                    <div className="daily-task-list">
                      {visibleDailyCards.length > 0 ? visibleDailyCards.map((card) => <DailyTaskPill card={card} key={`${activeDailyColumn?.title}-${card.id}`} />) : <p>Nenhuma atividade nesta aba da sprint.</p>}
                    </div>
                  )}
                </section>
                <footer className="daily-slide-footer">
                  <button type="button" onClick={() => activeDaily.displayMode === "membro" ? setSelectedDailyMemberIndex((index) => Math.max(index - 1, 0)) : setSelectedDailyColumnIndex((index) => Math.max(index - 1, 0))}><ChevronLeft size={16} />Anterior</button>
                  <button type="button" onClick={() => activeDaily.displayMode === "membro" ? setSelectedDailyMemberIndex((index) => Math.min(index + 1, dailyMembers.length - 1)) : setSelectedDailyColumnIndex((index) => Math.min(index + 1, activeDaily.columns.length - 1))}>Proximo<ChevronRight size={16} /></button>
                </footer>
              </article>
            </div>
            <div className="slide-dots">{Array.from({ length: activeDaily.displayMode === "tarefas" ? activeDaily.columns.length : dailyMembers.length }).map((_, index) => <i className={index === (activeDaily.displayMode === "tarefas" ? selectedDailyColumnIndex : selectedDailyMemberIndex) ? "active" : ""} key={index} />)}</div>
          </>
        ) : (
          <div className="planning-generate-placeholder"><CalendarDays size={48} /><h2>Configure a daily e gere a apresentacao</h2><p>Os cards e agrupamentos da daily serao exibidos aqui somente depois de pressionar Gerar apresentacao.</p></div>
        )}
      </section>
      <aside className="ceremony-context-panel"><h3>Sobre a Cerimonia</h3><strong>Daily</strong><p>Apresentacao por responsavel ou por aba com todos os cards da sprint selecionada.</p><hr /><strong>O que sera incluido</strong><ul><li>Cards de todas as abas da sprint</li><li>Uma pagina por responsavel</li><li>Resumo por aba</li></ul><div className="ceremony-tip">No modo por responsavel, cada pessoa vira uma pagina da apresentacao.</div></aside>
      <CeremonySteps />
    </div>
  );
}

function getDailyCardParticipants(card: BoardCard) {
  return [card.owner, ...(card.assistants ?? [])]
    .map((member) => member?.trim())
    .filter((member): member is string => Boolean(member));
}

function isDailyCardForMember(card: BoardCard, member: string) {
  return getDailyCardParticipants(card).includes(member);
}

function getDailyMembers(cards: BoardCard[]) {
  const members = Array.from(new Set(cards.flatMap(getDailyCardParticipants)));

  if (members.length === 0) {
    return ["Sem responsavel"];
  }

  return members.sort((firstMember, secondMember) => {
    if (firstMember === "Sem responsavel") return 1;
    if (secondMember === "Sem responsavel") return -1;
    return firstMember.localeCompare(secondMember);
  });
}

function DailyTaskPill({ card }: { card: BoardCard }) {
  return (
    <span className="daily-task-pill">
      <strong>{card.id}</strong>
      <small>{card.title}</small>
      <em>{card.priority} - {card.points || 0} pts</em>
    </span>
  );
}

function CeremonySteps() {
  return (
    <section className="ceremony-steps"><h3>Como funciona</h3>{["Nova Planning", "Selecione a Sprint", "Gere a Apresentacao", "Consulte o Historico"].map((step, index) => <article key={step}><span>{index + 1}</span><strong>{step}</strong><p>{index === 0 ? "Abra uma nova configuracao." : index === 1 ? "Escolha a sprint planejada." : index === 2 ? "O sistema salva os slides." : "Acesse ou exclua depois."}</p></article>)}</section>
  );
}

function getPlanningItemsForSprint(backlogColumns: BacklogColumn[], sprintName?: string) {
  if (!sprintName) {
    return [];
  }

  return backlogColumns.flatMap((column) => flattenBacklogEntries(column.entries)).filter((item) => item.sprint === sprintName);
}

function ReviewCeremony({ boardColumns, sprints }: { boardColumns: BoardColumn[]; sprints: SprintPlan[] }) {
  const [selectedSprintId, setSelectedSprintId] = useState(sprints[0]?.id ?? "");
  const doneCards = boardColumns.flatMap((column) => column.cards.filter((card) => column.title.toLowerCase().includes("aprovado") || card.done));
  const sprint = sprints.find((currentSprint) => currentSprint.id === selectedSprintId) ?? sprints[0];

  return (
    <div className="ceremony-model-grid">
      <aside className="ceremony-config-panel"><h3>Configurar Review</h3><label><span>Selecione a Sprint</span><select value={selectedSprintId} onChange={(event) => setSelectedSprintId(event.target.value)}>{sprints.map((currentSprint) => <option value={currentSprint.id} key={currentSprint.id}>{currentSprint.name}</option>)}</select></label><button className="primary-button" type="button">Gerar apresentacao <Play size={15} /></button><div className="ceremony-help-card"><strong>Sobre a Review</strong><p>Use a review para apresentar entregas, resultados e aprendizados da sprint.</p></div></aside>
      <section className="ceremony-presentation"><header className="presentation-toolbar"><div className="presentation-nav"><button type="button"><ChevronLeft size={16} /></button><span>1 / {Math.max(doneCards.length + 1, 1)}</span><button type="button"><ChevronRight size={16} /></button></div><div className="presentation-actions"><button type="button"><LayoutGrid size={15} />Tela cheia</button><button type="button" onClick={() => window.print()}><FileSpreadsheet size={15} />Exportar PDF</button></div></header><article className="planning-hero-slide ceremony-slide"><div className="planning-hero-copy"><span>{sprint?.name ?? "Sprint"}</span><h2>Review</h2><p>{sprint?.start} - {sprint?.end}</p></div><div className="planning-target"><CheckCircle2 size={66} /><CalendarDays size={42} /></div><div className="planning-kpis"><span><small>Objetivo</small>{sprint?.objective}</span><span><small>Entregas</small><strong>{doneCards.length}</strong> cards</span><span><small>Membros</small><strong>{boardMembers.length}</strong> membros</span><span><small>Progresso</small><strong>100%</strong> demo</span></div></article><article className="planning-task-slide ceremony-slide"><span className="slide-count">1 / {Math.max(doneCards.length, 1)}</span><h3>{doneCards[0]?.title ?? "Nenhuma entrega concluida"}</h3><p>{doneCards[0] ? "Card pronto para apresentacao na review da sprint." : "Cards aprovados aparecerao aqui quando existirem entregas."}</p><div className="task-slide-grid"><span><small>Responsavel</small>{doneCards[0]?.owner || "Sem responsavel"}</span><span><small>Prioridade</small>{doneCards[0]?.priority ?? "Media"}</span><span><small>Story Points</small>{doneCards[0]?.points ?? 0} pts</span><span><small>Sprint</small>{sprint?.name}</span><strong>{doneCards[0]?.points ?? 0} pts</strong></div></article><div className="slide-dots">{Array.from({ length: 6 }).map((_, index) => <i className={index === 0 ? "active" : ""} key={index} />)}</div></section>
      <aside className="ceremony-context-panel"><h3>Sobre a Cerimonia</h3><strong>Review</strong><p>Mostra entregas finalizadas e ajuda a conduzir a demonstracao para stakeholders.</p><hr /><strong>O que sera incluido</strong><ul><li>Resumo da sprint</li><li>Cards concluidos</li><li>Responsaveis e pontos</li></ul><div className="ceremony-tip">Prepare a ordem dos cards antes da reuniao.</div></aside>
      <CeremonySteps />
    </div>
  );
}

function TaskSlide({ item }: { item: BacklogItem }) {
  return (
    <article className="slide-page task-slide">
      <span>#{item.order}</span>
      <h2>{item.name}</h2>
      <p>{item.category} · {item.priority} · {item.sprint}</p>
      <div className="slide-meta">
        <span>{item.owner || "Sem responsavel"}</span>
        <span>{item.storyPoints ?? 0} SP</span>
        <span>{item.client || "Sem cliente"}</span>
      </div>
    </article>
  );
}

function DailyMemberSlide({ member, cards }: { member: string; cards: BoardCard[] }) {
  return (
    <article className="slide-page task-slide">
      <span>{member}</span>
      <h2>Daily do membro</h2>
      <p>Movimentacoes de ontem e atividades da aba selecionada.</p>
      <div className="slide-list">{cards.map((card) => <span key={card.id}>{card.title}</span>)}</div>
    </article>
  );
}

function RetroCeremony({ retrospectives, onRetrospectivesChange }: { retrospectives: Retrospective[]; onRetrospectivesChange: (retrospectives: Retrospective[]) => void }) {
  const [screenMode, setScreenMode] = useState<"list" | "create" | "detail">("list");
  const [selectedRetroId, setSelectedRetroId] = useState("");
  const [retroTitle, setRetroTitle] = useState(`Retro ${retrospectives.length + 1}`);
  const [editingColumnId, setEditingColumnId] = useState("");
  const [isPresentationExpanded, setIsPresentationExpanded] = useState(false);
  const [newCardText, setNewCardText] = useState("");
  const retro = retrospectives.find((item) => item.id === selectedRetroId);

  function createRetro() {
    const retroItem: Retrospective = {
      id: `retro-${Date.now()}`,
      title: retroTitle.trim() || `Retro ${retrospectives.length + 1}`,
      isOpen: true,
      columns: [
        { id: `retro-good-${Date.now()}`, title: "O que fizemos bem", color: "green", cards: [] },
        { id: `retro-improve-${Date.now()}`, title: "O que podemos melhorar", color: "orange", cards: [] },
        { id: `retro-actions-${Date.now()}`, title: "Acoes", color: "blue", cards: [] }
      ]
    };
    onRetrospectivesChange([...retrospectives, retroItem]);
    setSelectedRetroId(retroItem.id);
    setScreenMode("detail");
    setRetroTitle(`Retro ${retrospectives.length + 2}`);
  }

  function updateRetro(nextRetro: Retrospective) {
    onRetrospectivesChange(retrospectives.map((item) => item.id === nextRetro.id ? nextRetro : item));
  }

  function deleteRetroColumn(columnId: string) {
    if (!retro || !window.confirm("Deseja excluir esta aba da retrospectiva?")) {
      return;
    }

    updateRetro({ ...retro, columns: retro.columns.filter((column) => column.id !== columnId) });
  }

  function deleteRetro(retroId: string) {
    if (!window.confirm("Deseja excluir esta retrospectiva?")) {
      return;
    }

    onRetrospectivesChange(retrospectives.filter((item) => item.id !== retroId));
    if (selectedRetroId === retroId) {
      setSelectedRetroId("");
      setScreenMode("list");
    }
  }

  if (screenMode === "list") {
    return (
      <div className="planning-history-layout">
        <section className="ceremony-presentation planning-history-panel">
          <header className="planning-history-header">
            <div>
              <h2>Retrospectivas</h2>
              <p>Acesse o historico das retrospectivas criadas ou inicie uma nova retro.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setScreenMode("create")}><Plus size={16} />Nova Retrospectiva</button>
          </header>
          {retrospectives.length > 0 ? (
            <div className="planning-history-list">
              {retrospectives.map((item) => (
                <article className="planning-history-item" key={item.id}>
                  <div>
                    <span>{item.isOpen ? "Play" : "Stop"}</span>
                    <h3>{item.title}</h3>
                    <p>{item.columns.length} abas - {item.columns.reduce((total, column) => total + column.cards.length, 0)} cards adicionados</p>
                  </div>
                  <strong>{item.columns.reduce((total, column) => total + column.cards.length, 0)}</strong>
                  <button type="button" onClick={() => { setSelectedRetroId(item.id); setScreenMode("detail"); }}>Acessar</button>
                  <button className="danger-icon-button" type="button" onClick={() => deleteRetro(item.id)} aria-label="Excluir retrospectiva"><X size={16} /></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="planning-empty-state">
              <RefreshCcw size={42} />
              <h3>Nenhuma retrospectiva criada</h3>
              <p>Crie uma nova retrospectiva para organizar abas e cards de texto do time.</p>
            </div>
          )}
        </section>
        <aside className="ceremony-context-panel"><h3>Sobre a Cerimonia</h3><strong>Retrospectiva</strong><p>O historico guarda retros criadas, abas configuradas, cards e estado Play ou Stop.</p><hr /><strong>O que sera incluido</strong><ul><li>Abas da retro</li><li>Cards de texto</li><li>Estado Play/Stop</li><li>Participantes</li></ul></aside>
        <CeremonySteps />
      </div>
    );
  }

  if (screenMode === "create") {
    return (
      <div className="ceremony-model-grid retro-mode">
        <aside className="ceremony-config-panel"><button className="secondary-button" type="button" onClick={() => setScreenMode("list")}><ChevronLeft size={16} />Voltar ao historico</button><h3>Configurar Retrospectiva</h3><label><span>Nome da retrospectiva</span><input value={retroTitle} onChange={(event) => setRetroTitle(event.target.value)} /></label><button className="primary-button" type="button" onClick={createRetro}>Criar retrospectiva <Play size={15} /></button><div className="ceremony-help-card"><strong>Sobre a Retro</strong><p>Depois de criar, a retro fica salva no historico e pode receber abas e cards.</p></div></aside>
        <section className="ceremony-presentation"><div className="planning-generate-placeholder"><RefreshCcw size={48} /><h2>Configure e crie a retrospectiva</h2><p>As abas e cards da retro serao exibidos aqui somente depois de pressionar Criar retrospectiva.</p></div></section>
        <aside className="ceremony-context-panel"><h3>Sobre a Cerimonia</h3><strong>Retrospectiva</strong><p>Crie uma retro para liberar o quadro colaborativo com Play/Stop.</p><hr /><strong>O que sera incluido</strong><ul><li>Abas iniciais</li><li>Controle Play/Stop</li><li>Cards anonimos</li></ul></aside>
        <CeremonySteps />
      </div>
    );
  }

  if (!retro) {
    return null;
  }

  return (
    <div className="ceremony-model-grid retro-mode">
      <aside className="ceremony-config-panel"><button className="secondary-button" type="button" onClick={() => setScreenMode("list")}><ChevronLeft size={16} />Voltar ao historico</button><h3>Retrospectiva salva</h3><div className="planning-sprint-preview"><strong>{retro.columns.reduce((total, column) => total + column.cards.length, 0)}</strong><span>cards adicionados em {retro.columns.length} abas</span></div><button className="danger-secondary-button" type="button" onClick={() => deleteRetro(retro.id)}>Excluir retrospectiva</button><div className="ceremony-help-card"><strong>Sobre a Retro</strong><p>Modo Play libera novos cards. Stop bloqueia adicionamento.</p></div></aside>
      <section className={`ceremony-presentation retro-presentation ${isPresentationExpanded ? "ceremony-presentation-expanded" : ""}`}><header className="presentation-toolbar"><strong>{retro.title}</strong><span className="status-pill">{retro.isOpen ? "Em andamento (Play)" : "Pausada (Stop)"}</span><span /><button type="button" onClick={() => updateRetro({ ...retro, isOpen: !retro.isOpen })}>{retro.isOpen ? <Square size={16} /> : <Play size={16} />}{retro.isOpen ? "Stop" : "Play"}</button><button type="button" onClick={() => setIsPresentationExpanded((current) => !current)}><LayoutGrid size={15} />{isPresentationExpanded ? "Sair da tela cheia" : "Tela cheia"}</button>{isPresentationExpanded && <button type="button" onClick={() => setIsPresentationExpanded(false)} aria-label="Fechar tela cheia"><X size={16} /></button>}</header><div className="retro-columns">
        {retro.columns.map((column) => (
          <article className="retro-column" key={column.id} style={{ "--retro-column-color": getBoardColorHex(column.color ?? "blue") } as CSSProperties}>
            <header className="retro-column-header">
              {editingColumnId === column.id ? (
                <input value={column.title} onChange={(event) => updateRetro({ ...retro, columns: retro.columns.map((item) => item.id === column.id ? { ...item, title: event.target.value } : item) })} onBlur={() => setEditingColumnId("")} autoFocus />
              ) : (
                <h3>{column.title}</h3>
              )}
              <div className="retro-column-actions">
                <button type="button" onClick={() => setEditingColumnId(column.id)} aria-label="Editar aba"><Settings size={15} /></button>
                <button type="button" onClick={() => deleteRetroColumn(column.id)} aria-label="Excluir aba"><X size={15} /></button>
              </div>
            </header>
            {editingColumnId === column.id && (
              <div className="retro-color-picker">
                {boardColorOptions.map((option) => (
                  <button
                    className={`color-swatch ${option.value} ${(column.color ?? "blue") === option.value ? "active" : ""}`}
                    key={option.value}
                    type="button"
                    onClick={() => updateRetro({ ...retro, columns: retro.columns.map((item) => item.id === column.id ? { ...item, color: option.value } : item) })}
                    aria-label={`Cor ${option.label}`}
                  />
                ))}
              </div>
            )}
            <div>{column.cards.map((card, index) => <p key={`${card}-${index}`}>{card}</p>)}</div>
            <label>
              <input disabled={!retro.isOpen} value={newCardText} onChange={(event) => setNewCardText(event.target.value)} placeholder={retro.isOpen ? "Adicionar card" : "Retro pausada"} />
              <button disabled={!retro.isOpen || !newCardText.trim()} type="button" onClick={() => {
                updateRetro({ ...retro, columns: retro.columns.map((item) => item.id === column.id ? { ...item, cards: [...item.cards, newCardText.trim()] } : item) });
                setNewCardText("");
              }}><Plus size={16} /></button>
            </label>
          </article>
        ))}
        <button className="secondary-button add-retro-column" type="button" onClick={() => {
          const column = { id: `retro-column-${Date.now()}`, title: "Nova aba", color: "purple" as BoardTabColor, cards: [] };
          updateRetro({ ...retro, columns: [...retro.columns, column] });
          setEditingColumnId(column.id);
        }}>Adicionar aba</button>
      </div></section>
      <aside className="ceremony-context-panel"><h3>Participantes</h3>{boardMembers.map((member) => <p key={member}><span className="owner-pill">{member}</span> Membro {member}</p>)}<div className="ceremony-tip">Modo Play libera novos cards. Stop bloqueia adicionamento.</div></aside>
      <CeremonySteps />
    </div>
  );
}

function DualHorizontalScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScroll = useRef(false);

  useEffect(() => {
    const contentScroll = contentScrollRef.current;
    const spacer = spacerRef.current;

    if (!contentScroll || !spacer) {
      return;
    }

    const updateScrollWidth = () => {
      spacer.style.width = `${contentScroll.scrollWidth}px`;
    };

    updateScrollWidth();
    const resizeObserver = new ResizeObserver(updateScrollWidth);
    resizeObserver.observe(contentScroll);
    if (contentScroll.firstElementChild) {
      resizeObserver.observe(contentScroll.firstElementChild);
    }
    window.addEventListener("resize", updateScrollWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollWidth);
    };
  }, [children]);

  function syncScroll(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (!target || isSyncingScroll.current) {
      return;
    }

    isSyncingScroll.current = true;
    target.scrollLeft = source.scrollLeft;
    window.requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }

  return (
    <div className={`dual-scroll-frame ${className}`}>
      <div className="dual-scrollbar top" ref={topScrollRef} onScroll={(event) => syncScroll(event.currentTarget, contentScrollRef.current)}>
        <div ref={spacerRef} />
      </div>
      <div className="dual-scroll-content" ref={contentScrollRef} onScroll={(event) => syncScroll(event.currentTarget, topScrollRef.current)}>
        {children}
      </div>
    </div>
  );
}

function BacklogPage({
  boardColumns,
  categories,
  clients,
  columns,
  members,
  onColumnsChange,
  onCategoriesChange,
  onEntryMovedToColumn,
  sprints,
  theme,
  onToggleTheme
}: {
  boardColumns: BoardColumn[];
  categories: CategoryConfig[];
  clients: ClientAccount[];
  columns: BacklogColumn[];
  members: ProductMember[];
  onColumnsChange: (columns: BacklogColumn[]) => void;
  onCategoriesChange: (categories: CategoryConfig[]) => void;
  onEntryMovedToColumn: (entry: BacklogEntry, columnTitle: string) => void;
  sprints: SprintPlan[];
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateEpicModalOpen, setIsCreateEpicModalOpen] = useState(false);
  const [isBacklogSettingsOpen, setIsBacklogSettingsOpen] = useState(false);
  const [createMenuColumnIndex, setCreateMenuColumnIndex] = useState<number | null>(null);
  const [createTargetColumnIndex, setCreateTargetColumnIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [selectedBacklogTask, setSelectedBacklogTask] = useState<{ columnIndex: number; entryIndex: number; aiConfig: { story: boolean; criteria: boolean; sp: boolean } } | null>(null);
  const [initialVisibleTabs, setInitialVisibleTabs] = useState(4);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchTerm, setSearchTerm] = useState("");
  const [draggedEntry, setDraggedEntry] = useState<DraggedBacklogEntry | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [integrationNotice, setIntegrationNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ columnIndex: number; entryIndex: number; title: string } | null>(null);
  const totalEntries = columns.reduce((total, column) => total + column.entries.length, 0);
  const selectedBacklogEntry = selectedBacklogTask ? columns[selectedBacklogTask.columnIndex]?.entries[selectedBacklogTask.entryIndex] : null;
  const selectedBacklogItem = selectedBacklogEntry && !isEpic(selectedBacklogEntry) ? selectedBacklogEntry : null;
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const visibleBacklogColumns = columns.map((column) => ({
    ...column,
    entries: column.entries
      .map((entry, entryIndex) => ({ entry, entryIndex }))
      .filter(({ entry }) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        const titles = isEpic(entry) ? [entry.name, ...entry.items.map((item) => item.name)] : [entry.name];
        return titles.some((title) => title.toLowerCase().includes(normalizedSearchTerm));
      })
  }));

  async function handleCreateEpic(epic: Omit<BacklogEpic, "id" | "order" | "createdAt">) {
    try {
      await createEpic(toCreateEpicPayload(epic));
    } catch {
      // Keep the local mock flow usable until Linear credentials are configured.
    }

    const nextOrder = totalEntries + 1;
    const today = new Date().toLocaleDateString("pt-BR");
    const epicId = `EPIC-${Date.now()}`;
    const items = epic.items.map((item, index) => ({
      ...item,
      order: nextOrder + index + 1,
      createdAt: today
    }));

    const newEpic: BacklogEpic = {
      ...epic,
      id: epicId,
      order: nextOrder,
      createdAt: today,
      items
    };

    onColumnsChange(
      columns.map((column, columnIndex) =>
        columnIndex === createTargetColumnIndex ? { ...column, entries: [newEpic, ...column.entries] } : column
      )
    );
    setExpandedEpics((currentExpandedEpics) => new Set(currentExpandedEpics).add(epicId));
    setIsCreateEpicModalOpen(false);
  }

  async function handleCreateItem({ item, linearAction }: CreateItemInput) {
    const nextOrder = totalEntries + 1;
    const today = new Date().toLocaleDateString("pt-BR");
    let newItem: BacklogItem = {
      ...item,
      order: nextOrder,
      createdAt: today
    };

    if (linearAction !== "none") {
      try {
        const result = await createIssue({
          category: item.category,
          client: item.client,
          description: item.description,
          linearIdentifier: item.linearIdentifier,
          linearIssueId: item.linearIssueId,
          linearUrl: item.linearUrl,
          name: item.name,
          owner: item.owner,
          priority: item.priority,
          sprint: item.sprint,
          storyPoints: item.storyPoints
        });
        newItem = applyCreatedIssueLink(newItem, result);
        setIntegrationNotice({
          tone: newItem.linearIssueId ? "success" : "error",
          message: newItem.linearIssueId
            ? linearAction === "link" ? "Issue Linear vinculada ao item." : "Item criado na integracao Linear/n8n."
            : "A integracao Linear/n8n respondeu, mas nao trouxe o id real da issue Linear."
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O item foi criado localmente, mas nao foi ${linearAction === "link" ? "vinculado ao" : "criado no"} Linear. ${message}` });
      }
    }

    onColumnsChange(
      columns.map((column, columnIndex) =>
        columnIndex === createTargetColumnIndex ? { ...column, entries: [newItem, ...column.entries] } : column
      )
    );
    setIsCreateModalOpen(false);
  }

  function handleBacklogDragStart(event: DragEvent<HTMLElement>, columnIndex: number, entryIndex: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${columnIndex}:${entryIndex}`);
    setDraggedEntry({ columnIndex, entryIndex });
  }

  function handleBacklogEpicItemDragStart(event: DragEvent<HTMLElement>, columnIndex: number, entryIndex: number, itemIndex: number) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${columnIndex}:${entryIndex}:${itemIndex}`);
    setDraggedEntry({ columnIndex, entryIndex, itemIndex });
  }

  function handleBacklogDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleBacklogDrop(event: DragEvent<HTMLElement>, targetColumnIndex: number, targetEntryIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedEntry) {
      return;
    }

    const nextColumns = columns.map((column) => ({ ...column, entries: [...column.entries] }));
    const movedEntry = removeDraggedBacklogEntry(nextColumns, draggedEntry);

    if (!movedEntry) {
      return;
    }

    const adjustedIndex =
      draggedEntry.itemIndex === undefined && draggedEntry.columnIndex === targetColumnIndex && draggedEntry.entryIndex < targetEntryIndex
        ? targetEntryIndex - 1
        : targetEntryIndex;

    insertDraggedBacklogEntry(nextColumns[targetColumnIndex], movedEntry, adjustedIndex);
    onColumnsChange(nextColumns);
    onEntryMovedToColumn(movedEntry, nextColumns[targetColumnIndex].title);
    void syncBacklogEntryUpdate(movedEntry, nextColumns[targetColumnIndex].title)
      .then((results) => {
        const missingStatusMessage = getMissingLinearStatusMessage(results);

        if (missingStatusMessage) {
          setIntegrationNotice({ tone: "error", message: missingStatusMessage });
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O card mudou de aba, mas o status nao foi atualizado no Linear. ${message}` });
      });
    setDraggedEntry(null);
  }

  function toggleEpic(epicId: string) {
    setExpandedEpics((currentExpandedEpics) => {
      const nextExpandedEpics = new Set(currentExpandedEpics);
      if (nextExpandedEpics.has(epicId)) {
        nextExpandedEpics.delete(epicId);
      } else {
        nextExpandedEpics.add(epicId);
      }
      return nextExpandedEpics;
    });
  }

  function openCreateModal(columnIndex: number, type: "task" | "epic") {
    setCreateTargetColumnIndex(columnIndex);
    setCreateMenuColumnIndex(null);

    if (type === "epic") {
      setIsCreateEpicModalOpen(true);
      return;
    }

    setIsCreateModalOpen(true);
  }

  function updateBacklogEntryMeta(
    columnIndex: number,
    entryIndex: number,
    updates: Partial<Pick<BacklogItem, "assistants" | "category" | "client" | "description" | "estimate" | "name" | "owner" | "priority" | "sprint" | "storyPoints" | "linearIdentifier" | "linearIssueId" | "linearUrl">>
  ) {
    const currentEntry = columns[columnIndex]?.entries[entryIndex];
    const nextEntry = currentEntry && !isEpic(currentEntry) ? { ...currentEntry, ...updates } : null;

    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              entries: column.entries.map((entry, currentEntryIndex) =>
                currentEntryIndex === entryIndex && !isEpic(entry) ? nextEntry ?? entry : entry
              )
            }
          : column
      )
    );

    if (nextEntry) {
      void syncBacklogIssueUpdate(nextEntry, columns[columnIndex]?.title).catch((error) => {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O card mudou localmente, mas nao foi atualizado no Linear. ${message}` });
      });
    }
  }

  async function saveBacklogEntryLinearLink(columnIndex: number, entryIndex: number, linearUrl: string) {
    const currentEntry = columns[columnIndex]?.entries[entryIndex];

    if (!currentEntry || isEpic(currentEntry)) {
      return;
    }

    const trimmedLinearUrl = linearUrl.trim();
    const baseItem = {
      ...currentEntry,
      linearIdentifier: trimmedLinearUrl ? extractLinearIdentifier(trimmedLinearUrl) || undefined : undefined,
      linearIssueId: undefined,
      linearUrl: trimmedLinearUrl || undefined
    };

    try {
      const result = await createIssue({
        category: baseItem.category,
        client: baseItem.client,
        description: baseItem.description,
        linearIdentifier: baseItem.linearIdentifier,
        linearIssueId: baseItem.linearIssueId,
        linearUrl: baseItem.linearUrl,
        name: baseItem.name,
        owner: baseItem.owner,
        priority: baseItem.priority,
        sprint: baseItem.sprint,
        storyPoints: baseItem.storyPoints ?? null
      });
      const linkedItem = applyCreatedIssueLink(baseItem, result);

      onColumnsChange(
        columns.map((column, currentColumnIndex) =>
          currentColumnIndex === columnIndex
            ? {
                ...column,
                entries: column.entries.map((entry, currentEntryIndex) =>
                  currentEntryIndex === entryIndex && !isEpic(entry) ? linkedItem : entry
                )
              }
            : column
        )
      );
      setIntegrationNotice({
        tone: linkedItem.linearIssueId ? "success" : "error",
        message: trimmedLinearUrl
          ? "Issue Linear vinculada e parametros preenchidos."
          : "Nova issue Linear criada e vinculada ao card."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Integracao indisponivel.";
      setIntegrationNotice({ tone: "error", message: `Nao foi possivel salvar o vinculo Linear. ${message}` });
    }
  }

  function updateBacklogEntryAiFields(columnIndex: number, entryIndex: number, updates: Partial<Pick<BacklogItem, "aiStory" | "aiCriteria" | "aiStoryPoints">>) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              entries: column.entries.map((entry, currentEntryIndex) =>
                currentEntryIndex === entryIndex && !isEpic(entry) ? { ...entry, ...updates } : entry
              )
            }
          : column
      )
    );
  }

  function deleteBacklogEntry() {
    if (!deleteTarget) {
      return;
    }

    const entryToDelete = columns[deleteTarget.columnIndex]?.entries[deleteTarget.entryIndex];

    onColumnsChange(
      columns.map((column, columnIndex) =>
        columnIndex === deleteTarget.columnIndex
          ? { ...column, entries: column.entries.filter((_, entryIndex) => entryIndex !== deleteTarget.entryIndex) }
          : column
      )
    );
    if (entryToDelete) {
      void syncBacklogEntryArchive(entryToDelete).catch((error) => {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O card foi removido localmente, mas nao foi arquivado no Linear. ${message}` });
      });
    }
    setDeleteTarget(null);
  }

  return (
    <main className="dashboard backlog-page">
      <Topbar title="Backlog" subtitle="Gerencie e priorize as demandas do produto" theme={theme} onToggleTheme={onToggleTheme} />

      <section className="backlog-layout">
        <div className="backlog-main">
          <section className="backlog-table-panel">
            <div className="backlog-toolbar">
              <label className="search-field">
                <Search size={18} />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar titulo do card..." />
                <ListFilter size={18} />
              </label>
              <div className="backlog-actions">
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
                <button className="square-action" type="button" onClick={() => setIsBacklogSettingsOpen(true)} aria-label="Configurar backlog" title="Configurar backlog">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="filters-row">
              {["Sprint", "Categoria", "Priorizacao"].map((filter) => (
                <label key={filter}>
                  <span>{filter}:</span>
                  <select>
                    <option>Todas</option>
                    {filter === "Categoria" && categories.map((category) => <option key={category.id}>{category.name}</option>)}
                  </select>
                </label>
              ))}
              <button className="clear-filter-button" type="button">
                <RefreshCcw size={16} />
                Limpar filtros
              </button>
            </div>

            {integrationNotice && (
              <div className={`info-callout integration-notice ${integrationNotice.tone}`}>
                <span>{integrationNotice.tone === "success" ? "OK" : "!"}</span>
                {integrationNotice.message}
              </div>
            )}

            <DualHorizontalScroll className="backlog-scroll-frame">
              <section
                className={`kanban-board backlog-tabs-board ${viewMode === "list" ? "list-view" : ""}`}
                aria-label="Abas do backlog"
                style={{ "--board-column-width": `calc((100% - ${(Math.max(initialVisibleTabs, 1) - 1) * 8 + 32}px) / ${Math.max(initialVisibleTabs, 1)})` } as CSSProperties}
              >
                {visibleBacklogColumns.map((column, columnIndex) => (
                  <article className={`kanban-column backlog-tab-column ${column.color}`} key={`${column.title}-${columnIndex}`} onDragOver={handleBacklogDragOver} onDrop={(event) => handleBacklogDrop(event, columnIndex, columns[columnIndex]?.entries.length ?? column.entries.length)}>
                    <header className="kanban-column-header">
                      <span className={`column-icon ${column.color}`}>{renderBoardIcon(column.icon, 15)}</span>
                      <h2>{column.title}</h2>
                      {(column.connections ?? []).some((connection) => connection.screen === "Sprint") && <KanbanSquare className="linked-sprint-icon" size={16} />}
                      <ColumnDescriptionButton description={column.description} title={column.title} />
                      <span className="column-count">{column.entries.length}</span>
                      <span className="column-create-wrap">
                        <button
                          className="column-create-button"
                          type="button"
                          aria-expanded={createMenuColumnIndex === columnIndex}
                          aria-label={`Criar item em ${column.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setCreateMenuColumnIndex((currentIndex) => currentIndex === columnIndex ? null : columnIndex);
                          }}
                        >
                          <Plus size={17} />
                        </button>
                        {createMenuColumnIndex === columnIndex && (
                          <span className="column-create-menu">
                            <button type="button" onClick={() => openCreateModal(columnIndex, "task")}>Tarefa</button>
                            <button type="button" onClick={() => openCreateModal(columnIndex, "epic")}>Epico</button>
                          </span>
                        )}
                      </span>
                    </header>

                    <div className="kanban-card-list">
                      {column.entries.map(({ entry, entryIndex }) => (
                        <BacklogTabEntryCard
                          entry={entry}
                          categories={categories}
                          members={members}
                          expanded={isEpic(entry) ? expandedEpics.has(entry.id) : false}
                          isDragging={draggedEntry?.columnIndex === columnIndex && draggedEntry.entryIndex === entryIndex}
                          key={isEpic(entry) ? entry.id : `item-${entry.order}`}
                          onDragEnd={() => setDraggedEntry(null)}
                          onDragOver={handleBacklogDragOver}
                          onEpicItemDragStart={(event, itemIndex) => handleBacklogEpicItemDragStart(event, columnIndex, entryIndex, itemIndex)}
                          onDragStart={(event) => handleBacklogDragStart(event, columnIndex, entryIndex)}
                          onDrop={(event) => handleBacklogDrop(event, columnIndex, entryIndex)}
                          onOpenTask={setSelectedTask}
                          onOpenEntry={() => setSelectedBacklogTask({
                            aiConfig: {
                              criteria: !!column.aiCriteriaEnabled,
                              sp: !!column.aiStoryPointsEnabled,
                              story: !!column.aiStoryEnabled
                            },
                            columnIndex,
                            entryIndex
                          })}
                          onToggleEpic={() => isEpic(entry) && toggleEpic(entry.id)}
                          onUpdateMeta={(updates) => updateBacklogEntryMeta(columnIndex, entryIndex, updates)}
                          onSaveLinearLink={(linearUrl) => saveBacklogEntryLinearLink(columnIndex, entryIndex, linearUrl)}
                          onRequestDelete={() => setDeleteTarget({ columnIndex, entryIndex, title: entry.name })}
                        />
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            </DualHorizontalScroll>

            <footer className="backlog-pagination backlog-tabs-summary">
              <span>Mostrando {totalEntries} registros</span>
            </footer>
          </section>
        </div>
      </section>

      {isCreateModalOpen && <CreateItemModal categories={categories} clients={clients} members={members} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateItem} sprints={sprints} />}
      {isCreateEpicModalOpen && <CreateEpicModal categories={categories} onClose={() => setIsCreateEpicModalOpen(false)} onCreate={handleCreateEpic} />}
      {isBacklogSettingsOpen && (
        <BacklogSettingsModal
          columns={columns}
          initialVisibleTabs={initialVisibleTabs}
          onClose={() => setIsBacklogSettingsOpen(false)}
          onColumnsChange={onColumnsChange}
          categories={categories}
          onCategoriesChange={onCategoriesChange}
          boardColumns={boardColumns}
          onInitialVisibleTabsChange={setInitialVisibleTabs}
        />
      )}
      {selectedTask && <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
      {selectedBacklogTask && selectedBacklogItem && (
        <TaskDetailsModal
          aiConfig={selectedBacklogTask.aiConfig}
          aiItem={selectedBacklogItem}
          categories={categories}
          clients={clients}
          editable
          members={members}
          onAiChange={(updates) => updateBacklogEntryAiFields(selectedBacklogTask.columnIndex, selectedBacklogTask.entryIndex, updates)}
          onSave={(updates) => {
            updateBacklogEntryMeta(selectedBacklogTask.columnIndex, selectedBacklogTask.entryIndex, {
              category: updates.category,
              client: updates.client,
              description: updates.description,
              estimate: updates.estimate,
              name: updates.title,
              owner: updates.owner,
              assistants: updates.assistants,
              priority: updates.priority,
              sprint: updates.sprint,
              storyPoints: updates.points
            });
            setSelectedBacklogTask(null);
          }}
          sprints={sprints}
          task={toBacklogTaskDetail(selectedBacklogItem)}
          onClose={() => setSelectedBacklogTask(null)}
        />
      )}
      {deleteTarget && (
        <DeleteCardConfirmModal
          itemName={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteBacklogEntry}
        />
      )}
    </main>
  );
}

function BacklogListView({
  entries,
  expandedEpics,
  onOpenTask,
  onToggleEpic
}: {
  entries: BacklogEntry[];
  expandedEpics: Set<string>;
  onOpenTask: (task: TaskDetail) => void;
  onToggleEpic: (epicId: string) => void;
}) {
  return (
    <>
      <div className="backlog-table">
        <div className="backlog-row backlog-head">
          <span>Ordem</span>
          <span>Nome da tarefa</span>
          <span>Sprint</span>
          <span>Categoria</span>
          <span>Priorizacao</span>
          <span>Data criacao</span>
        </div>
        {entries.map((entry) => isEpic(entry) ? (
          <EpicRows epic={entry} expanded={expandedEpics.has(entry.id)} key={entry.id} onOpenTask={onOpenTask} onToggle={() => onToggleEpic(entry.id)} />
        ) : (
          <BacklogItemRow item={entry} key={`item-${entry.order}`} onOpenTask={onOpenTask} />
        ))}
      </div>

      <footer className="backlog-pagination">
        <span>Mostrando {entries.length} registros</span>
        <div>
          <button type="button" disabled>
            <ChevronLeft size={18} />
          </button>
          {[1, 2, 3].map((pageNumber) => (
            <button className={pageNumber === 1 ? "active" : ""} type="button" key={pageNumber}>
              {pageNumber}
            </button>
          ))}
          <span>...</span>
          <button type="button">6</button>
          <button type="button">
            <ChevronRight size={18} />
          </button>
        </div>
      </footer>
    </>
  );
}

function removeDraggedBacklogEntry(columns: BacklogColumn[], draggedEntry: DraggedBacklogEntry): BacklogEntry | null {
  const sourceColumn = columns[draggedEntry.columnIndex];
  const sourceEntry = sourceColumn.entries[draggedEntry.entryIndex];

  if (!sourceEntry) {
    return null;
  }

  if (draggedEntry.itemIndex === undefined) {
    const [removedEntry] = sourceColumn.entries.splice(draggedEntry.entryIndex, 1);
    return removedEntry ?? null;
  }

  if (!isEpic(sourceEntry)) {
    return null;
  }

  const removedItem = sourceEntry.items[draggedEntry.itemIndex];

  if (!removedItem) {
    return null;
  }

  const remainingItems = sourceEntry.items.filter((_, itemIndex) => itemIndex !== draggedEntry.itemIndex);

  if (remainingItems.length === 0) {
    sourceColumn.entries.splice(draggedEntry.entryIndex, 1);
  } else {
    sourceColumn.entries[draggedEntry.entryIndex] = {
      ...sourceEntry,
      items: remainingItems
    };
  }

  return {
    ...sourceEntry,
    items: [removedItem]
  };
}

function insertDraggedBacklogEntry(targetColumn: BacklogColumn, movedEntry: BacklogEntry, targetEntryIndex: number) {
  if (!isEpic(movedEntry)) {
    targetColumn.entries.splice(targetEntryIndex, 0, movedEntry);
    return;
  }

  const existingEpicIndex = targetColumn.entries.findIndex((entry) => isEpic(entry) && entry.id === movedEntry.id);

  if (existingEpicIndex >= 0) {
    const existingEpic = targetColumn.entries[existingEpicIndex];
    if (isEpic(existingEpic)) {
      targetColumn.entries[existingEpicIndex] = {
        ...existingEpic,
        items: [...existingEpic.items, ...movedEntry.items]
      };
    }
    return;
  }

  targetColumn.entries.splice(targetEntryIndex, 0, movedEntry);
}

function flattenBacklogEntries(entries: BacklogEntry[]): BacklogItem[] {
  return entries.flatMap((entry) => (isEpic(entry) ? entry.items : [entry]));
}

function getIssueEstimate(value?: string | number) {
  if (typeof value === "number") {
    return value || undefined;
  }

  if (!value) {
    return undefined;
  }

  const estimate = Number(value);
  return Number.isFinite(estimate) && estimate > 0 ? estimate : undefined;
}

function getLinearEstimate(value?: string | number) {
  return getIssueEstimate(value) ?? null;
}

function syncBacklogIssueUpdate(item: BacklogItem, status?: string) {
  return updateIssue({
    linearIdentifier: item.linearIdentifier,
    linearIssueId: item.linearIssueId,
    linearUrl: item.linearUrl,
    title: item.name,
    description: item.description,
    sprint: item.sprint,
    category: item.category,
    client: item.client,
    priority: item.priority,
    estimate: getLinearEstimate(item.storyPoints ?? item.estimate),
    storyPoints: item.storyPoints ?? null,
    owner: item.owner,
    status
  });
}

function getLinkedIssueId(item: Pick<BacklogItem, "linearIssueId" | "linearIdentifier" | "linearUrl">) {
  return item.linearIssueId ?? item.linearIdentifier ?? item.linearUrl;
}

function getIssueDisplayId(item: Pick<BacklogItem, "linearIssueId" | "linearIdentifier" | "linearUrl">) {
  return item.linearIdentifier ?? item.linearIssueId ?? item.linearUrl;
}

function toArchiveIssuePayload(item: Pick<BacklogItem, "name" | "linearIssueId" | "linearIdentifier" | "linearUrl">) {
  return {
    linearIssueId: item.linearIssueId,
    linearIdentifier: item.linearIdentifier,
    linearUrl: item.linearUrl,
    title: item.name
  };
}

function toArchiveBoardIssuePayload(card: Pick<BoardCard, "title" | "linearIssueId" | "linearIdentifier" | "linearUrl">) {
  return {
    linearIssueId: card.linearIssueId,
    linearIdentifier: card.linearIdentifier,
    linearUrl: card.linearUrl,
    title: card.title
  };
}

function syncBoardIssueUpdate(card: BoardCard, status?: string) {
  return updateIssue({
    linearIdentifier: card.linearIdentifier,
    linearIssueId: card.linearIssueId,
    linearUrl: card.linearUrl,
    title: card.title,
    description: card.description,
    priority: card.priority,
    estimate: getLinearEstimate(card.points ?? card.estimate),
    storyPoints: card.points || null,
    owner: card.owner,
    status
  });
}

async function syncBacklogEntryUpdate(entry: BacklogEntry, status?: string) {
  const items = flattenBacklogEntries([entry]);
  return Promise.all(items.map((item) => syncBacklogIssueUpdate(item, status)));
}

function getMissingLinearStatusMessage(results: UpdateIssueResult[]) {
  return results.find((result) => result.statusMatched === false)?.message;
}

async function syncBacklogEntryArchive(entry: BacklogEntry) {
  const items = flattenBacklogEntries([entry]);
  await Promise.all(items.map((item) => archiveIssue(toArchiveIssuePayload(item))));
}

function getCategoryConfig(categoryName: string, categories: CategoryConfig[]) {
  return categories.find((category) => category.name === categoryName);
}

function getCategoryColor(entry: BacklogEntry, categories: CategoryConfig[]) {
  const categoryName = isEpic(entry) ? entry.items[0]?.category : entry.category;
  const category = categoryName ? getCategoryConfig(categoryName, categories) : undefined;
  return getBoardColorHex(category?.color ?? "blue");
}

function BacklogTabEntryCard({
  categories,
  entry,
  expanded,
  isDragging,
  members,
  onDragEnd,
  onDragOver,
  onEpicItemDragStart,
  onDragStart,
  onDrop,
  onOpenEntry,
  onOpenTask,
  onRequestDelete,
  onSaveLinearLink,
  onToggleEpic,
  onUpdateMeta
}: {
  categories: CategoryConfig[];
  entry: BacklogEntry;
  expanded: boolean;
  isDragging: boolean;
  members: ProductMember[];
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onEpicItemDragStart: (event: DragEvent<HTMLElement>, itemIndex: number) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onOpenEntry: () => void;
  onOpenTask: (task: TaskDetail) => void;
  onRequestDelete: () => void;
  onSaveLinearLink: (linearUrl: string) => void;
  onToggleEpic: () => void;
  onUpdateMeta: (updates: Partial<Pick<BacklogItem, "description" | "estimate" | "owner" | "priority" | "storyPoints" | "linearIdentifier" | "linearIssueId" | "linearUrl">>) => void;
}) {
  const categoryColor = getCategoryColor(entry, categories);

  if (isEpic(entry)) {
    return (
      <article
        className={`kanban-card backlog-tab-card category-accent epic ${isDragging ? "dragging" : ""}`}
        style={{ "--category-color": categoryColor } as CSSProperties}
        draggable
        role="button"
        tabIndex={0}
        onClick={onToggleEpic}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleEpic();
          }
        }}
      >
        <header>
          <span>{entry.order}</span>
          <div className="card-header-actions">
            <Badge tone="pink">Epico</Badge>
            <button
              className="card-delete-button"
              type="button"
              aria-label={`Excluir ${entry.name}`}
              title="Excluir card"
              onClick={(event) => {
                event.stopPropagation();
                onRequestDelete();
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </header>
        <h3>{entry.name}</h3>
        <small>{entry.items.length} itens no epico</small>
        {expanded && (
          <div className="backlog-epic-items">
            {entry.items.map((item, itemIndex) => (
              <button
                draggable
                type="button"
                key={`${entry.id}-${item.order}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenTask(toBacklogTaskDetail(item));
                }}
                onDragEnd={onDragEnd}
                onDragStart={(event) => onEpicItemDragStart(event, itemIndex)}
              >
                <span>{item.name}</span>
                <Badge tone={getPriorityTone(item.priority)}>{item.priority}</Badge>
              </button>
            ))}
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className={`kanban-card backlog-tab-card category-accent ${isDragging ? "dragging" : ""}`}
      style={{ "--category-color": categoryColor } as CSSProperties}
      draggable
      role="button"
      tabIndex={0}
      onClick={onOpenEntry}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenEntry();
        }
      }}
    >
      <header>
        <span className="owner-pill card-owner-avatar" title={entry.owner || "Sem responsavel"}>{getMemberInitials(entry.owner)}</span>
        <span className={`board-card-pill priority-pill ${getPriorityTone(entry.priority)}`}>
          {entry.priority === "Alta" || entry.priority === "Urgente" ? <ArrowUp size={13} /> : entry.priority === "Baixa" ? <ArrowDown size={13} /> : <span className="priority-dash" />}
          {entry.priority}
        </span>
        <button
          className="card-delete-button"
          type="button"
          aria-label={`Excluir ${entry.name}`}
          title="Excluir card"
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete();
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Trash2 size={14} />
        </button>
      </header>
      <h3>{entry.name}</h3>
      <footer>
        <span className="board-card-pill">
          <ListTodo size={14} />
          {entry.storyPoints || "SP"}
        </span>
        <span className="board-card-pill">
          <CalendarDays size={14} />
          {entry.estimate || "Sem estimativa"}
        </span>
      </footer>
    </article>
  );
}

function isEpic(entry: BacklogEntry): entry is BacklogEpic {
  return "items" in entry;
}

function AiGenerationPanel({
  config,
  item,
  onChange
}: {
  config: { story: boolean; criteria: boolean; sp: boolean };
  item: BacklogItem;
  onChange: (updates: Partial<Pick<BacklogItem, "aiStory" | "aiCriteria" | "aiStoryPoints">>) => void;
}) {
  function stopCardClick(event: SyntheticEvent) {
    event.stopPropagation();
  }

  return (
    <div className="ai-generation-panel" onClick={stopCardClick} onMouseDown={stopCardClick}>
      {config.story && (
        <label>
          <span>Historia</span>
          <textarea value={item.aiStory ?? ""} onChange={(event) => onChange({ aiStory: event.target.value })} placeholder="Historia gerada por IA" />
          <button type="button" onClick={() => onChange({ aiStory: `Como usuario, quero ${item.name.toLowerCase()} para obter valor no fluxo do produto.` })}>Gerar Historia</button>
        </label>
      )}
      {config.criteria && (
        <label>
          <span>Criterios</span>
          <textarea value={item.aiCriteria ?? ""} onChange={(event) => onChange({ aiCriteria: event.target.value })} placeholder="Criterios gerados por IA" />
          <button type="button" onClick={() => onChange({ aiCriteria: `- Dado o contexto da tarefa, quando a solucao for entregue, entao ${item.name.toLowerCase()} deve estar validado.\n- Deve existir evidencia de aceite do comportamento esperado.` })}>Gerar Criterios</button>
        </label>
      )}
      {config.sp && (
        <label>
          <span>SP</span>
          <input value={item.aiStoryPoints ?? ""} onChange={(event) => onChange({ aiStoryPoints: event.target.value })} placeholder="SP gerado por IA" />
          <button type="button" onClick={() => onChange({ aiStoryPoints: String(Math.max(1, Math.min(13, Math.ceil(item.name.length / 12)))) })}>Gerar SP</button>
        </label>
      )}
    </div>
  );
}

function BacklogItemRow({ item, nested = false, onOpenTask }: { item: BacklogItem; nested?: boolean; onOpenTask: (task: TaskDetail) => void }) {
  return (
    <button
      className={`backlog-row backlog-item-row ${nested ? "nested-item-row" : ""}`}
      type="button"
      onClick={() => onOpenTask(toBacklogTaskDetail(item))}
    >
      <span className="order-cell">{item.order}</span>
      <span className="task-name">
        {item.name}
        <small>linear</small>
      </span>
      <span>{item.sprint}</span>
      <span>
        <Badge tone={getCategoryTone(item.category)}>{item.category}</Badge>
      </span>
      <span className="priority-cell">
        {item.priority === "Alta" && <ArrowUp size={16} />}
        {item.priority === "Baixa" && <ArrowDown size={16} />}
        {item.priority === "Media" && <span className="priority-dash" />}
        {item.priority}
      </span>
      <span>{item.createdAt}</span>
    </button>
  );
}

function EpicRows({
  epic,
  expanded,
  onOpenTask,
  onToggle
}: {
  epic: BacklogEpic;
  expanded: boolean;
  onOpenTask: (task: TaskDetail) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <button className="backlog-row epic-row" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span className="order-cell epic-order">{epic.order}</span>
        <span className="task-name">
          <strong>{epic.name}</strong>
          <small>{expanded ? "ocultar itens" : `${epic.items.length} itens no epico`}</small>
        </span>
        <span>{epic.items.length} sprints</span>
        <span>
          <Badge tone="pink">Epico</Badge>
        </span>
        <span className="priority-cell">
          <ChevronRight className={expanded ? "epic-chevron expanded" : "epic-chevron"} size={18} />
          Expandir
        </span>
        <span>{epic.createdAt}</span>
      </button>
      {expanded && epic.items.map((item) => <BacklogItemRow item={item} key={`${epic.id}-${item.order}`} nested onOpenTask={onOpenTask} />)}
    </>
  );
}

function toBacklogTaskDetail(item: BacklogItem): TaskDetail {
  return {
    id: `#${item.order}`,
    title: item.name,
    source: "Backlog",
    priority: item.priority,
    description: item.description,
    sprint: item.sprint,
    category: item.category,
    client: item.client,
    createdAt: item.createdAt,
    createdBy: "Amanda Silva",
    owner: item.owner,
    assistants: item.assistants,
    points: item.storyPoints,
    generalFields: [
      ...getBacklogFieldValues(item),
      ...(item.client ? [{ id: `backlog-client-${item.order}`, label: "Cliente", value: item.client, type: "Lista" as BoardFieldType }] : [])
    ],
    deliveryHistory: []
  };
}

interface SprintPointBreakdown {
  sprintName: string;
  totalPoints: number;
  totalHours: number;
  categories: Array<{
    category: string;
    items: number;
    points: number;
    hours: number;
    rate: number;
  }>;
}

interface SprintCapacityBreakdown {
  sprintName: string;
  businessDays: number;
  dailyCapacity: number;
  totalCapacity: number;
  squads: Array<{
    clientName: string;
    hasSquad: boolean;
    monthlyHours: number;
    plannedHours: number;
    remainingHours: number;
    items: number;
  }>;
  unassignedItems: number;
  unassignedHours: number;
}

interface SprintEstimateResult {
  sprintName: string;
  totalHours: number;
  dailyCapacity: number;
  items: Array<{
    order: number;
    name: string;
    priority: Priority;
    owner?: string;
    client?: string;
    hours: number;
    deliveryDate: string;
  }>;
}

function getSprintPointBreakdown(sprint: SprintPlan, items: BacklogItem[]): SprintPointBreakdown {
  const categories = new Map<string, { items: number; points: number }>();

  items.forEach((item) => {
    const currentCategory = categories.get(item.category) ?? { items: 0, points: 0 };
    currentCategory.items += 1;
    currentCategory.points += item.storyPoints ?? 0;
    categories.set(item.category, currentCategory);
  });

  const categoryRows = Array.from(categories.entries()).map(([category, value]) => {
    const rate = categoryHourRates[category] ?? 5;

    return {
      category,
      items: value.items,
      points: value.points,
      hours: value.points * rate,
      rate
    };
  });

  return {
    sprintName: sprint.name,
    totalPoints: categoryRows.reduce((total, row) => total + row.points, 0),
    totalHours: categoryRows.reduce((total, row) => total + row.hours, 0),
    categories: categoryRows
  };
}

function parseSprintDate(date: string) {
  const [day, month, year] = date.split("/").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatSprintDate(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function addBusinessDays(date: Date, daysToAdd: number) {
  const nextDate = new Date(date);
  let remainingDays = daysToAdd;

  while (remainingDays > 0) {
    nextDate.setDate(nextDate.getDate() + 1);
    const day = nextDate.getDay();

    if (day !== 0 && day !== 6) {
      remainingDays -= 1;
    }
  }

  return nextDate;
}

function getBusinessDays(start: string, end: string) {
  const startDate = parseSprintDate(start);
  const endDate = parseSprintDate(end);
  let days = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const day = currentDate.getDay();

    if (day !== 0 && day !== 6) {
      days += 1;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return Math.max(days, 1);
}

function getSprintCapacityTotals(sprint: SprintPlan, members: ProductMember[] = []) {
  const activeMemberIds = new Set(members.map((member) => member.id));
  const capacityByMember = sprint.capacityByMember ?? {};
  const dailyCapacity = members.reduce((total, member) => total + (Number(capacityByMember[member.id]) || 0), 0);
  const businessDays = getBusinessDays(sprint.start, sprint.end);

  return {
    businessDays,
    dailyCapacity: activeMemberIds.size > 0 ? dailyCapacity : 0,
    totalCapacity: dailyCapacity * businessDays
  };
}

function getItemEstimatedHours(item: BacklogItem) {
  return (item.storyPoints ?? 0) * (categoryHourRates[item.category] ?? 5);
}

function getSprintCapacityBreakdown(sprint: SprintPlan, items: BacklogItem[], clients: ClientAccount[], members: ProductMember[]): SprintCapacityBreakdown {
  const totals = getSprintCapacityTotals(sprint, members);
  const clientsByName = new Map(clients.map((client) => [client.name, client]));
  const itemsByClient = new Map<string, BacklogItem[]>();

  items.forEach((item) => {
    const clientName = item.client?.trim() || "Sem empresa";
    itemsByClient.set(clientName, [...(itemsByClient.get(clientName) ?? []), item]);
  });

  const squads = Array.from(itemsByClient.entries())
    .sort(([firstClient], [secondClient]) => firstClient.localeCompare(secondClient))
    .map(([clientName, clientItems]) => {
      const client = clientsByName.get(clientName);
      const hasSquad = Boolean(client?.hasSquad);
      const monthlyHours = hasSquad ? client?.squadHours ?? 0 : 0;
      const plannedHours = clientItems.reduce((total, item) => total + getItemEstimatedHours(item), 0);

      return {
        clientName,
        hasSquad,
        monthlyHours,
        plannedHours,
        remainingHours: monthlyHours - plannedHours,
        items: clientItems.length
      };
    });

  const withoutSquadRows = squads.filter((squad) => !squad.hasSquad);

  return {
    sprintName: sprint.name,
    ...totals,
    squads,
    unassignedItems: withoutSquadRows.reduce((total, squad) => total + squad.items, 0),
    unassignedHours: withoutSquadRows.reduce((total, squad) => total + squad.plannedHours, 0)
  };
}

function getSprintEstimateResult(sprint: SprintPlan, items: BacklogItem[], members: ProductMember[]): SprintEstimateResult {
  const { dailyCapacity } = getSprintCapacityTotals(sprint, members);
  const effectiveDailyCapacity = Math.max(dailyCapacity, 1);
  const priorityOrder: Record<Priority, number> = { Urgente: 0, Alta: 1, Media: 2, Baixa: 3, "Sem prioridade": 4 };
  let accumulatedHours = 0;
  const sprintStart = parseSprintDate(sprint.start);

  const estimatedItems = [...items]
    .sort((firstItem, secondItem) => priorityOrder[firstItem.priority] - priorityOrder[secondItem.priority])
    .map((item) => {
      const hours = getItemEstimatedHours(item);
      accumulatedHours += hours;
      const elapsedBusinessDays = Math.max(0, Math.ceil(accumulatedHours / effectiveDailyCapacity) - 1);

      return {
        order: item.order,
        name: item.name,
        priority: item.priority,
        owner: item.owner,
        client: item.client,
        hours,
        deliveryDate: formatSprintDate(addBusinessDays(sprintStart, elapsedBusinessDays))
      };
    });

  return {
    sprintName: sprint.name,
    totalHours: estimatedItems.reduce((total, item) => total + item.hours, 0),
    dailyCapacity,
    items: estimatedItems
  };
}

function BacklogCalendarView({
  backlogItems,
  categories,
  clients,
  members,
  searchTerm,
  sprints,
  statuses,
  viewMode,
  onUpdateItemEstimate,
  onUpdateSprintEstimates,
  onSprintsChange
}: {
  backlogItems: BacklogItem[];
  categories: CategoryConfig[];
  clients: ClientAccount[];
  members: ProductMember[];
  searchTerm: string;
  sprints: SprintPlan[];
  statuses: SprintStatus[];
  viewMode: ViewMode;
  onUpdateItemEstimate: (order: number, estimate: string) => void;
  onUpdateSprintEstimates: (estimates: Record<number, string>) => void;
  onSprintsChange: (sprints: SprintPlan[]) => void;
}) {
  const currentSprintRef = useRef<HTMLElement | null>(null);
  const [selectedBreakdown, setSelectedBreakdown] = useState<SprintPointBreakdown | null>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<SprintCapacityBreakdown | null>(null);
  const [capacitySprint, setCapacitySprint] = useState<SprintPlan | null>(null);
  const [estimatingSprintId, setEstimatingSprintId] = useState<string | null>(null);
  const activeStatus = statuses.find((status) => status.name === "Em andamento");
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  useEffect(() => {
    currentSprintRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center"
    });
  }, []);

  function generateSprintEstimates(sprint: SprintPlan, items: BacklogItem[]) {
    setEstimatingSprintId(sprint.id);

    window.setTimeout(() => {
      const estimate = getSprintEstimateResult(sprint, items, members);
      onUpdateSprintEstimates(
        Object.fromEntries(estimate.items.map((item) => [item.order, item.deliveryDate]))
      );
      setEstimatingSprintId(null);
    }, 450);
  }

  return (
    <>
      <DualHorizontalScroll className="sprints-scroll-frame">
        <div className={`sprints-calendar ${viewMode === "list" ? "list-view" : ""}`}>
          {sprints.map((sprint) => {
            const items = backlogItems.filter((item) => item.sprint === sprint.name && (!normalizedSearchTerm || item.name.toLowerCase().includes(normalizedSearchTerm)));
            const status = statuses.find((currentStatus) => currentStatus.id === sprint.statusId) ?? statuses[0];
            const isActiveSprint = activeStatus ? sprint.statusId === activeStatus.id : sprint.name === currentSprint;
            const pointsBreakdown = getSprintPointBreakdown(sprint, items);
            const capacityTotals = getSprintCapacityTotals(sprint, members);

            return (
              <section
                className={`sprint-calendar-section ${isActiveSprint ? "current" : ""}`}
                key={sprint.id}
                ref={isActiveSprint ? currentSprintRef : undefined}
                style={{ "--sprint-status-color": getBoardColorHex(status.color) } as CSSProperties}
              >
            <header className="sprint-header-strip">
              <div className="sprint-header-main">
                <div>
                  <h3>{sprint.name}</h3>
                  <small>{sprint.start} - {sprint.end}</small>
                </div>
                <SprintStatusPicker
                  ariaLabel={`Estado da ${sprint.name}`}
                  statusId={sprint.statusId}
                  statuses={statuses}
                  onChange={(statusId) =>
                    onSprintsChange(sprints.map((currentSprint) => currentSprint.id === sprint.id ? { ...currentSprint, statusId } : currentSprint))
                  }
                />
                <span className="sprint-items-count">{items.length} itens</span>
              </div>
              <div className="sprint-header-actions" aria-label="Acoes da sprint">
                <button className="square-action compact-square-action" type="button" onClick={() => setCapacitySprint(sprint)} aria-label={`Capacity da ${sprint.name}`} title="Capacity">
                  <BarChart3 size={16} />
                </button>
                <button className="square-action compact-square-action" type="button" onClick={() => generateSprintEstimates(sprint, items)} aria-label={`Gerar estimativa da ${sprint.name}`} title="Gerar estimativa" disabled={estimatingSprintId === sprint.id}>
                  {estimatingSprintId === sprint.id ? <LoaderCircle className="spin-icon" size={16} /> : <Rocket size={16} />}
                </button>
              </div>
              <div className="sprint-header-metrics">
                <button className="sprint-points-button" type="button" onClick={() => setSelectedBreakdown(pointsBreakdown)}>
                  {pointsBreakdown.totalPoints} SP
                </button>
                <button className="sprint-points-button" type="button" onClick={() => setSelectedCapacity(getSprintCapacityBreakdown(sprint, items, clients, members))}>
                  {capacityTotals.totalCapacity}h capacity
                </button>
              </div>
            </header>

            <div className="sprint-objective">
              <span>Objetivo</span>
              <textarea
                aria-label={`Objetivo da ${sprint.name}`}
                value={sprint.objective}
                onChange={(event) =>
                  onSprintsChange(sprints.map((currentSprint) => currentSprint.id === sprint.id ? { ...currentSprint, objective: event.target.value } : currentSprint))
                }
              />
            </div>

            <div className="calendar-item-list">
              {items.map((item) => (
                <article
                  className="calendar-item-card kanban-card category-accent"
                  key={item.order}
                  style={{ "--category-color": getBoardColorHex(getCategoryConfig(item.category, categories)?.color ?? "blue") } as CSSProperties}
                >
                  <header>
                    <span className="owner-pill card-owner-avatar" title={item.owner || "Sem responsavel"}>{getMemberInitials(item.owner)}</span>
                    <span className={`board-card-pill priority-pill ${getPriorityTone(item.priority)}`}>
                      {item.priority === "Alta" || item.priority === "Urgente" ? <ArrowUp size={13} /> : item.priority === "Baixa" ? <ArrowDown size={13} /> : <span className="priority-dash" />}
                      {item.priority}
                    </span>
                  </header>
                  <h3>{item.name}</h3>
                  <footer>
                    <span className="board-card-pill">
                      <ListTodo size={14} />
                      {item.storyPoints || "SP"}
                    </span>
                    <label className="board-card-pill sprint-estimate-pill" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                      <CalendarDays size={14} />
                      <input value={item.estimate ?? ""} onChange={(event) => onUpdateItemEstimate(item.order, event.target.value)} placeholder="Sem estimativa" />
                    </label>
                  </footer>
                  <div className="calendar-item-content">
                    <span>{item.createdAt}</span>
                  </div>
                </article>
              ))}
              {items.length === 0 && <div className="empty-delivery">Nenhum item vinculado a esta sprint.</div>}
            </div>
              </section>
            );
          })}
        </div>
      </DualHorizontalScroll>
      {selectedBreakdown && <SprintPointsModal breakdown={selectedBreakdown} onClose={() => setSelectedBreakdown(null)} />}
      {selectedCapacity && <SprintCapacityBreakdownModal breakdown={selectedCapacity} onClose={() => setSelectedCapacity(null)} />}
      {capacitySprint && (
        <SprintCapacityModal
          members={members}
          onClose={() => setCapacitySprint(null)}
          onSave={(capacityByMember) => {
            onSprintsChange(sprints.map((sprint) => sprint.id === capacitySprint.id ? { ...sprint, capacityByMember } : sprint));
            setCapacitySprint(null);
          }}
          sprint={capacitySprint}
        />
      )}
    </>
  );
}

function SprintsPage({
  backlogItems,
  categories,
  clients,
  members,
  sprints,
  statuses,
  onSprintsChange,
  onStatusesChange,
  onUpdateItemEstimate,
  onUpdateSprintEstimates,
  theme,
  onToggleTheme
}: {
  backlogItems: BacklogItem[];
  categories: CategoryConfig[];
  clients: ClientAccount[];
  members: ProductMember[];
  sprints: SprintPlan[];
  statuses: SprintStatus[];
  onSprintsChange: (sprints: SprintPlan[]) => void;
  onStatusesChange: (statuses: SprintStatus[]) => void;
  onUpdateItemEstimate: (order: number, estimate: string) => void;
  onUpdateSprintEstimates: (estimates: Record<number, string>) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <main className="dashboard sprints-page">
      <Topbar title="Sprints" subtitle="Visualize os itens por sprint e periodo" theme={theme} onToggleTheme={onToggleTheme} />

      <section className="sprints-panel">
        <header className="sprints-toolbar">
          <div>
            <h2>Calendario de sprints</h2>
            <p>Itens entram aqui a partir da aba vinculada no Backlog.</p>
          </div>
          <div className="sprints-actions">
            <label className="search-field sprints-search-field">
              <Search size={18} />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar titulo do card..." />
            </label>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <button className="square-action" type="button" onClick={() => setIsSettingsOpen(true)} aria-label="Configurar sprints" title="Configurar sprints">
              <Settings size={18} />
            </button>
          </div>
        </header>
        <BacklogCalendarView backlogItems={backlogItems} categories={categories} clients={clients} members={members} searchTerm={searchTerm} sprints={sprints} statuses={statuses} viewMode={viewMode} onSprintsChange={onSprintsChange} onUpdateItemEstimate={onUpdateItemEstimate} onUpdateSprintEstimates={onUpdateSprintEstimates} />
      </section>
      {isSettingsOpen && (
        <SprintSettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSprintsChange={onSprintsChange}
          onStatusesChange={onStatusesChange}
          sprints={sprints}
          statuses={statuses}
        />
      )}
    </main>
  );
}

function SprintStatusPicker({
  ariaLabel,
  statusId,
  statuses,
  onChange
}: {
  ariaLabel: string;
  statusId: string;
  statuses: SprintStatus[];
  onChange: (statusId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedStatus = statuses.find((status) => status.id === statusId) ?? statuses[0];

  return (
    <div className="sprint-status-picker">
      <button
        className="sprint-status-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={`status-dot ${selectedStatus.color}`} />
        <span className="sprint-status-label">{selectedStatus.name}</span>
        <ChevronDown size={15} />
      </button>
      {isOpen && (
        <div className="sprint-status-menu" role="listbox">
          {statuses.map((status) => (
            <button
              type="button"
              key={status.id}
              role="option"
              aria-selected={status.id === statusId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(status.id);
                setIsOpen(false);
              }}
            >
              <span className={`status-dot ${status.color}`} />
              {status.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SprintPointsModal({ breakdown, onClose }: { breakdown: SprintPointBreakdown; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel sprint-points-panel" role="dialog" aria-modal="true" aria-labelledby="sprint-points-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="sprint-points-title">{breakdown.sprintName}</h2>
            <p>{breakdown.totalPoints} story points estimados em {breakdown.totalHours}h.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="sprint-points-summary">
          <strong>{breakdown.totalPoints}</strong>
          <span>Story points</span>
          <strong>{breakdown.totalHours}h</strong>
          <span>Horas estimadas</span>
        </div>
        <div className="sprint-points-list">
          {breakdown.categories.length === 0 ? (
            <p>Nenhuma atividade com story point nesta sprint.</p>
          ) : (
            breakdown.categories.map((category) => (
              <div className="sprint-points-row" key={category.category}>
                <span>{category.category}</span>
                <span>{category.items} itens</span>
                <strong>{category.points} SP</strong>
                <strong>{category.hours}h</strong>
                <small>{category.rate}h por SP</small>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SprintCapacityModal({
  members,
  onClose,
  onSave,
  sprint
}: {
  members: ProductMember[];
  onClose: () => void;
  onSave: (capacityByMember: Record<string, number>) => void;
  sprint: SprintPlan;
}) {
  const [capacityByMember, setCapacityByMember] = useState<Record<string, number>>(() => ({ ...(sprint.capacityByMember ?? {}) }));
  const businessDays = getBusinessDays(sprint.start, sprint.end);
  const dailyCapacity = members.reduce((total, member) => total + (Number(capacityByMember[member.id]) || 0), 0);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel sprint-capacity-panel" role="dialog" aria-modal="true" aria-labelledby="sprint-capacity-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="sprint-capacity-title">Capacity - {sprint.name}</h2>
            <p>{businessDays} dias uteis no periodo da sprint.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="capacity-member-list">
          {members.map((member) => (
            <label key={member.id}>
              <span>{member.name}</span>
              <input
                min={0}
                type="number"
                value={capacityByMember[member.id] ?? ""}
                onChange={(event) => setCapacityByMember({ ...capacityByMember, [member.id]: Number(event.target.value) || 0 })}
                placeholder="0"
              />
            </label>
          ))}
        </div>
        <div className="capacity-total-strip">
          <span>Capacity diario: <strong>{dailyCapacity}h</strong></span>
          <span>Capacity total: <strong>{dailyCapacity * businessDays}h</strong></span>
        </div>
        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              onSave(Object.fromEntries(members.map((member) => [member.id, Number(capacityByMember[member.id]) || 0])))
            }
          >
            Salvar capacity
          </button>
        </footer>
      </section>
    </div>
  );
}

function SprintCapacityBreakdownModal({ breakdown, onClose }: { breakdown: SprintCapacityBreakdown; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel sprint-capacity-panel" role="dialog" aria-modal="true" aria-labelledby="sprint-capacity-breakdown-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="sprint-capacity-breakdown-title">Capacity - {breakdown.sprintName}</h2>
            <p>{breakdown.totalCapacity}h totais em {breakdown.businessDays} dias uteis.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="capacity-total-strip">
          <span>Capacity diario: <strong>{breakdown.dailyCapacity}h</strong></span>
          <span>Sem squad: <strong>{breakdown.unassignedItems} atividades / {breakdown.unassignedHours}h</strong></span>
        </div>
        <div className="capacity-squad-list">
          {breakdown.squads.length === 0 ? (
            <p>Nenhuma empresa presente nos cards desta sprint.</p>
          ) : (
            breakdown.squads.map((squad) => (
              <div className={`capacity-squad-row ${squad.hasSquad ? "with-squad" : "without-squad"}`} key={squad.clientName}>
                <span>{squad.clientName}</span>
                <small>{squad.items} atividades</small>
                <strong>{squad.plannedHours}h planejadas</strong>
                {squad.hasSquad ? (
                  <>
                    <strong className={squad.remainingHours < 0 ? "capacity-negative" : ""}>{squad.remainingHours}h restantes</strong>
                    <small>Meta mensal: {squad.monthlyHours}h</small>
                  </>
                ) : (
                  <small className="capacity-no-squad">Sem squad</small>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SprintSettingsModal({
  onClose,
  onSprintsChange,
  onStatusesChange,
  sprints,
  statuses
}: {
  onClose: () => void;
  onSprintsChange: (sprints: SprintPlan[]) => void;
  onStatusesChange: (statuses: SprintStatus[]) => void;
  sprints: SprintPlan[];
  statuses: SprintStatus[];
}) {
  const [sprintName, setSprintName] = useState(`Sprint ${sprints.length + 12}`);
  const [sprintStart, setSprintStart] = useState("01/06/2026");
  const [sprintEnd, setSprintEnd] = useState("14/06/2026");
  const [sprintObjective, setSprintObjective] = useState("Definir objetivo da sprint.");
  const [selectedStatusId, setSelectedStatusId] = useState(statuses[0]?.id ?? "");
  const selectedStatus = statuses.find((status) => status.id === selectedStatusId) ?? statuses[0];

  function addSprint() {
    const planningStatus = statuses.find((status) => status.name === "Planejamento") ?? statuses[0];
    onSprintsChange([
      ...sprints,
      {
        id: `sprint-${Date.now()}`,
        name: sprintName.trim() || `Sprint ${sprints.length + 1}`,
        start: sprintStart,
        end: sprintEnd,
        objective: sprintObjective,
        statusId: planningStatus.id
      }
    ]);
  }

  function addStatus() {
    const nextStatus = {
      id: `status-${Date.now()}`,
      name: "Novo estado",
      color: "blue" as BoardTabColor
    };

    onStatusesChange([
      ...statuses,
      nextStatus
    ]);
    setSelectedStatusId(nextStatus.id);
  }

  function selectStatus(status: SprintStatus) {
    setSelectedStatusId(status.id);
  }

  function updateSelectedStatus(updates: Partial<Pick<SprintStatus, "name" | "color">>) {
    if (!selectedStatus) {
      return;
    }

    onStatusesChange(statuses.map((status) => status.id === selectedStatus.id ? { ...status, ...updates } : status));
  }

  function deleteSelectedStatus() {
    if (!selectedStatus || statuses.length <= 1) {
      return;
    }

    const fallbackStatus = statuses.find((status) => status.id !== selectedStatus.id);

    if (!fallbackStatus) {
      return;
    }

    onStatusesChange(statuses.filter((status) => status.id !== selectedStatus.id));
    onSprintsChange(sprints.map((sprint) => sprint.statusId === selectedStatus.id ? { ...sprint, statusId: fallbackStatus.id } : sprint));
    setSelectedStatusId(fallbackStatus.id);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel sprint-settings-panel" role="dialog" aria-modal="true" aria-labelledby="sprint-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="sprint-settings-title">Configurar sprints</h2>
            <p>Crie sprints e estados para o calendario.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <form>
          <section className="sprint-settings-grid">
            <div className="settings-subpanel">
              <h3>Nova sprint</h3>
              <label>
                <span>Nome</span>
                <input value={sprintName} onChange={(event) => setSprintName(event.target.value)} />
              </label>
              <div className="date-range-grid">
                <label>
                  <span>Inicio</span>
                  <input value={sprintStart} onChange={(event) => setSprintStart(event.target.value)} />
                </label>
                <label>
                  <span>Fim</span>
                  <input value={sprintEnd} onChange={(event) => setSprintEnd(event.target.value)} />
                </label>
              </div>
              <label>
                <span>Objetivo</span>
                <textarea value={sprintObjective} onChange={(event) => setSprintObjective(event.target.value)} />
              </label>
              <button className="primary-button" type="button" onClick={addSprint}>Criar sprint</button>
            </div>

            <div className="settings-subpanel">
              <div className="settings-section-head">
                <h3>Estados</h3>
                <button className="square-action compact-square-action" type="button" onClick={addStatus} aria-label="Adicionar estado" title="Adicionar estado">
                  <Plus size={18} />
                </button>
              </div>
              <div className="status-preview-list">
                {statuses.map((status) => (
                  <button
                    className={`configured-tab ${status.color} ${selectedStatus?.id === status.id ? "active" : ""}`}
                    key={status.id}
                    type="button"
                    onClick={() => selectStatus(status)}
                  >
                    {status.name}
                  </button>
                ))}
              </div>
              <label>
                <span>Editar estado selecionado</span>
                <input
                  value={selectedStatus?.name ?? ""}
                  onChange={(event) => updateSelectedStatus({ name: event.target.value })}
                />
              </label>
              <div className="visual-option-field">
                <span>Cor da borda</span>
                <div className="color-picker" aria-label="Cores do estado">
                  {boardColorOptions.map((option) => (
                    <button
                      className={`color-swatch ${option.value} ${selectedStatus?.color === option.value ? "active" : ""}`}
                      key={option.value}
                      type="button"
                      onClick={() => updateSelectedStatus({ color: option.value })}
                      title={option.label}
                      aria-label={option.label}
                    />
                  ))}
                </div>
              </div>
              <button className="danger-button" type="button" onClick={deleteSelectedStatus} disabled={statuses.length <= 1}>Excluir estado</button>
            </div>
          </section>
        </form>

        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
          <button className="primary-button" type="button" onClick={onClose}>Salvar</button>
        </footer>
      </section>
    </div>
  );
}

function getBoardColorHex(color: BoardTabColor) {
  const colors: Record<BoardTabColor, string> = {
    blue: "#1f6fff",
    purple: "#7a5af8",
    orange: "#f59b0b",
    red: "#f04438",
    green: "#17b26a",
    pink: "#d63384",
    cyan: "#06aed4",
    teal: "#0f9f8f",
    indigo: "#4f46e5",
    slate: "#475569"
  };

  return colors[color];
}

function getCategoryTone(category: string): "blue" | "red" | "yellow" | "green" | "pink" {
  const tones: Record<string, "blue" | "red" | "yellow" | "green" | "pink"> = {
    SLA: "blue",
    Squad: "yellow",
    Seguranca: "pink",
    Infraestrutura: "red",
    Melhoria: "green"
  };

  return tones[category] ?? "blue";
}

function getPriorityTone(priority: Priority): "blue" | "red" | "yellow" | "green" | "pink" {
  if (priority === "Urgente") {
    return "pink";
  }

  if (priority === "Alta") {
    return "red";
  }

  if (priority === "Media") {
    return "yellow";
  }

  if (priority === "Baixa") {
    return "green";
  }

  return "blue";
}

function extractLinearIdentifier(linearUrl: string) {
  const trimmedUrl = linearUrl.trim();

  if (!trimmedUrl) {
    return "";
  }

  const match = trimmedUrl.match(/\/([A-Z]+-\d+)(?:\b|$)/i) ?? trimmedUrl.match(/\b([A-Z]+-\d+)\b/i);
  return match?.[1]?.toUpperCase() ?? "";
}

function CreateItemModal({
  categories,
  clients,
  defaultSprint,
  members,
  mode = "backlog",
  onClose,
  onCreate,
  submitLabel,
  sprints
}: {
  categories: CategoryConfig[];
  clients: ClientAccount[];
  defaultSprint?: string;
  members: ProductMember[];
  mode?: "backlog" | "board";
  onClose: () => void;
  onCreate: (input: CreateItemInput) => void;
  submitLabel?: string;
  sprints: SprintPlan[];
}) {
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemSprint, setItemSprint] = useState(defaultSprint ?? sprints[0]?.name ?? "Em planejamento");
  const [itemCategory, setItemCategory] = useState(categories[0]?.name ?? "Melhoria");
  const [itemPriority, setItemPriority] = useState<Priority>("Media");
  const [itemOwner, setItemOwner] = useState("");
  const [itemAssistants, setItemAssistants] = useState<string[]>([]);
  const [itemStoryPoints, setItemStoryPoints] = useState("");
  const [itemClient, setItemClient] = useState("");
  const [itemLinearUrl, setItemLinearUrl] = useState("");
  const [shouldCreateLinearIssue, setShouldCreateLinearIssue] = useState(false);
  const [formError, setFormError] = useState("");

  function handleCreate() {
    const trimmedLinearUrl = itemLinearUrl.trim();

    if (trimmedLinearUrl && shouldCreateLinearIssue) {
      setFormError("Escolha apenas uma opcao: vincular um link existente ou criar uma nova issue no Linear.");
      return;
    }

    const linearAction: LinearCreateAction = trimmedLinearUrl ? "link" : shouldCreateLinearIssue ? "create" : "none";
    setFormError("");
    onCreate({
      linearAction,
      item: {
      name: itemName.trim() || "Tarefa sem titulo",
      sprint: itemSprint,
      category: itemCategory,
      priority: itemPriority,
      description: itemDescription.trim() || undefined,
      client: itemClient || undefined,
      assistants: itemAssistants.length > 0 ? itemAssistants : undefined,
      linearIdentifier: trimmedLinearUrl ? extractLinearIdentifier(trimmedLinearUrl) || undefined : undefined,
      linearUrl: trimmedLinearUrl || undefined,
      owner: itemOwner || undefined,
      storyPoints: itemStoryPoints ? Number(itemStoryPoints) : undefined
      }
    });
  }

  function toggleAssistant(memberName: string) {
    setItemAssistants((currentAssistants) =>
      currentAssistants.includes(memberName)
        ? currentAssistants.filter((assistant) => assistant !== memberName)
        : [...currentAssistants, memberName]
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-item-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="create-item-title">Adicionar novo item</h2>
            <p>{mode === "board" ? "Crie um card no board e defina como ele se relaciona com o Linear." : "Crie o item no backlog e defina como ele se relaciona com o Linear."}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <form>
          <h3>Informacoes do item</h3>
          <label>
            <span>Nome da tarefa *</span>
            <input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Ex.: Erro ao gerar boleto" />
          </label>
          <div className="epic-item-row">
            <label>
              <span>Responsavel</span>
              <select value={itemOwner} onChange={(event) => setItemOwner(event.target.value)}>
                <option value="">Sem responsavel</option>
                {members.map((member) => <option value={member.name} key={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>
              <span>Story Point</span>
              <select value={itemStoryPoints} onChange={(event) => setItemStoryPoints(event.target.value)}>
                <option value="">Sem estimativa</option>
                {linearEstimateOptions.map((option) => <option key={option} value={option}>{option} {option === 1 ? "ponto" : "pontos"}</option>)}
              </select>
            </label>
          </div>
          <div className="assistant-picker">
            <span>Assistentes</span>
            <details>
              <summary>{itemAssistants.length > 0 ? `${itemAssistants.length} selecionado${itemAssistants.length > 1 ? "s" : ""}` : "Selecionar assistentes"}</summary>
              <div>
                {members.map((member) => (
                  <label key={member.id}>
                    <input
                      checked={itemAssistants.includes(member.name)}
                      type="checkbox"
                      onChange={() => toggleAssistant(member.name)}
                    />
                    {member.name}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <label>
            <span>Descricao</span>
            <textarea value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="Descreva a demanda..." />
          </label>
          <label>
            <span>Link Linear</span>
            <input value={itemLinearUrl} onChange={(event) => setItemLinearUrl(event.target.value)} placeholder="Cole o link da issue existente" />
          </label>
          <label className="inline-check add-to-sprint-check">
            <input checked={shouldCreateLinearIssue} type="checkbox" onChange={(event) => setShouldCreateLinearIssue(event.target.checked)} />
            Criar nova issue no Linear se o link estiver vazio
          </label>
          {formError && <p className="form-error">{formError}</p>}
          <div className="epic-item-row">
            <label>
              <span>Cliente</span>
              <select value={itemClient} onChange={(event) => setItemClient(event.target.value)}>
                <option value="">Sem cliente</option>
                {clients.map((client) => <option value={client.name} key={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label>
              <span>Sprint</span>
              <select value={itemSprint} onChange={(event) => setItemSprint(event.target.value)}>
                <option value="Em planejamento">Em planejamento</option>
                {sprints.map((sprint) => <option value={sprint.name} key={sprint.id}>{sprint.name}</option>)}
              </select>
            </label>
            <label>
              <span>Categoria</span>
              <select value={itemCategory} onChange={(event) => setItemCategory(event.target.value)}>
                {categories.map((category) => <option key={category.id}>{category.name}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Prioridade</span>
            <select value={itemPriority} onChange={(event) => setItemPriority(event.target.value as Priority)}>
              {priorityOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>

        </form>

        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="button" onClick={handleCreate}>{submitLabel ?? "Adicionar ao backlog"}</button>
        </footer>
      </section>
    </div>
  );
}

function CreateEpicModal({
  categories,
  onClose,
  onCreate
}: {
  categories: CategoryConfig[];
  onClose: () => void;
  onCreate: (epic: Omit<BacklogEpic, "id" | "order" | "createdAt">) => void;
}) {
  const [epicName, setEpicName] = useState("");
  const [objective, setObjective] = useState("");
  const [plannedItems, setPlannedItems] = useState<Array<Omit<BacklogItem, "order" | "createdAt" | "priority" | "sprint"> & { priority: Priority }>>([
    { name: "", category: categories[0]?.name ?? "Squad", priority: "Media" },
    { name: "", category: categories[1]?.name ?? categories[0]?.name ?? "Melhoria", priority: "Alta" },
    { name: "", category: categories[2]?.name ?? categories[0]?.name ?? "Seguranca", priority: "Alta" }
  ]);

  function updatePlannedItem(index: number, field: "name" | "category", value: string) {
    setPlannedItems((currentItems) =>
      currentItems.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    );
  }

  function addPlannedItem() {
    setPlannedItems((currentItems) => [
      ...currentItems,
      { name: "", category: categories[0]?.name ?? "Melhoria", priority: "Media" }
    ]);
  }

  function handleCreate() {
    onCreate({
      name: epicName.trim() || "Epico sem titulo",
      objective,
      items: plannedItems.map((item, index) => ({
        ...item,
        name: item.name.trim() || `Item ${index + 1}`,
        order: 0,
        sprint: currentSprint,
        createdAt: ""
      }))
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel epic-modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-epic-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="create-epic-title">Criar epico</h2>
            <p>Um epico agrupa varios itens relacionados ao mesmo objetivo.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <form>
          <h3>Informacoes do epico</h3>
          <label>
            <span>Nome do epico *</span>
            <input value={epicName} onChange={(event) => setEpicName(event.target.value)} placeholder="Ex.: Nova jornada de pagamento" />
          </label>
          <label>
            <span>Objetivo</span>
            <textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Descreva o resultado esperado..." />
          </label>

          <h3>Itens do epico</h3>
          <div className="epic-items-table">
            <div className="epic-item-row epic-item-head">
              <span>Item</span>
              <span>Categoria</span>
            </div>
            {plannedItems.map((item, index) => (
              <div className="epic-item-row" key={`${item.name}-${index}`}>
                <input
                  value={item.name}
                  onChange={(event) => updatePlannedItem(index, "name", event.target.value)}
                  aria-label={`Nome do item ${index + 1}`}
                  placeholder={["Mapear regras de negocio", "Implementar fluxo principal", "Validar seguranca e auditoria"][index] ?? "Novo item do epico"}
                />
                <select value={item.category} onChange={(event) => updatePlannedItem(index, "category", event.target.value)} aria-label={`Categoria do item ${index + 1}`}>
                  {categories.map((category) => <option key={category.id}>{category.name}</option>)}
                </select>
              </div>
            ))}
          </div>

          <button className="secondary-button add-epic-item-button" type="button" onClick={addPlannedItem}>
            <Plus size={16} />
            Adicionar item ao epico
          </button>
        </form>

        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="button" onClick={handleCreate}>Criar epico</button>
        </footer>
      </section>
    </div>
  );
}

function BoardPage({
  columns,
  initialVisibleTabs,
  members,
  onColumnsChange,
  onCardMovedToColumn,
  onInitialVisibleTabsChange,
  backlogColumns,
  categories,
  clients,
  sprintBacklogItems,
  sprints,
  sprintStatuses,
  onSprintsChange,
  theme,
  onToggleTheme
}: {
  columns: BoardColumn[];
  initialVisibleTabs: number;
  members: ProductMember[];
  onColumnsChange: (columns: BoardColumn[]) => void;
  onCardMovedToColumn: (cardTitle: string, columnTitle: string) => void;
  onInitialVisibleTabsChange: (value: number) => void;
  backlogColumns: BacklogColumn[];
  categories: CategoryConfig[];
  clients: ClientAccount[];
  sprintBacklogItems: BacklogItem[];
  sprints: SprintPlan[];
  sprintStatuses: SprintStatus[];
  onSprintsChange: (sprints: SprintPlan[]) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
  const [createTargetColumnIndex, setCreateTargetColumnIndex] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [selectedBoardCardTarget, setSelectedBoardCardTarget] = useState<{ columnIndex: number; cardIndex: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ columnIndex: number; cardIndex: number; title: string } | null>(null);
  const [integrationNotice, setIntegrationNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const activeSprint = getActiveSprint(sprints, sprintStatuses);
  const [selectedSprintId, setSelectedSprintId] = useState(activeSprint?.id ?? sprints[0]?.id ?? "");
  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) ?? activeSprint ?? sprints[0];
  const visibleColumns = mergeBoardColumnsWithSprintConnections(columns, sprintBacklogItems, selectedSprint?.name);
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const matchesOwnerFilter = (card: BoardCard) => !ownerFilter || card.owner === ownerFilter || (card.assistants ?? []).includes(ownerFilter);
  const filteredColumns = visibleColumns.map((column) => ({
    ...column,
    cards: column.cards
      .map((card, cardIndex) => ({ card, cardIndex }))
      .filter(({ card }) => matchesOwnerFilter(card) && (!normalizedSearchTerm || card.title.toLowerCase().includes(normalizedSearchTerm)))
  }));
  const productMemberInitials = members.map((member) => getInitials(member.name));
  const totalItems = filteredColumns.reduce((total, column) => total + column.cards.length, 0);

  useEffect(() => {
    const nextActiveSprint = getActiveSprint(sprints, sprintStatuses);

    if (nextActiveSprint && !selectedSprintId) {
      setSelectedSprintId(nextActiveSprint.id);
    }
  }, [selectedSprintId, sprints, sprintStatuses]);

  function handleDragStart(event: DragEvent<HTMLElement>, columnIndex: number, cardIndex: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${columnIndex}:${cardIndex}`);
    setDraggedCard({ columnIndex, cardIndex });
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetColumnIndex: number, targetCardIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedCard) {
      return;
    }

    const nextColumns = visibleColumns.map((column) => ({ ...column, cards: [...column.cards] }));
    const sourceColumn = nextColumns[draggedCard.columnIndex];
    const targetColumn = nextColumns[targetColumnIndex];
    const cardToMove = sourceColumn.cards[draggedCard.cardIndex];

    if (!cardToMove) {
      return;
    }

    if (targetColumnIndex < draggedCard.columnIndex && hasDeliveryDataToDiscard(cardToMove, targetColumnIndex)) {
      const confirmed = window.confirm("Esta tarefa possui dados em abas posteriores. Deseja voltar a tarefa e remover esses dados?");

      if (!confirmed) {
        setDraggedCard(null);
        return;
      }
    }

    const [removedCard] = sourceColumn.cards.splice(draggedCard.cardIndex, 1);

    if (!removedCard) {
      return;
    }

    const adjustedIndex =
      draggedCard.columnIndex === targetColumnIndex && draggedCard.cardIndex < targetCardIndex
        ? targetCardIndex - 1
        : targetCardIndex;

    const movedCard = getMovedCard(removedCard, nextColumns, draggedCard.columnIndex, targetColumnIndex);

    targetColumn.cards.splice(adjustedIndex, 0, movedCard);
    onColumnsChange(nextColumns);
    onCardMovedToColumn(movedCard.title, targetColumn.title);
    void syncBoardIssueUpdate(movedCard, targetColumn.title)
      .then((result) => {
        if (result.statusMatched === false) {
          setIntegrationNotice({ tone: "error", message: result.message ?? `Nao ha status no Linear com o nome "${targetColumn.title}".` });
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O card mudou de aba, mas o status nao foi atualizado no Linear. ${message}` });
      });

    setDraggedCard(null);
  }

  function deleteBoardCard() {
    if (!deleteTarget) {
      return;
    }

    const cardToDelete = visibleColumns[deleteTarget.columnIndex]?.cards[deleteTarget.cardIndex];

    onColumnsChange(
      visibleColumns.map((column, columnIndex) =>
        columnIndex === deleteTarget.columnIndex
          ? { ...column, cards: column.cards.filter((_, cardIndex) => cardIndex !== deleteTarget.cardIndex) }
          : column
      )
    );
    if (cardToDelete) {
      void archiveIssue(toArchiveBoardIssuePayload(cardToDelete)).catch((error) => {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O card foi removido localmente, mas nao foi arquivado no Linear. ${message}` });
      });
    }
    setDeleteTarget(null);
  }

  function updateSelectedSprintObjective(objective: string) {
    if (!selectedSprint) {
      return;
    }

    onSprintsChange(sprints.map((sprint) => sprint.id === selectedSprint.id ? { ...sprint, objective } : sprint));
  }

  async function handleCreateBoardCard({ item, linearAction }: CreateItemInput) {
    if (createTargetColumnIndex === null) {
      return;
    }

    let newCard: BoardCard = {
      id: `#${Date.now()}`,
      title: item.name,
      priority: item.priority,
      owner: item.owner ?? "",
      assistants: item.assistants,
      points: item.storyPoints ?? 0,
      sprint: item.sprint,
      category: item.category,
      client: item.client,
      description: item.description,
      estimate: item.estimate,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      createdBy: "Board",
      linearIdentifier: item.linearIdentifier,
      linearUrl: item.linearUrl,
      generalFields: getGeneralFieldValues(item.name, item.owner ?? "", item.storyPoints ?? 0)
    };

    if (linearAction !== "none") {
      try {
        const result = await createIssue({
          category: item.category,
          client: item.client,
          description: item.description,
          linearIdentifier: item.linearIdentifier,
          linearUrl: item.linearUrl,
          name: item.name,
          owner: item.owner,
          priority: item.priority,
          sprint: item.sprint,
          storyPoints: item.storyPoints
        });
        newCard = applyCreatedIssueLink(newCard, result);
        setIntegrationNotice({
          tone: newCard.linearIssueId ? "success" : "error",
          message: newCard.linearIssueId
            ? linearAction === "link" ? "Issue Linear vinculada ao card." : "Card criado na integracao Linear/n8n."
            : "A integracao Linear/n8n respondeu, mas nao trouxe o id real da issue Linear."
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Integracao indisponivel.";
        setIntegrationNotice({ tone: "error", message: `O card foi criado localmente, mas nao foi ${linearAction === "link" ? "vinculado ao" : "criado no"} Linear. ${message}` });
      }
    }

    onColumnsChange(
      columns.map((column, columnIndex) =>
        columnIndex === createTargetColumnIndex ? { ...column, cards: [newCard, ...column.cards] } : column
      )
    );
    setCreateTargetColumnIndex(null);
  }

  function openBoardCardDetails(card: BoardCard, columnIndex: number, cardIndex: number, status: string) {
    setSelectedBoardCardTarget({ columnIndex, cardIndex });
    setSelectedTask(toBoardTaskDetail(card, status, columns));
  }

  function saveBoardCardDetails(updates: Partial<Pick<BoardCard, "assistants" | "category" | "client" | "description" | "estimate" | "owner" | "points" | "priority" | "sprint" | "title">>) {
    if (!selectedBoardCardTarget) {
      return;
    }

    const { columnIndex, cardIndex } = selectedBoardCardTarget;
    const currentCard = visibleColumns[columnIndex]?.cards[cardIndex];
    const nextCard = currentCard
      ? {
          ...currentCard,
          ...updates,
          generalFields: getGeneralFieldValues(
            updates.title ?? currentCard.title,
            updates.owner ?? currentCard.owner,
            updates.points ?? currentCard.points
          )
        }
      : null;

    if (!nextCard) {
      return;
    }

    onColumnsChange(
      visibleColumns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              cards: column.cards.map((card, currentCardIndex) =>
                currentCardIndex === cardIndex ? nextCard : card
              )
            }
          : column
      )
    );

    void syncBoardIssueUpdate(nextCard, visibleColumns[columnIndex]?.title).catch((error) => {
      const message = error instanceof Error ? error.message : "Integracao indisponivel.";
      setIntegrationNotice({ tone: "error", message: `O card foi atualizado localmente, mas nao foi atualizado no Linear. ${message}` });
    });
    setSelectedTask(null);
    setSelectedBoardCardTarget(null);
  }

  return (
    <main className="dashboard board-page">
      <Topbar title="Board" subtitle="Acompanhe o progresso dos itens de delivery" theme={theme} onToggleTheme={onToggleTheme} />

      <section className="board-controls" aria-label="Controles do board">
        <div className="sprint-controls board-sprint-context">
          <label className="board-sprint-select">
            <span>Sprint</span>
            <select value={selectedSprint?.id ?? ""} onChange={(event) => setSelectedSprintId(event.target.value)}>
              {sprints.map((sprint) => (
                <option value={sprint.id} key={sprint.id}>{sprint.name}</option>
              ))}
            </select>
          </label>
          <div className="board-sprint-summary">
            {selectedSprint && (
              <div className="board-sprint-meta">
                <textarea
                  aria-label={`Objetivo da ${selectedSprint.name}`}
                  value={selectedSprint.objective}
                  onChange={(event) => updateSelectedSprintObjective(event.target.value)}
                />
                <span>{selectedSprint.start} - {selectedSprint.end}</span>
              </div>
            )}
            <div className="board-members" aria-label="Membros da sprint">
              {productMemberInitials.map((initials) => <span key={initials}>{initials}</span>)}
            </div>
          </div>
        </div>
        <div className="board-actions">
          <label className="search-field board-search-field">
            <Search size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar titulo do card..." />
          </label>
          <label className="board-filter-control">
            <ListFilter size={18} />
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} aria-label="Filtrar por responsavel">
              <option value="">Todos responsaveis</option>
              {members.map((member) => <option value={member.name} key={member.id}>{member.name}</option>)}
            </select>
          </label>
          <button className="square-action" type="button" onClick={() => setIsBoardSettingsOpen(true)} aria-label="Configurar board" title="Configurar board">
            <Settings size={18} />
          </button>
        </div>
      </section>

      <div className="board-callout">
        <span>i</span>
        Arraste e solte os cards para definir a ordem de prioridade para o desenvolvimento.
      </div>

      {integrationNotice && (
        <div className={`info-callout integration-notice ${integrationNotice.tone}`}>
          <span>{integrationNotice.tone === "success" ? "OK" : "!"}</span>
          {integrationNotice.message}
        </div>
      )}

      <DualHorizontalScroll className="board-scroll-frame">
        <section
          className="kanban-board"
          aria-label="Board da sprint"
        >
          {filteredColumns.map((column, columnIndex) => (
            <article className={`kanban-column ${column.color}`} key={column.title} onDragOver={handleDragOver} onDrop={(event) => handleDrop(event, columnIndex, visibleColumns[columnIndex]?.cards.length ?? column.cards.length)}>
              <header className="kanban-column-header">
                <span className={`column-icon ${column.color}`}>
                  {renderBoardIcon(column.icon, 15)}
                </span>
                <h2>{column.title}</h2>
                <ColumnDescriptionButton description={column.description} title={column.title} />
                <span className="column-count">{column.cards.length}</span>
                <button type="button" aria-label={`Adicionar card em ${column.title}`} onClick={() => setCreateTargetColumnIndex(columnIndex)}>
                  <Plus size={18} />
                </button>
              </header>

              <div className="kanban-card-list">
                {column.cards.map(({ card, cardIndex }) => (
                  <BoardCardItem
                    card={card}
                    isDragging={draggedCard?.columnIndex === columnIndex && draggedCard.cardIndex === cardIndex}
                    key={card.id}
                    onDragEnd={() => setDraggedCard(null)}
                    onDragOver={handleDragOver}
                    onDragStart={(event) => handleDragStart(event, columnIndex, cardIndex)}
                    onDrop={(event) => handleDrop(event, columnIndex, cardIndex)}
                    onOpenDetails={() => openBoardCardDetails(card, columnIndex, cardIndex, column.title)}
                    onRequestDelete={() => setDeleteTarget({ columnIndex, cardIndex, title: card.title })}
                  />
                ))}
              </div>

              <button className="add-card-button" type="button" onClick={() => setCreateTargetColumnIndex(columnIndex)}>
                <Plus size={17} />
                Adicionar card
              </button>
            </article>
          ))}
        </section>
      </DualHorizontalScroll>

      <footer className="board-footer">
        <div className="priority-legend">
          <span>Prioridade:</span>
          <span className="legend-item high"><ArrowUp size={16} />Alta</span>
          <span className="legend-item medium"><span />Media</span>
          <span className="legend-item low"><ArrowDown size={16} />Baixa</span>
        </div>
        <div className="board-summary">
          <span>Total de itens: {totalItems}</span>
          <button className="secondary-button" type="button">
            <RefreshCcw size={17} />
            Atualizar
          </button>
        </div>
      </footer>

      {isBoardSettingsOpen && (
        <BoardSettingsModal
          columns={columns}
          initialVisibleTabs={initialVisibleTabs}
          onClose={() => setIsBoardSettingsOpen(false)}
          onColumnsChange={onColumnsChange}
          onInitialVisibleTabsChange={onInitialVisibleTabsChange}
          backlogColumns={backlogColumns}
        />
      )}
      {selectedTask && (
        <TaskDetailsModal
          categories={categories}
          clients={clients}
          editable={Boolean(selectedBoardCardTarget)}
          members={members}
          onClose={() => {
            setSelectedTask(null);
            setSelectedBoardCardTarget(null);
          }}
          onSave={saveBoardCardDetails}
          sprints={sprints}
          task={selectedTask}
        />
      )}
      {createTargetColumnIndex !== null && (
        <CreateItemModal
          categories={categories}
          clients={clients}
          defaultSprint={selectedSprint?.name}
          members={members}
          mode="board"
          onClose={() => setCreateTargetColumnIndex(null)}
          onCreate={handleCreateBoardCard}
          sprints={sprints}
          submitLabel="Adicionar ao board"
        />
      )}
      {deleteTarget && (
        <DeleteCardConfirmModal
          itemName={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteBoardCard}
        />
      )}
    </main>
  );
}

function getMovedCard(card: BoardCard, columns: BoardColumn[], sourceColumnIndex: number, targetColumnIndex: number): BoardCard {
  if (targetColumnIndex === sourceColumnIndex) {
    return { ...card, done: columns[targetColumnIndex].title === "Aprovado" };
  }

  if (targetColumnIndex < sourceColumnIndex) {
    return {
      ...card,
      done: columns[targetColumnIndex].title === "Aprovado",
      deliveryHistory: (card.deliveryHistory ?? []).filter((entry) => entry.tabIndex <= targetColumnIndex)
    };
  }

  const existingTitles = new Set((card.deliveryHistory ?? []).map((entry) => entry.tabTitle));
  const targetColumn = columns[targetColumnIndex];
  const nextEntries = existingTitles.has(targetColumn.title)
    ? []
    : [createDeliveryEntry(targetColumn, targetColumnIndex, card.owner)];

  return {
    ...card,
    done: columns[targetColumnIndex].title === "Aprovado",
    deliveryHistory: [...(card.deliveryHistory ?? []), ...nextEntries]
  };
}

function mergeBoardColumnsWithSprintConnections(columns: BoardColumn[], sprintItems: BacklogItem[], sprintName?: string): BoardColumn[] {
  if (!sprintName) {
    return columns;
  }

  const targetColumnIndexes = columns
    .map((column, columnIndex) => ({ column, columnIndex }))
    .filter(({ column }) =>
      (column.connections ?? []).some((connection) => (connection.direction ?? "Receber de") === "Receber de" && connection.screen === "Sprint")
    )
    .map(({ columnIndex }) => columnIndex);

  if (targetColumnIndexes.length === 0) {
    return columns;
  }

  const selectedSprintItems = sprintItems.filter((item) => item.sprint === sprintName);

  if (selectedSprintItems.length === 0) {
    return columns;
  }

  const existingTitles = new Set(columns.flatMap((column) => column.cards.map((card) => card.title)));
  const derivedCards = selectedSprintItems
    .filter((item) => !existingTitles.has(item.name))
    .map(boardCardFromBacklogItem);

  if (derivedCards.length === 0) {
    return columns;
  }

  return columns.map((column, columnIndex) =>
    targetColumnIndexes.includes(columnIndex)
      ? { ...column, cards: [...derivedCards, ...column.cards] }
      : column
  );
}

function hasDeliveryDataToDiscard(card: BoardCard, targetColumnIndex: number) {
  return (card.deliveryHistory ?? [])
    .filter((entry) => entry.tabIndex > targetColumnIndex)
    .some((entry) => entry.fields.some((field) => field.value.trim() && field.value !== "Pendente"));
}

function toBoardTaskDetail(card: BoardCard, status: string, columns: BoardColumn[]): TaskDetail {
  const orderedDeliveryHistory = (card.deliveryHistory ?? [])
    .map((entry) => ({
      ...entry,
      tabIndex: columns.findIndex((column) => column.title === entry.tabTitle)
    }))
    .filter((entry) => entry.tabIndex >= 0)
    .sort((first, second) => second.tabIndex - first.tabIndex);

  return {
    id: card.id,
    title: card.title,
    source: "Board",
    priority: card.priority,
    description: card.description,
    status,
    owner: card.owner,
    assistants: card.assistants,
    points: card.points,
    estimate: card.estimate,
    sprint: card.sprint,
    category: card.category,
    client: card.client,
    createdAt: card.createdAt,
    createdBy: card.createdBy,
    generalFields: card.generalFields,
    deliveryHistory: orderedDeliveryHistory
  };
}

function BoardSettingsModal({
  backlogColumns,
  columns,
  initialVisibleTabs,
  onClose,
  onColumnsChange,
  onInitialVisibleTabsChange
}: {
  backlogColumns: BacklogColumn[];
  columns: BoardColumn[];
  initialVisibleTabs: number;
  onClose: () => void;
  onColumnsChange: (columns: BoardColumn[]) => void;
  onInitialVisibleTabsChange: (value: number) => void;
}) {
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<DraggedColumn | null>(null);
  const selectedColumn = columns[Math.min(selectedColumnIndex, columns.length - 1)];

  function updateInitialVisibleTabs(value: number) {
    const nextValue = Math.min(Math.max(value || 1, 1), Math.max(columns.length, 1));
    onInitialVisibleTabsChange(nextValue);
  }

  function updateExistingColumn(index: number, updates: Partial<Pick<BoardColumn, "title" | "description" | "color" | "icon">>) {
    onColumnsChange(columns.map((column, columnIndex) => (columnIndex === index ? { ...column, ...updates } : column)));
  }

  function updateExistingField(columnIndex: number, fieldIndex: number, field: keyof BoardTabField, value: string | boolean) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              fields: column.fields.map((currentField, currentFieldIndex) =>
                currentFieldIndex === fieldIndex ? { ...currentField, [field]: value } : currentField
              )
            }
          : column
      )
    );
  }

  function addExistingField(columnIndex: number) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              fields: [
                ...column.fields,
                { id: `field-${Date.now()}`, name: "Novo campo", type: "Texto curto", required: false }
              ]
            }
          : column
      )
    );
  }

  function removeExistingField(columnIndex: number, fieldIndex: number) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? { ...column, fields: column.fields.filter((_, currentFieldIndex) => currentFieldIndex !== fieldIndex) }
          : column
      )
    );
  }

  function deleteSelectedColumn() {
    if (columns.length <= 1) {
      return;
    }

    const nextColumns = columns.filter((_, columnIndex) => columnIndex !== selectedColumnIndex);
    onColumnsChange(nextColumns);
    setSelectedColumnIndex(Math.max(0, selectedColumnIndex - 1));
    setIsDeleteConfirming(false);
    updateInitialVisibleTabs(Math.min(initialVisibleTabs, nextColumns.length));
  }

  function addColumn() {
    const nextColumn: BoardColumn = {
      title: "Nova aba",
      description: "Descreva o objetivo desta aba.",
      color: "blue",
      icon: "columns",
      fields: [
        { id: `field-title-${Date.now()}`, name: "Titulo", type: "Texto curto", required: true },
        { id: `field-description-${Date.now()}`, name: "Descricao", type: "Texto longo", required: false }
      ],
      connections: [],
      cards: []
    };

    onColumnsChange([...columns, nextColumn]);
    setSelectedColumnIndex(columns.length);
  }

  function handleColumnDragStart(event: DragEvent<HTMLButtonElement>, columnIndex: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(columnIndex));
    setDraggedColumn({ columnIndex });
  }

  function handleColumnDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleColumnDrop(event: DragEvent<HTMLButtonElement>, targetColumnIndex: number) {
    event.preventDefault();

    if (!draggedColumn || draggedColumn.columnIndex === targetColumnIndex) {
      setDraggedColumn(null);
      return;
    }

    const reorderedColumns = [...columns];
    const [movedColumn] = reorderedColumns.splice(draggedColumn.columnIndex, 1);
    reorderedColumns.splice(targetColumnIndex, 0, movedColumn);

    const nextColumns = normalizeDeliveryIndexes(reorderedColumns);
    const selectedColumnTitle = selectedColumn?.title;
    const nextSelectedIndex = selectedColumnTitle
      ? nextColumns.findIndex((column) => column.title === selectedColumnTitle)
      : targetColumnIndex;

    onColumnsChange(nextColumns);
    setSelectedColumnIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : targetColumnIndex);
    setDraggedColumn(null);
  }

  function getConnectionTargetOptions(screen: BoardConnectionScreen) {
    return screen === "Backlog"
      ? backlogColumns.map((column) => ({ id: column.title, label: column.title }))
      : [];
  }

  function addConnection(columnIndex: number) {
    const defaultTarget = getConnectionTargetOptions("Backlog")[0]?.id ?? "";
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              connections: [
                ...(column.connections ?? []),
                { id: `board-connection-${Date.now()}`, direction: "Receber de", screen: "Backlog", targetId: defaultTarget }
              ]
            }
          : column
      )
    );
  }

  function updateConnection(columnIndex: number, connectionId: string, updates: Partial<Pick<BoardConnection, "direction" | "screen" | "targetId">>) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              connections: (column.connections ?? []).map((connection) => {
                if (connection.id !== connectionId) {
                  return connection;
                }

                const nextScreen = updates.screen ?? connection.screen;
                const nextTarget = nextScreen === "Sprint"
                  ? ""
                  : updates.screen ? getConnectionTargetOptions(nextScreen)[0]?.id ?? "" : updates.targetId ?? connection.targetId;

                return { ...connection, ...updates, screen: nextScreen, targetId: nextTarget };
              })
            }
          : column
      )
    );
  }

  function removeConnection(columnIndex: number, connectionId: string) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? { ...column, connections: (column.connections ?? []).filter((connection) => connection.id !== connectionId) }
          : column
      )
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel board-settings-panel" role="dialog" aria-modal="true" aria-labelledby="board-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="board-settings-title">Configurar board</h2>
            <p>Defina abas, campos e visualizacao inicial do board.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <form>
          <section className="board-settings-section">
            <h3>Rolagem inicial</h3>
            <label>
              <span>Abas visiveis antes da rolagem</span>
              <input
                max={Math.max(columns.length, 1)}
                min={1}
                type="number"
                value={initialVisibleTabs}
                onChange={(event) => updateInitialVisibleTabs(Number(event.target.value))}
              />
            </label>
          </section>

          <section className="board-settings-section">
            <div className="settings-section-head">
              <h3>Abas existentes</h3>
              <button className="secondary-button" type="button" onClick={addColumn}>
                <Plus size={16} />
                Adicionar aba
              </button>
            </div>
            <div className="configured-tabs-list">
              {columns.map((column, columnIndex) => (
                <button
                  className={`configured-tab ${column.color} ${selectedColumnIndex === columnIndex ? "active" : ""} ${draggedColumn?.columnIndex === columnIndex ? "dragging" : ""}`}
                  draggable
                  key={`${column.title}-${columnIndex}`}
                  type="button"
                  onClick={() => {
                    setSelectedColumnIndex(columnIndex);
                    setIsDeleteConfirming(false);
                  }}
                  onDragEnd={() => setDraggedColumn(null)}
                  onDragOver={handleColumnDragOver}
                  onDragStart={(event) => handleColumnDragStart(event, columnIndex)}
                  onDrop={(event) => handleColumnDrop(event, columnIndex)}
                  title="Arraste para ordenar"
                >
                  <Hand className="drag-hand-icon" size={14} />
                  {renderBoardIcon(column.icon, 14)}
                  {column.title}
                </button>
              ))}
            </div>

            {selectedColumn && (
              <div className="board-tab-editor">
                <div className="tab-builder-grid">
                  <label>
                    <span>Nome da aba</span>
                    <input value={selectedColumn.title} onChange={(event) => updateExistingColumn(selectedColumnIndex, { title: event.target.value })} />
                  </label>
                  <label className="tab-description-field">
                    <span>Descricao da aba</span>
                    <textarea value={selectedColumn.description ?? ""} onChange={(event) => updateExistingColumn(selectedColumnIndex, { description: event.target.value })} />
                  </label>
                  <div className="visual-option-field">
                    <span>Cor</span>
                    <div className="color-picker" aria-label="Cores da aba">
                      {getOrderedBoardColorOptions(selectedColumn.color).map((option) => (
                        <button
                          className={`color-swatch ${option.value} ${selectedColumn.color === option.value ? "active" : ""}`}
                          key={option.value}
                          type="button"
                          onClick={() => updateExistingColumn(selectedColumnIndex, { color: option.value })}
                          title={option.label}
                          aria-label={option.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="visual-option-field">
                    <span>Icone</span>
                    <div className="icon-picker" aria-label="Icones da aba existente">
                      {boardIconOptions.map((option) => (
                        <button
                          className={selectedColumn.icon === option.value ? "active" : ""}
                          key={option.value}
                          type="button"
                          onClick={() => updateExistingColumn(selectedColumnIndex, { icon: option.value })}
                          title={option.label}
                          aria-label={option.label}
                        >
                          <option.icon size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <section className="connections-builder">
                  <div className="settings-section-head">
                    <h3>Conexoes</h3>
                    <button className="square-action compact-square-action" type="button" onClick={() => addConnection(selectedColumnIndex)} aria-label="Adicionar conexao" title="Adicionar conexao">
                      <Plus size={18} />
                    </button>
                  </div>

                  {(selectedColumn.connections ?? []).length === 0 ? (
                    <p>Nenhuma conexao configurada.</p>
                  ) : (
                    <div className="connection-list">
                      {(selectedColumn.connections ?? []).map((connection) => (
                        <div className={`connection-row ${connection.screen === "Sprint" ? "without-target" : ""}`} key={connection.id}>
                          <select
                            value={connection.direction ?? "Receber de"}
                            onChange={(event) => updateConnection(selectedColumnIndex, connection.id, { direction: event.target.value as ConnectionDirection })}
                            aria-label="Direcao da conexao"
                          >
                            <option>Receber de</option>
                            <option>Mover para</option>
                          </select>
                          <select
                            value={connection.screen}
                            onChange={(event) => updateConnection(selectedColumnIndex, connection.id, { screen: event.target.value as BoardConnectionScreen })}
                            aria-label="Tela da conexao"
                          >
                            <option>Backlog</option>
                            <option>Sprint</option>
                          </select>
                          {connection.screen !== "Sprint" && (
                            <select
                              value={connection.targetId}
                              onChange={(event) => updateConnection(selectedColumnIndex, connection.id, { targetId: event.target.value })}
                              aria-label="Aba conectada"
                            >
                              {getConnectionTargetOptions(connection.screen).map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          )}
                          <button type="button" onClick={() => removeConnection(selectedColumnIndex, connection.id)} aria-label="Remover conexao">
                            <X size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <BoardFieldsBuilder
                  fields={selectedColumn.fields}
                  onAddField={() => addExistingField(selectedColumnIndex)}
                  onRemoveField={(fieldIndex) => removeExistingField(selectedColumnIndex, fieldIndex)}
                  onUpdateField={(fieldIndex, field, value) => updateExistingField(selectedColumnIndex, fieldIndex, field, value)}
                />
                <div className="delete-tab-actions">
                  {!isDeleteConfirming ? (
                    <button className="danger-button delete-tab-button" type="button" onClick={() => setIsDeleteConfirming(true)} disabled={columns.length <= 1}>
                      Excluir esta aba
                    </button>
                  ) : (
                    <>
                      <span>Confirmar exclusao?</span>
                      <button className="danger-button" type="button" onClick={deleteSelectedColumn}>Confirmar</button>
                      <button className="secondary-button" type="button" onClick={() => setIsDeleteConfirming(false)}>Cancelar</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

        </form>

        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
          <button className="primary-button" type="button" onClick={onClose}>Salvar</button>
        </footer>
      </section>
    </div>
  );
}

function getOrderedBoardColorOptions(selectedColor: BoardTabColor) {
  const selectedOption = boardColorOptions.find((option) => option.value === selectedColor);
  const remainingOptions = boardColorOptions.filter((option) => option.value !== selectedColor);

  return selectedOption ? [selectedOption, ...remainingOptions] : boardColorOptions;
}

function BacklogSettingsModal({
  boardColumns,
  categories,
  columns,
  initialVisibleTabs,
  onClose,
  onCategoriesChange,
  onColumnsChange,
  onInitialVisibleTabsChange
}: {
  boardColumns: BoardColumn[];
  categories: CategoryConfig[];
  columns: BacklogColumn[];
  initialVisibleTabs: number;
  onClose: () => void;
  onCategoriesChange: (categories: CategoryConfig[]) => void;
  onColumnsChange: (columns: BacklogColumn[]) => void;
  onInitialVisibleTabsChange: (value: number) => void;
}) {
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<DraggedColumn | null>(null);
  const selectedColumn = columns[Math.min(selectedColumnIndex, columns.length - 1)];

  function addCategory() {
    onCategoriesChange([...categories, { id: `category-${Date.now()}`, name: "Nova categoria", color: "blue" }]);
  }

  function updateCategory(categoryId: string, updates: Partial<Pick<CategoryConfig, "name" | "color">>) {
    onCategoriesChange(categories.map((category) => category.id === categoryId ? { ...category, ...updates } : category));
  }

  function removeCategory(categoryId: string) {
    if (categories.length <= 1) {
      return;
    }

    onCategoriesChange(categories.filter((category) => category.id !== categoryId));
  }

  function updateInitialVisibleTabs(value: number) {
    const nextValue = Math.min(Math.max(value || 1, 1), Math.max(columns.length, 1));
    onInitialVisibleTabsChange(nextValue);
  }

  function updateColumn(index: number, updates: Partial<Pick<BacklogColumn, "title" | "description" | "color" | "icon">>) {
    onColumnsChange(columns.map((column, columnIndex) => (columnIndex === index ? { ...column, ...updates } : column)));
  }

  function toggleAiColumnSetting(index: number, field: "aiStoryEnabled" | "aiCriteriaEnabled" | "aiStoryPointsEnabled", checked: boolean) {
    onColumnsChange(columns.map((column, columnIndex) => ({ ...column, [field]: checked && columnIndex === index })));
  }

  function updateField(columnIndex: number, fieldIndex: number, field: keyof BoardTabField, value: string | boolean) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              fields: column.fields.map((currentField, currentFieldIndex) =>
                currentFieldIndex === fieldIndex ? { ...currentField, [field]: value } : currentField
              )
            }
          : column
      )
    );
  }

  function addField(columnIndex: number) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              fields: [
                ...column.fields,
                { id: `backlog-field-${Date.now()}`, name: "Novo campo", type: "Texto curto", required: false }
              ]
            }
          : column
      )
    );
  }

  function removeField(columnIndex: number, fieldIndex: number) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? { ...column, fields: column.fields.filter((_, currentFieldIndex) => currentFieldIndex !== fieldIndex) }
          : column
      )
    );
  }

  function addColumn() {
    const nextColumn: BacklogColumn = {
      title: "Nova aba",
      description: "Descreva o objetivo desta aba.",
      color: "blue",
      icon: "columns",
      fields: [
        { id: `backlog-field-title-${Date.now()}`, name: "Titulo", type: "Texto curto", required: true },
        { id: `backlog-field-description-${Date.now()}`, name: "Descricao", type: "Texto longo", required: false }
      ],
      entries: [],
      connections: []
    };

    onColumnsChange([...columns, nextColumn]);
    setSelectedColumnIndex(columns.length);
  }

  function deleteSelectedColumn() {
    if (columns.length <= 1) {
      return;
    }

    const removedColumn = columns[selectedColumnIndex];
    const nextColumns = columns.filter((_, columnIndex) => columnIndex !== selectedColumnIndex);

    if (removedColumn.entries.length > 0) {
      nextColumns[0] = { ...nextColumns[0], entries: [...removedColumn.entries, ...nextColumns[0].entries] };
    }

    onColumnsChange(nextColumns);
    setSelectedColumnIndex(Math.max(0, selectedColumnIndex - 1));
    setIsDeleteConfirming(false);
    updateInitialVisibleTabs(Math.min(initialVisibleTabs, nextColumns.length));
  }

  function handleColumnDragStart(event: DragEvent<HTMLButtonElement>, columnIndex: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(columnIndex));
    setDraggedColumn({ columnIndex });
  }

  function handleColumnDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleColumnDrop(event: DragEvent<HTMLButtonElement>, targetColumnIndex: number) {
    event.preventDefault();

    if (!draggedColumn || draggedColumn.columnIndex === targetColumnIndex) {
      setDraggedColumn(null);
      return;
    }

    const reorderedColumns = [...columns];
    const [movedColumn] = reorderedColumns.splice(draggedColumn.columnIndex, 1);
    reorderedColumns.splice(targetColumnIndex, 0, movedColumn);

    const selectedColumnTitle = selectedColumn?.title;
    const nextSelectedIndex = selectedColumnTitle
      ? reorderedColumns.findIndex((column) => column.title === selectedColumnTitle)
      : targetColumnIndex;

    onColumnsChange(reorderedColumns);
    setSelectedColumnIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : targetColumnIndex);
    setDraggedColumn(null);
  }

  function getConnectionTargetOptions(screen: BacklogConnectionScreen) {
    return screen === "Board"
      ? boardColumns.map((column) => ({ id: column.title, label: column.title }))
      : [];
  }

  function addConnection(columnIndex: number) {
    const defaultTarget = getConnectionTargetOptions("Board")[0]?.id ?? "";
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              connections: [
                ...(column.connections ?? []),
                { id: `connection-${Date.now()}`, direction: "Receber de", screen: "Board", targetId: defaultTarget }
              ]
            }
          : column
      )
    );
  }

  function updateConnection(columnIndex: number, connectionId: string, updates: Partial<Pick<BacklogConnection, "direction" | "screen" | "targetId">>) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? {
              ...column,
              connections: (column.connections ?? []).map((connection) => {
                if (connection.id !== connectionId) {
                  return connection;
                }

                const nextScreen = updates.screen ?? connection.screen;
                const nextTarget = nextScreen === "Sprint"
                  ? ""
                  : updates.screen ? getConnectionTargetOptions(nextScreen)[0]?.id ?? "" : updates.targetId ?? connection.targetId;

                return { ...connection, ...updates, screen: nextScreen, targetId: nextTarget };
              })
            }
          : column
      )
    );
  }

  function removeConnection(columnIndex: number, connectionId: string) {
    onColumnsChange(
      columns.map((column, currentColumnIndex) =>
        currentColumnIndex === columnIndex
          ? { ...column, connections: (column.connections ?? []).filter((connection) => connection.id !== connectionId) }
          : column
      )
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel board-settings-panel" role="dialog" aria-modal="true" aria-labelledby="backlog-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="backlog-settings-title">Configurar backlog</h2>
            <p>Defina abas, campos e visualizacao inicial do backlog.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <form>
          <section className="board-settings-section">
            <h3>Rolagem inicial</h3>
            <label>
              <span>Abas visiveis antes da rolagem</span>
              <input
                max={Math.max(columns.length, 1)}
                min={1}
                type="number"
                value={initialVisibleTabs}
                onChange={(event) => updateInitialVisibleTabs(Number(event.target.value))}
              />
            </label>
          </section>

          <section className="board-settings-section">
            <div className="settings-section-head">
              <h3>Categorias</h3>
              <button className="secondary-button" type="button" onClick={addCategory}>
                <Plus size={16} />
                Adicionar categoria
              </button>
            </div>
            <div className="category-settings-list">
              {categories.map((category) => (
                <div className="category-settings-row" key={category.id}>
                  <input value={category.name} onChange={(event) => updateCategory(category.id, { name: event.target.value })} aria-label={`Nome da categoria ${category.name}`} />
                  <div className="color-picker compact-color-picker" aria-label={`Cor da categoria ${category.name}`}>
                    {boardColorOptions.map((option) => (
                      <button
                        className={`color-swatch ${option.value} ${category.color === option.value ? "active" : ""}`}
                        key={option.value}
                        type="button"
                        onClick={() => updateCategory(category.id, { color: option.value })}
                        title={option.label}
                        aria-label={option.label}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => removeCategory(category.id)} disabled={categories.length <= 1} aria-label={`Remover categoria ${category.name}`}>
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="board-settings-section">
            <div className="settings-section-head">
              <h3>Abas existentes</h3>
              <button className="secondary-button" type="button" onClick={addColumn}>
                <Plus size={16} />
                Adicionar aba
              </button>
            </div>
            <div className="configured-tabs-list">
              {columns.map((column, columnIndex) => (
                <button
                  className={`configured-tab ${column.color} ${selectedColumnIndex === columnIndex ? "active" : ""} ${draggedColumn?.columnIndex === columnIndex ? "dragging" : ""}`}
                  draggable
                  key={`${column.title}-${columnIndex}`}
                  type="button"
                  onClick={() => {
                    setSelectedColumnIndex(columnIndex);
                    setIsDeleteConfirming(false);
                  }}
                  onDragEnd={() => setDraggedColumn(null)}
                  onDragOver={handleColumnDragOver}
                  onDragStart={(event) => handleColumnDragStart(event, columnIndex)}
                  onDrop={(event) => handleColumnDrop(event, columnIndex)}
                  title="Arraste para ordenar"
                >
                  <Hand className="drag-hand-icon" size={14} />
                  {renderBoardIcon(column.icon, 14)}
                  {column.title}
                </button>
              ))}
            </div>

            {selectedColumn && (
              <div className="board-tab-editor">
                <div className="tab-builder-grid">
                  <label>
                    <span>Nome da aba</span>
                    <input value={selectedColumn.title} onChange={(event) => updateColumn(selectedColumnIndex, { title: event.target.value })} />
                  </label>
                  <label className="tab-description-field">
                    <span>Descricao da aba</span>
                    <textarea value={selectedColumn.description ?? ""} onChange={(event) => updateColumn(selectedColumnIndex, { description: event.target.value })} />
                  </label>
                  <div className="visual-option-field">
                    <span>Cor</span>
                    <div className="color-picker" aria-label="Cores da aba">
                      {getOrderedBoardColorOptions(selectedColumn.color).map((option) => (
                        <button
                          className={`color-swatch ${option.value} ${selectedColumn.color === option.value ? "active" : ""}`}
                          key={option.value}
                          type="button"
                          onClick={() => updateColumn(selectedColumnIndex, { color: option.value })}
                          title={option.label}
                          aria-label={option.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="visual-option-field">
                    <span>Icone</span>
                    <div className="icon-picker" aria-label="Icones da aba do backlog">
                      {boardIconOptions.map((option) => (
                        <button
                          className={selectedColumn.icon === option.value ? "active" : ""}
                          key={option.value}
                          type="button"
                          onClick={() => updateColumn(selectedColumnIndex, { icon: option.value })}
                          title={option.label}
                          aria-label={option.label}
                        >
                          <option.icon size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <section className="ai-settings-builder">
                  <h3>Geracao por IA</h3>
                  <label className="inline-check">
                    <input
                      checked={!!selectedColumn.aiStoryEnabled}
                      type="checkbox"
                      onChange={(event) => toggleAiColumnSetting(selectedColumnIndex, "aiStoryEnabled", event.target.checked)}
                    />
                    <span>Historias por IA</span>
                  </label>
                  <label className="inline-check">
                    <input
                      checked={!!selectedColumn.aiCriteriaEnabled}
                      type="checkbox"
                      onChange={(event) => toggleAiColumnSetting(selectedColumnIndex, "aiCriteriaEnabled", event.target.checked)}
                    />
                    <span>Criterios por IA</span>
                  </label>
                  <label className="inline-check">
                    <input
                      checked={!!selectedColumn.aiStoryPointsEnabled}
                      type="checkbox"
                      onChange={(event) => toggleAiColumnSetting(selectedColumnIndex, "aiStoryPointsEnabled", event.target.checked)}
                    />
                    <span>Story Points por IA</span>
                  </label>
                </section>

                <section className="connections-builder">
                  <div className="settings-section-head">
                    <h3>Conexoes</h3>
                    <button className="square-action compact-square-action" type="button" onClick={() => addConnection(selectedColumnIndex)} aria-label="Adicionar conexao" title="Adicionar conexao">
                      <Plus size={18} />
                    </button>
                  </div>

                  {(selectedColumn.connections ?? []).length === 0 ? (
                    <p>Nenhuma conexao configurada.</p>
                  ) : (
                    <div className="connection-list">
                      {(selectedColumn.connections ?? []).map((connection) => (
                        <div className={`connection-row ${connection.screen === "Sprint" ? "without-target" : ""}`} key={connection.id}>
                          <select
                            value={connection.direction ?? "Receber de"}
                            onChange={(event) => updateConnection(selectedColumnIndex, connection.id, { direction: event.target.value as ConnectionDirection })}
                            aria-label="Direcao da conexao"
                          >
                            <option>Receber de</option>
                            <option>Mover para</option>
                          </select>
                          <select
                            value={connection.screen}
                            onChange={(event) => updateConnection(selectedColumnIndex, connection.id, { screen: event.target.value as BacklogConnectionScreen })}
                            aria-label="Tela da conexao"
                          >
                            <option>Board</option>
                            <option>Sprint</option>
                          </select>
                          {connection.screen !== "Sprint" && (
                            <select
                              value={connection.targetId}
                              onChange={(event) => updateConnection(selectedColumnIndex, connection.id, { targetId: event.target.value })}
                              aria-label="Aba conectada"
                            >
                              {getConnectionTargetOptions(connection.screen).map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          )}
                          <button type="button" onClick={() => removeConnection(selectedColumnIndex, connection.id)} aria-label="Remover conexao">
                            <X size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <BoardFieldsBuilder
                  fields={selectedColumn.fields}
                  onAddField={() => addField(selectedColumnIndex)}
                  onRemoveField={(fieldIndex) => removeField(selectedColumnIndex, fieldIndex)}
                  onUpdateField={(fieldIndex, field, value) => updateField(selectedColumnIndex, fieldIndex, field, value)}
                />
                <div className="delete-tab-actions">
                  {!isDeleteConfirming ? (
                    <button className="danger-button delete-tab-button" type="button" onClick={() => setIsDeleteConfirming(true)} disabled={columns.length <= 1}>
                      Excluir esta aba
                    </button>
                  ) : (
                    <>
                      <span>Confirmar exclusao?</span>
                      <button className="danger-button" type="button" onClick={deleteSelectedColumn}>Confirmar</button>
                      <button className="secondary-button" type="button" onClick={() => setIsDeleteConfirming(false)}>Cancelar</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </form>

        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
          <button className="primary-button" type="button" onClick={onClose}>Salvar</button>
        </footer>
      </section>
    </div>
  );
}

function normalizeDeliveryIndexes(columns: BoardColumn[]): BoardColumn[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) => ({
      ...card,
      deliveryHistory: (card.deliveryHistory ?? [])
        .map((entry) => ({
          ...entry,
          tabIndex: columns.findIndex((currentColumn) => currentColumn.title === entry.tabTitle)
        }))
        .filter((entry) => entry.tabIndex >= 0)
    }))
  }));
}

function BoardFieldsBuilder({
  fields,
  onAddField,
  onRemoveField,
  onUpdateField
}: {
  fields: BoardTabField[];
  onAddField: () => void;
  onRemoveField: (index: number) => void;
  onUpdateField: (index: number, field: keyof BoardTabField, value: string | boolean) => void;
}) {
  return (
    <>
      <div className="field-builder">
        <div className="field-builder-head">
          <span>Campo</span>
          <span>Tipo de resposta</span>
          <span>Obrigatorio</span>
          <span />
        </div>
        {fields.map((field, index) => (
          <div className="field-builder-row" key={field.id}>
            <input value={field.name} onChange={(event) => onUpdateField(index, "name", event.target.value)} aria-label={`Nome do campo ${index + 1}`} />
            <select value={field.type} onChange={(event) => onUpdateField(index, "type", event.target.value as BoardFieldType)} aria-label={`Tipo do campo ${index + 1}`}>
              {boardFieldTypes.map((fieldType) => <option key={fieldType}>{fieldType}</option>)}
            </select>
            <label className="inline-check">
              <input checked={field.required} type="checkbox" onChange={(event) => onUpdateField(index, "required", event.target.checked)} />
              <span>Sim</span>
            </label>
            <button type="button" aria-label={`Remover campo ${index + 1}`} onClick={() => onRemoveField(index)}>
              <X size={17} />
            </button>
          </div>
        ))}
      </div>

      <button className="secondary-button add-epic-item-button" type="button" onClick={onAddField}>
        <Plus size={16} />
        Adicionar campo
      </button>
    </>
  );
}

function ColumnDescriptionButton({ description, title }: { description?: string; title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipText = description?.trim() || "Sem descricao cadastrada.";

  return (
    <span className="column-description-wrap">
      <button
        className="column-description-button"
        type="button"
        aria-label={`Descricao da aba ${title}`}
        aria-expanded={isOpen}
        onBlur={() => setIsOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
      >
        <CircleAlert size={15} />
      </button>
      {isOpen && (
        <span className="column-description-tooltip" role="tooltip">
          {tooltipText}
        </span>
      )}
    </span>
  );
}

function renderBoardIcon(icon: BoardTabIcon, size = 16) {
  const option = boardIconOptions.find((currentOption) => currentOption.value === icon) ?? boardIconOptions[0];
  const Icon = option.icon;

  return <Icon size={size} />;
}

function renderFieldTypeIcon(type?: BoardFieldType, size = 14) {
  if (type === "Texto longo") {
    return <ListTodo size={size} />;
  }

  if (type === "Numero") {
    return <CircleDot size={size} />;
  }

  if (type === "Data") {
    return <CalendarDays size={size} />;
  }

  if (type === "Lista") {
    return <ChevronRight size={size} />;
  }

  if (type === "Sim/Nao") {
    return <CheckCircle2 size={size} />;
  }

  if (type === "Pessoa") {
    return <UserRound size={size} />;
  }

  return <Code2 size={size} />;
}

function CardMetaEditor({
  description,
  estimate,
  linearUrl,
  members,
  owner,
  points,
  priority,
  onChange,
  onSaveLinearLink
}: {
  description?: string;
  estimate?: string;
  linearUrl?: string;
  members: ProductMember[];
  owner?: string;
  points?: number;
  priority?: Priority;
  onChange: (owner: string, points: number, estimate: string, priority: Priority, description: string) => void;
  onSaveLinearLink?: (linearUrl: string) => void;
}) {
  const [draftLinearUrl, setDraftLinearUrl] = useState(linearUrl ?? "");

  useEffect(() => {
    setDraftLinearUrl(linearUrl ?? "");
  }, [linearUrl]);

  function stopCardInteraction(event: SyntheticEvent) {
    event.stopPropagation();
  }

  return (
    <div className="card-meta-editor" onClick={stopCardInteraction} onMouseDown={stopCardInteraction}>
      <label>
        <span>Responsavel</span>
        <select value={owner ?? ""} onChange={(event) => onChange(event.target.value, points ?? 0, estimate ?? "", priority ?? "Media", description ?? "")} aria-label="Responsavel do card">
          <option value="">Sem responsavel</option>
          {members.map((member) => <option value={member.name} key={member.id}>{member.name}</option>)}
        </select>
      </label>
      <label>
        <span>Prioridade</span>
        <select value={priority ?? "Media"} onChange={(event) => onChange(owner ?? "", points ?? 0, estimate ?? "", event.target.value as Priority, description ?? "")} aria-label="Prioridade do card">
          {priorityOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>Story Point</span>
        <select value={points ? String(points) : ""} onChange={(event) => onChange(owner ?? "", event.target.value ? Number(event.target.value) : 0, estimate ?? "", priority ?? "Media", description ?? "")} aria-label="Story point do card">
          <option value="">Sem estimativa</option>
          {linearEstimateOptions.map((option) => <option key={option} value={option}>{option} {option === 1 ? "ponto" : "pontos"}</option>)}
        </select>
      </label>
      {estimate !== undefined && (
        <label className="estimate-meta-field">
          <span>Estimativa</span>
          <input
            value={estimate}
            onChange={(event) => onChange(owner ?? "", points ?? 0, event.target.value, priority ?? "Media", description ?? "")}
            placeholder="Sem estimativa"
            aria-label="Estimativa do card"
          />
        </label>
      )}
      <label className="estimate-meta-field">
        <span>Descricao</span>
        <input
          value={description ?? ""}
          onChange={(event) => onChange(owner ?? "", points ?? 0, estimate ?? "", priority ?? "Media", event.target.value)}
          placeholder="Sem descricao"
          aria-label="Descricao do card"
        />
      </label>
      {onSaveLinearLink && (
        <label className="estimate-meta-field linear-link-meta-field">
          <span>Link Linear</span>
          <span className="linear-link-editor">
            <input
              value={draftLinearUrl}
              onChange={(event) => setDraftLinearUrl(event.target.value)}
              placeholder="Cole o link ou deixe vazio"
              aria-label="Link Linear do card"
            />
            <button type="button" onClick={() => onSaveLinearLink(draftLinearUrl)} aria-label="Salvar vinculo Linear" title="Salvar vinculo Linear">
              <Save size={15} />
            </button>
          </span>
        </label>
      )}
    </div>
  );
}

function BoardCardItem({
  card,
  isDragging,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onOpenDetails,
  onRequestDelete
}: {
  card: BoardCard;
  isDragging: boolean;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onOpenDetails: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <article
      className={`kanban-card ${isDragging ? "dragging" : ""}`}
      draggable
      role="button"
      tabIndex={0}
      onClick={onOpenDetails}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetails();
        }
      }}
    >
      <header>
        <span className="owner-pill card-owner-avatar" title={card.owner || "Sem responsavel"}>{getMemberInitials(card.owner)}</span>
        <span className={`board-card-pill priority-pill ${getPriorityTone(card.priority)}`}>
          {card.priority === "Alta" || card.priority === "Urgente" ? <ArrowUp size={13} /> : card.priority === "Baixa" ? <ArrowDown size={13} /> : <span className="priority-dash" />}
          {card.priority}
        </span>
        <button
          className="card-delete-button"
          type="button"
          aria-label={`Excluir ${card.title}`}
          title="Excluir card"
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete();
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Trash2 size={14} />
        </button>
      </header>
      <h3>{card.title}</h3>
      <footer>
        <span className="board-card-pill">
          <ListTodo size={14} />
          {card.points || "SP"}
        </span>
        <span className="board-card-pill">
          <CalendarDays size={14} />
          {card.estimate || "Sem estimativa"}
        </span>
      </footer>
    </article>
  );
}

function DeleteCardConfirmModal({
  itemName,
  onCancel,
  onConfirm
}: {
  itemName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="modal-panel delete-card-modal" role="dialog" aria-modal="true" aria-labelledby="delete-card-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="delete-card-title">Excluir card</h2>
            <p>Esta acao remove o card da aba atual.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onCancel}>
            <X size={22} />
          </button>
        </header>
        <p>
          Deseja excluir <strong>{itemName}</strong>?
        </p>
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            <Trash2 size={16} />
            Excluir
          </button>
        </footer>
      </section>
    </div>
  );
}

function TaskDetailsModal({
  aiConfig,
  aiItem,
  categories = [],
  clients = [],
  editable = false,
  members = [],
  onAiChange,
  onSave,
  sprints = [],
  task,
  onClose
}: {
  aiConfig?: { story: boolean; criteria: boolean; sp: boolean };
  aiItem?: BacklogItem;
  categories?: CategoryConfig[];
  clients?: ClientAccount[];
  editable?: boolean;
  members?: ProductMember[];
  onAiChange?: (updates: Partial<Pick<BacklogItem, "aiStory" | "aiCriteria" | "aiStoryPoints">>) => void;
  onSave?: (updates: Partial<Pick<BoardCard, "assistants" | "category" | "client" | "description" | "estimate" | "owner" | "points" | "priority" | "sprint" | "title">>) => void;
  sprints?: SprintPlan[];
  task: TaskDetail;
  onClose: () => void;
}) {
  const deliveryHistory = task.deliveryHistory ?? [];
  const [openDeliveryTab, setOpenDeliveryTab] = useState(deliveryHistory[0]?.tabTitle ?? "");
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftOwner, setDraftOwner] = useState(task.owner ?? "");
  const [draftAssistants, setDraftAssistants] = useState<string[]>(task.assistants ?? []);
  const [draftPoints, setDraftPoints] = useState(task.points ? String(task.points) : "");
  const [draftEstimate, setDraftEstimate] = useState(task.estimate ?? "");
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority);
  const [draftDescription, setDraftDescription] = useState(task.description ?? "");
  const [draftSprint, setDraftSprint] = useState(task.sprint ?? "");
  const [draftCategory, setDraftCategory] = useState(task.category ?? "");
  const [draftClient, setDraftClient] = useState(task.client ?? "");
  const initialFields: TaskFieldValue[] = [
    { id: "initial-title", label: "Titulo", value: draftTitle, type: "Texto curto" },
    { id: "initial-origin", label: "Origem", value: task.source, type: "Lista" },
    ...(task.status ? [{ id: "initial-status", label: "Status", value: task.status, type: "Lista" as BoardFieldType }] : []),
    ...(draftOwner ? [{ id: "initial-owner", label: "Responsavel", value: draftOwner, type: "Pessoa" as BoardFieldType }] : []),
    ...(draftAssistants.length > 0 ? [{ id: "initial-assistants", label: "Assistentes", value: draftAssistants.join(", "), type: "Pessoa" as BoardFieldType }] : []),
    ...(draftPoints ? [{ id: "initial-points", label: "Story points", value: draftPoints, type: "Numero" as BoardFieldType }] : []),
    ...(draftSprint ? [{ id: "initial-sprint", label: "Sprint", value: draftSprint, type: "Lista" as BoardFieldType }] : []),
    ...(draftCategory ? [{ id: "initial-category", label: "Categoria", value: draftCategory, type: "Lista" as BoardFieldType }] : []),
    ...(draftClient ? [{ id: "initial-client", label: "Empresa", value: draftClient, type: "Lista" as BoardFieldType }] : []),
    ...(task.generalFields ?? [])
  ];

  function saveDetails() {
    if (!editable || !onSave) {
      onClose();
      return;
    }

    onSave({
      assistants: draftAssistants.length > 0 ? draftAssistants : undefined,
      category: draftCategory || undefined,
      client: draftClient || undefined,
      description: draftDescription.trim() || undefined,
      estimate: draftEstimate.trim() || undefined,
      owner: draftOwner,
      points: draftPoints ? Number(draftPoints) : 0,
      priority: draftPriority,
      sprint: draftSprint || undefined,
      title: draftTitle.trim() || task.title
    });
  }

  function toggleDraftAssistant(memberName: string) {
    setDraftAssistants((currentAssistants) =>
      currentAssistants.includes(memberName)
        ? currentAssistants.filter((assistant) => assistant !== memberName)
        : [...currentAssistants, memberName]
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="create-item-panel modal-panel task-detail-panel" role="dialog" aria-modal="true" aria-labelledby="task-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2 id="task-detail-title">{editable ? draftTitle || task.title : task.title}</h2>
            <p>{task.id}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <div className="task-detail-body">
          <section className="task-detail-section">
            <div className="task-section-head">
              <div>
                <h3>Formulario Inicial</h3>
                <p>Criado por {task.createdBy ?? "Pipelbot"}{task.createdAt ? ` em ${task.createdAt}` : ""}</p>
              </div>
              <Badge tone={getPriorityTone(draftPriority)}>{draftPriority}</Badge>
            </div>

            {editable ? (
              <div className="task-edit-grid">
                <label className="task-edit-field full">
                  <span>Titulo</span>
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                </label>
                <label className="task-edit-field">
                  <span>Responsavel</span>
                  <select value={draftOwner} onChange={(event) => setDraftOwner(event.target.value)}>
                    <option value="">Sem responsavel</option>
                    {members.map((member) => <option value={member.name} key={member.id}>{member.name}</option>)}
                  </select>
                </label>
                <label className="task-edit-field">
                  <span>Prioridade</span>
                  <select value={draftPriority} onChange={(event) => setDraftPriority(event.target.value as Priority)}>
                    {priorityOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label className="task-edit-field">
                  <span>Story point</span>
                  <select value={draftPoints} onChange={(event) => setDraftPoints(event.target.value)}>
                    <option value="">Sem estimativa</option>
                    {linearEstimateOptions.map((option) => <option key={option} value={option}>{option} {option === 1 ? "ponto" : "pontos"}</option>)}
                  </select>
                </label>
                <label className="task-edit-field">
                  <span>Estimativa</span>
                  <input value={draftEstimate} onChange={(event) => setDraftEstimate(event.target.value)} placeholder="Sem estimativa" />
                </label>
                <label className="task-edit-field">
                  <span>Sprint</span>
                  <select value={draftSprint} onChange={(event) => setDraftSprint(event.target.value)}>
                    <option value="">Sem sprint</option>
                    {sprints.map((sprint) => <option value={sprint.name} key={sprint.id}>{sprint.name}</option>)}
                  </select>
                </label>
                <label className="task-edit-field">
                  <span>Categoria</span>
                  <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>
                    <option value="">Sem categoria</option>
                    {categories.map((category) => <option value={category.name} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="task-edit-field full">
                  <span>Empresa</span>
                  <select value={draftClient} onChange={(event) => setDraftClient(event.target.value)}>
                    <option value="">Sem empresa</option>
                    {clients.map((client) => <option value={client.name} key={client.id}>{client.name}</option>)}
                  </select>
                </label>
                <div className="task-edit-field full assistant-picker">
                  <span>Assistentes</span>
                  <details>
                    <summary>{draftAssistants.length > 0 ? `${draftAssistants.length} selecionado${draftAssistants.length > 1 ? "s" : ""}` : "Selecionar assistentes"}</summary>
                    <div>
                      {members.map((member) => (
                        <label key={member.id}>
                          <input
                            checked={draftAssistants.includes(member.name)}
                            type="checkbox"
                            onChange={() => toggleDraftAssistant(member.name)}
                          />
                          {member.name}
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ) : (
              <div className="initial-form-list">
                {initialFields.map((field) => (
                  <div className="initial-form-row" key={field.id}>
                    <span className="field-type-icon">{renderFieldTypeIcon(field.type)}</span>
                    <div>
                      <span>* {field.label}</span>
                      <p>{field.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="task-detail-description">
              <span>Descricao</span>
              <textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder={`Detalhes da demanda: ${task.title}`} readOnly={!editable} />
            </label>
          </section>

          <section className="task-detail-section delivery-section">
            {aiConfig && aiItem && onAiChange && (aiConfig.story || aiConfig.criteria || aiConfig.sp) && (
              <div className="task-ai-side-panel">
                <div className="task-section-head">
                  <h3>Geracao por IA</h3>
                  <span>Mock</span>
                </div>
                <AiGenerationPanel
                  config={aiConfig}
                  item={aiItem}
                  onChange={onAiChange}
                />
              </div>
            )}

            <div className="task-section-head">
              <h3>Delivery</h3>
              <span>{deliveryHistory.length} etapas</span>
            </div>

            {deliveryHistory.length === 0 ? (
              <div className="empty-delivery">A tarefa ainda nao passou por abas do board.</div>
            ) : (
              <div className="delivery-collapse-list">
                {deliveryHistory.map((entry) => {
                  const isOpen = openDeliveryTab === entry.tabTitle;

                  return (
                    <article className="delivery-collapse" key={`${entry.tabTitle}-${entry.tabIndex}`}>
                      <button className="delivery-collapse-trigger" type="button" onClick={() => setOpenDeliveryTab(isOpen ? "" : entry.tabTitle)} aria-expanded={isOpen}>
                        <span>
                          <strong>{entry.tabTitle}</strong>
                          <small>{entry.movedBy} em {entry.movedAt}</small>
                        </span>
                        <ChevronDown className={isOpen ? "expanded" : ""} size={18} />
                      </button>

                      {isOpen && (
                        <div className="delivery-collapse-body">
                          {entry.fields.map((field) => (
                            <div className="readonly-field" key={`${entry.tabTitle}-${field.id}`}>
                              <span>{field.label}</span>
                              <strong>{field.value}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <footer>
          <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
          <button className="primary-button" type="button" onClick={saveDetails}>Salvar</button>
        </footer>
      </section>
    </div>
  );
}

function Topbar({
  title,
  subtitle,
  period,
  theme,
  onToggleTheme
}: {
  title: string;
  subtitle: string;
  period?: string;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { activeProductId, currentMember, currentPermission, isAdmin, onLogout, onNavigate, onProductChange, products } = useSession();
  const profileInitials = getInitials(currentMember?.name);

  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="top-actions">
        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Alternar para tema ${theme === "dark" ? "claro" : "escuro"}`}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === "dark" ? "Claro" : "Escuro"}</span>
        </button>
        <button className="icon-button" type="button" aria-label="Notificacoes">
          <Bell size={22} />
        </button>
        <button className="profile-button" type="button" aria-label="Perfil" onClick={() => setIsProfileOpen((current) => !current)}>
          <span className="avatar">{profileInitials}</span>
          <ChevronDown size={18} />
        </button>
        {isProfileOpen && (
          <div className="profile-menu">
            <label>
              <span>Products</span>
              <select value={activeProductId} onChange={(event) => onProductChange(event.target.value)}>
                {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
              </select>
            </label>
            <div className="profile-permission">
              <small>Permissao</small>
              <strong>{currentPermission}</strong>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => { onNavigate("permissions"); setIsProfileOpen(false); }}>
                Permissoes
              </button>
            )}
            <button className="profile-logout" type="button" onClick={onLogout}>Logout</button>
          </div>
        )}
        {period && (
          <button className="period-button" type="button">
            <CalendarDays size={19} />
            <span>{period}</span>
            <ChevronDown size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div className="view-mode-toggle" aria-label="Modo de visualizacao">
      <button className={value === "card" ? "active" : ""} type="button" onClick={() => onChange("card")}>
        <LayoutGrid size={16} />
        Card
      </button>
      <button className={value === "list" ? "active" : ""} type="button" onClick={() => onChange("list")}>
        <Table2 size={16} />
        Lista
      </button>
    </div>
  );
}

function IntegrationCard({ active = false, logo, title, items, action, onClick }: { active?: boolean; logo: "linear" | "sheets" | "discord"; title?: string; items: string[]; action: string; onClick?: () => void }) {
  const label = logo === "linear" ? "Linear" : title ?? "";
  const tooltip = `${label} conectado - ${items.join(" | ")}`;

  return (
    <article className={`integration-card ${active ? "active" : ""}`} title={tooltip}>
      <div className="integration-title">
        {logo === "linear" && <span className="linear-logo"><GitBranch size={22} /></span>}
        {logo === "sheets" && <span className="sheets-logo"><FileSpreadsheet size={20} /></span>}
        {logo === "discord" && <span className="discord-logo"><MessageCircle size={20} /></span>}
        <div>
          <h2>{label}</h2>
          <span>Conectado</span>
        </div>
      </div>
      <button type="button" aria-label={action} title={action} onClick={onClick}>
        <ExternalLink size={16} />
      </button>
    </article>
  );
}

function Badge({ tone, children }: { tone: "blue" | "red" | "yellow" | "green" | "pink"; children: ReactNode }) {
  return <span className={`data-badge ${tone}`}>{children}</span>;
}

function MetricCard({ metric }: { metric: Metric }) {
  const config = statusConfig[metric.id];

  return (
    <article className={`metric-card ${config.className}`}>
      <div className="metric-icon">
        <config.icon size={42} strokeWidth={2.2} />
      </div>
      <div>
        <strong>{metric.value}</strong>
        <span>{metric.label}</span>
      </div>
    </article>
  );
}

function PanelHeader({ tone, title, subtitle }: { tone: "danger" | "team"; title: string; subtitle: string }) {
  return (
    <header className="panel-header">
      <span className={`panel-icon ${tone}`}>{tone === "danger" ? <ListTodo size={30} /> : <UsersRound size={28} />}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];

  return (
    <span className={`status-badge ${config.className}`}>
      <config.icon size={15} />
      {config.label}
    </span>
  );
}

function PanelFooter({ label }: { label: string }) {
  return (
    <footer className="panel-footer">
      <a href="/">
        {label}
        <ChevronRight size={19} />
      </a>
    </footer>
  );
}
