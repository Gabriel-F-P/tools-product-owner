export type BacklogPriority = "Sem prioridade" | "Urgente" | "Alta" | "Media" | "Baixa";

export interface BacklogItem {
  order: number;
  name: string;
  sprint: string;
  category: string;
  priority: BacklogPriority;
  createdAt: string;
  description?: string;
  owner?: string;
  assistants?: string[];
  storyPoints?: number;
  estimate?: string;
  client?: string;
  linearIdentifier?: string;
  linearIssueId?: string;
  linearUrl?: string;
  aiStory?: string;
  aiCriteria?: string;
  aiStoryPoints?: string;
  /** Projeto (produto) ao qual o item pertence no backlog em matriz. */
  productId?: string;
}

export interface BacklogEpic {
  id: string;
  order: number;
  name: string;
  objective: string;
  createdAt: string;
  items: BacklogItem[];
  productId?: string;
}

export type BacklogEntry = BacklogItem | BacklogEpic;
