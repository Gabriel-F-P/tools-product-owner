import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileDown, Maximize2, Minimize2, UsersRound } from "lucide-react";
import "./review.css";

/* ------------------------------------------------------------------ */
/* Tipos                                                              */
/* ------------------------------------------------------------------ */

export type ReviewMethod = "sprint" | "kanban";

/** Projeto disponível para o usuário logado. */
export interface ReviewProject {
  id: string;
  name: string;
  method: ReviewMethod;
}

/** Sprint disponível para escolha (datas no formato dd/mm/aaaa, como no restante do sistema). */
export interface ReviewSprint {
  id: string;
  name: string;
  start: string;
  end: string;
  objective?: string;
}

/** Card congelado no momento em que a review foi gerada. */
export interface ReviewCard {
  id: string;
  title: string;
  owner?: string;
  assistants?: string[];
  priority?: string;
  points: number;
  category?: string;
  client?: string;
  description?: string;
  /** Aba do board em que o card estava. */
  status: string;
  /** AAAA-MM-DD em que o card foi concluído (quando conhecido). */
  doneAt?: string;
}

/** Review (entrega) gerada: fica no histórico das Cerimônias e, se veio de uma reunião, no histórico dela. */
export interface ReviewRecord {
  id: string;
  projectId: string;
  projectName: string;
  method: ReviewMethod;
  sprintId?: string;
  sprintName?: string;
  objective?: string;
  /** Período coberto (AAAA-MM-DD). */
  from: string;
  to: string;
  createdAt: string;
  createdBy?: string;
  meetingId?: string;
  meetingTitle?: string;
  delivered: ReviewCard[];
  pending: ReviewCard[];
}

export interface ReviewConfig {
  projectId: string;
  sprintId?: string;
  from?: string;
  to?: string;
}

/* ------------------------------------------------------------------ */
/* Datas                                                              */
/* ------------------------------------------------------------------ */

export function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "dd/mm/aaaa" (ou "dd/mm/aaaa, hh:mm") -> "aaaa-mm-dd". */
export function brDateToIso(value?: string) {
  const match = value?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

export function formatIso(iso?: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Texto curto que identifica a entrega: usado no histórico das reuniões e das cerimônias. */
export function reviewLabel(record: Pick<ReviewRecord, "method" | "sprintName" | "projectName" | "from" | "to">) {
  return record.method === "sprint"
    ? `${record.sprintName ?? "Sprint"} do projeto ${record.projectName}`
    : `Entrega do projeto ${record.projectName} de ${formatIso(record.from)} a ${formatIso(record.to)}`;
}

/* ------------------------------------------------------------------ */
/* Formulário (projeto + sprint ou período)                           */
/* ------------------------------------------------------------------ */

export function defaultReviewConfig(projects: ReviewProject[], sprints: ReviewSprint[], projectId?: string, activeSprintId?: string): ReviewConfig {
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  return {
    projectId: project?.id ?? "",
    sprintId: activeSprintId ?? sprints[0]?.id,
    from: addDaysIso(todayIso(), -6),
    to: todayIso()
  };
}

export function validateReviewConfig(config: ReviewConfig, projects: ReviewProject[]) {
  const project = projects.find((item) => item.id === config.projectId);
  if (!project) return "Selecione o projeto.";
  if (project.method === "sprint" && !config.sprintId) return "Selecione a sprint.";
  if (project.method === "kanban") {
    if (!config.from || !config.to) return "Informe o período (de e até).";
    if (config.from > config.to) return "A data inicial não pode ser depois da data final.";
  }
  return "";
}

/**
 * Campos de configuração da review. Projetos Sprint pedem a sprint; projetos Kanban pedem o período.
 * `hideProject` é usado nas Cerimônias, onde o projeto já foi escolhido no topo da página.
 */
export function ReviewConfigFields({
  projects,
  sprints,
  value,
  onChange,
  hideProject = false,
  className = "rv-fields"
}: {
  projects: ReviewProject[];
  sprints: ReviewSprint[];
  value: ReviewConfig;
  onChange: (value: ReviewConfig) => void;
  hideProject?: boolean;
  className?: string;
}) {
  const project = projects.find((item) => item.id === value.projectId);

  return (
    <div className={className}>
      {!hideProject && (
        <label>
          <span>Projeto</span>
          <select value={value.projectId} onChange={(event) => onChange({ ...value, projectId: event.target.value })}>
            {projects.length === 0 && <option value="">Nenhum projeto disponível</option>}
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.method === "sprint" ? "Sprint" : "Kanban"})
              </option>
            ))}
          </select>
        </label>
      )}
      {project?.method === "sprint" && (
        <label>
          <span>Sprint</span>
          <select value={value.sprintId ?? ""} onChange={(event) => onChange({ ...value, sprintId: event.target.value })}>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.start} a {sprint.end})
              </option>
            ))}
          </select>
        </label>
      )}
      {project?.method === "kanban" && (
        <div className="rv-range">
          <label>
            <span>De</span>
            <input max={value.to || undefined} type="date" value={value.from ?? ""} onChange={(event) => onChange({ ...value, from: event.target.value })} />
          </label>
          <label>
            <span>Até</span>
            <input min={value.from || undefined} type="date" value={value.to ?? ""} onChange={(event) => onChange({ ...value, to: event.target.value })} />
          </label>
        </div>
      )}
      {project?.method === "kanban" && (
        <div className="rv-quick">
          {[
            { label: "Última semana", days: 6 },
            { label: "Últimos 15 dias", days: 14 },
            { label: "Últimos 30 dias", days: 29 }
          ].map((option) => (
            <button key={option.label} type="button" onClick={() => onChange({ ...value, from: addDaysIso(todayIso(), -option.days), to: todayIso() })}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Apresentação                                                       */
/* ------------------------------------------------------------------ */

function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function groupBy(cards: ReviewCard[], key: (card: ReviewCard) => string[]) {
  const map = new Map<string, { count: number; points: number }>();
  cards.forEach((card) => {
    key(card).forEach((name) => {
      const current = map.get(name) ?? { count: 0, points: 0 };
      current.count += 1;
      current.points += card.points || 0;
      map.set(name, current);
    });
  });
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
}

/**
 * Apresentação da review em slides: capa, resumo, um slide por entrega e pendências.
 * Usada nas Cerimônias e dentro das Reuniões.
 */
export function ReviewPresentation({ record, compact = false }: { record: ReviewRecord; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const delivered = record.delivered;
  const pendingLabel = record.method === "sprint" ? "Não concluídos na sprint" : "Ainda em andamento";
  const totalSlides = 2 + delivered.length + (record.pending.length > 0 ? 1 : 0);
  const deliveredPoints = delivered.reduce((total, card) => total + (card.points || 0), 0);
  const plannedPoints = deliveredPoints + record.pending.reduce((total, card) => total + (card.points || 0), 0);
  const people = groupBy(delivered, (card) => [card.owner?.trim() || "Sem responsável"]);
  const categories = groupBy(delivered, (card) => [card.category?.trim() || card.client?.trim() || "Sem categoria"]);
  const progress = record.method === "sprint" && delivered.length + record.pending.length > 0
    ? Math.round((delivered.length / (delivered.length + record.pending.length)) * 100)
    : null;

  useEffect(() => setIndex(0), [record.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.closest(".ProseMirror")) return;
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, totalSlides - 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [totalSlides]);

  const periodText = `${formatIso(record.from)} a ${formatIso(record.to)}`;
  const card = index >= 2 && index < 2 + delivered.length ? delivered[index - 2] : undefined;
  const isPendingSlide = record.pending.length > 0 && index === totalSlides - 1;

  return (
    <section className={`rv ${expanded ? "rv-expanded" : ""} ${compact ? "rv-compact" : ""}`}>
      <header className="rv-toolbar">
        <div className="rv-nav">
          <button aria-label="Slide anterior" disabled={index === 0} onClick={() => setIndex((current) => Math.max(current - 1, 0))} type="button">
            <ChevronLeft size={16} />
          </button>
          <span>{index + 1} / {totalSlides}</span>
          <button aria-label="Próximo slide" disabled={index === totalSlides - 1} onClick={() => setIndex((current) => Math.min(current + 1, totalSlides - 1))} type="button">
            <ChevronRight size={16} />
          </button>
        </div>
        <strong className="rv-toolbar-title">{reviewLabel(record)}</strong>
        <div className="rv-actions">
          <button onClick={() => setExpanded((current) => !current)} type="button">
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {expanded ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <button onClick={() => window.print()} type="button">
            <FileDown size={15} />
            PDF
          </button>
        </div>
      </header>

      <div className="rv-stage">
        {index === 0 && (
          <article className="rv-slide rv-cover">
            <div className="rv-cover-copy">
              <span className="rv-eyebrow">{record.projectName} · {record.method === "sprint" ? "Sprint" : "Kanban"}</span>
              <h2>Review{record.method === "sprint" ? ` · ${record.sprintName}` : ""}</h2>
              <p>{record.method === "sprint" ? `Período da sprint: ${periodText}` : `Entregas de ${periodText}`}</p>
              {record.objective && <p className="rv-objective"><b>Objetivo:</b> {record.objective}</p>}
            </div>
            <div className="rv-kpis">
              <div><small>Entregas</small><strong>{delivered.length}</strong><span>cards concluídos</span></div>
              <div><small>Story points</small><strong>{deliveredPoints}</strong><span>{record.method === "sprint" ? `de ${plannedPoints} planejados` : "entregues"}</span></div>
              <div><small>{record.method === "sprint" ? "Conclusão" : "Em andamento"}</small><strong>{progress !== null ? `${progress}%` : record.pending.length}</strong><span>{record.method === "sprint" ? `${record.pending.length} não concluídos` : "cards abertos"}</span></div>
              <div><small>Pessoas</small><strong>{people.filter(([name]) => name !== "Sem responsável").length}</strong><span>com entregas</span></div>
            </div>
          </article>
        )}

        {index === 1 && (
          <article className="rv-slide rv-summary">
            <h3>Resumo das entregas</h3>
            {delivered.length === 0 ? (
              <p className="rv-empty">Nenhum card foi concluído {record.method === "sprint" ? "nesta sprint" : "neste período"}.</p>
            ) : (
              <div className="rv-summary-grid">
                <div>
                  <h4><UsersRound size={16} /> Por responsável</h4>
                  <ul className="rv-bars">
                    {people.map(([name, data]) => (
                      <li key={name}>
                        <span className="rv-avatar">{initials(name)}</span>
                        <span className="rv-bar-label">{name}</span>
                        <span className="rv-bar"><i style={{ width: `${(data.count / people[0][1].count) * 100}%` }} /></span>
                        <b>{data.count}</b>
                        <small>{data.points} pts</small>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4><CheckCircle2 size={16} /> Por categoria / cliente</h4>
                  <ul className="rv-bars">
                    {categories.map(([name, data]) => (
                      <li key={name}>
                        <span className="rv-bar-label wide">{name}</span>
                        <span className="rv-bar"><i style={{ width: `${(data.count / categories[0][1].count) * 100}%` }} /></span>
                        <b>{data.count}</b>
                        <small>{data.points} pts</small>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <ol className="rv-index">
              {delivered.map((item, itemIndex) => (
                <li key={`${item.id}-${itemIndex}`}>
                  <button onClick={() => setIndex(itemIndex + 2)} type="button">
                    <span>{item.id}</span> {item.title}
                  </button>
                </li>
              ))}
            </ol>
          </article>
        )}

        {card && (
          <article className="rv-slide rv-card">
            <span className="rv-eyebrow">Entrega {index - 1} de {delivered.length}</span>
            <h3>{card.title}</h3>
            <div className="rv-tags">
              <span>{card.id}</span>
              {card.priority && <span>{card.priority}</span>}
              {card.category && <span>{card.category}</span>}
              {card.client && <span>{card.client}</span>}
            </div>
            {card.description ? <p className="rv-description">{card.description}</p> : <p className="rv-description muted">Sem descrição.</p>}
            <dl className="rv-card-grid">
              <div><dt>Responsável</dt><dd>{card.owner || "Sem responsável"}</dd></div>
              <div><dt>Apoio</dt><dd>{card.assistants?.length ? card.assistants.join(", ") : "—"}</dd></div>
              <div><dt>Story points</dt><dd>{card.points || 0} pts</dd></div>
              <div><dt>Concluído em</dt><dd>{card.doneAt ? formatIso(card.doneAt) : "—"}</dd></div>
              <div><dt>Situação</dt><dd>{card.status}</dd></div>
            </dl>
          </article>
        )}

        {isPendingSlide && (
          <article className="rv-slide rv-pending">
            <h3><Clock size={18} /> {pendingLabel}</h3>
            <ul>
              {record.pending.map((item, itemIndex) => (
                <li key={`${item.id}-${itemIndex}`}>
                  <span className="rv-pending-id">{item.id}</span>
                  <span className="rv-pending-title">{item.title}</span>
                  <span className="rv-pending-status">{item.status}</span>
                  <span className="rv-pending-owner">{item.owner || "Sem responsável"}</span>
                  <b>{item.points || 0} pts</b>
                </li>
              ))}
            </ul>
          </article>
        )}
      </div>

      <footer className="rv-dots">
        {Array.from({ length: totalSlides }).map((_, dotIndex) => (
          <button aria-label={`Ir para o slide ${dotIndex + 1}`} className={dotIndex === index ? "active" : ""} key={dotIndex} onClick={() => setIndex(dotIndex)} type="button" />
        ))}
      </footer>
      <p className="rv-footnote">
        <CalendarDays size={13} /> Gerada em {new Date(record.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        {record.meetingTitle ? ` · apresentada na reunião “${record.meetingTitle}”` : ""}
      </p>
    </section>
  );
}
