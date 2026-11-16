import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, CheckSquare, Clock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { MeetingRoom } from "./MeetingRoom";
import { RichEditor } from "./RichEditor";
import { ConfirmModal, Modal } from "./ui";
import {
  defaultMeetingTitle,
  formatDate,
  formatDateTime,
  htmlToText,
  newId,
  pendingTopicsForNextMeeting
} from "./types";
import type { MemberLite, Meeting, Topic, TopicPresent } from "./types";
import "./meetings.css";

type Tab = "history" | "topics";
type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "room"; id: string };

const todayIso = () => new Date().toISOString().slice(0, 10);
const presentLabel = (value: TopicPresent) => (value === "next" ? "Próxima reunião" : "Indefinido");

export function MeetingsPage({
  topbar,
  members,
  currentMember,
  meetings,
  topics,
  onMeetingsChange,
  onTopicsChange
}: {
  topbar: ReactNode;
  members: MemberLite[];
  currentMember?: MemberLite;
  meetings: Meeting[];
  topics: Topic[];
  onMeetingsChange: (meetings: Meeting[]) => void;
  onTopicsChange: (topics: Topic[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("history");
  const [view, setView] = useState<View>({ kind: "list" });
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);

  const nameOf = (email: string) => members.find((member) => member.email === email)?.name ?? email;

  function updateMeeting(next: Meeting) {
    onMeetingsChange(meetings.map((meeting) => (meeting.id === next.id ? next : meeting)));
  }

  function startMeeting(input: { date: string; title: string; memberEmails: string[] }) {
    const now = new Date().toISOString();
    const meeting: Meeting = {
      id: newId(),
      title: input.title.trim() || defaultMeetingTitle(input.date),
      date: input.date,
      memberEmails: input.memberEmails,
      status: "in_progress",
      content: "",
      topicIds: pendingTopicsForNextMeeting(topics).map((topic) => topic.id),
      results: [],
      createdAt: now,
      startedAt: now,
      createdBy: currentMember?.email ?? ""
    };

    onMeetingsChange([meeting, ...meetings]);
    setIsCreatingMeeting(false);
    setView({ kind: "room", id: meeting.id });
  }

  const roomMeeting = view.kind === "room" ? meetings.find((meeting) => meeting.id === view.id) : undefined;
  const detailMeeting = view.kind === "detail" ? meetings.find((meeting) => meeting.id === view.id) : undefined;

  if (roomMeeting) {
    return (
      <main className="dashboard meetings-page mt">
        <MeetingRoom
          meeting={roomMeeting}
          members={members}
          onExit={() => setView({ kind: "list" })}
          onMeetingChange={updateMeeting}
          onTopicsChange={onTopicsChange}
          topics={topics}
        />
      </main>
    );
  }

  if (detailMeeting) {
    return (
      <main className="dashboard meetings-page mt">
        <MeetingDetail
          meeting={detailMeeting}
          nameOf={nameOf}
          onBack={() => setView({ kind: "list" })}
          topics={topics}
        />
      </main>
    );
  }

  return (
    <main className="dashboard meetings-page mt">
      {topbar}
      <section className="mt-panel">
        <div className="mt-head">
          <div className="mt-tabs" role="tablist">
            <button aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")} role="tab" type="button">
              Histórico
            </button>
            <button aria-selected={tab === "topics"} className={tab === "topics" ? "active" : ""} onClick={() => setTab("topics")} role="tab" type="button">
              Tópicos <span className="mt-count">{pendingTopicsForNextMeeting(topics).length}</span>
            </button>
          </div>
          <button className="mt-btn primary" onClick={() => setIsCreatingMeeting(true)} type="button">
            <Plus size={16} /> Nova reunião
          </button>
        </div>

        {tab === "history" && (
          <HistoryTab
            meetings={meetings}
            nameOf={nameOf}
            onOpen={(meeting) => setView({ kind: meeting.status === "finished" ? "detail" : "room", id: meeting.id })}
            topics={topics}
          />
        )}

        {tab === "topics" && (
          <TopicsTab
            currentMember={currentMember}
            members={members}
            onTopicsChange={onTopicsChange}
            topics={topics}
          />
        )}
      </section>

      {isCreatingMeeting && (
        <NewMeetingModal
          currentEmail={currentMember?.email}
          members={members}
          onClose={() => setIsCreatingMeeting(false)}
          onStart={startMeeting}
          pendingCount={pendingTopicsForNextMeeting(topics).length}
        />
      )}
    </main>
  );
}

/* ------------------------------ Histórico ------------------------------ */

function HistoryTab({
  meetings,
  topics,
  nameOf,
  onOpen
}: {
  meetings: Meeting[];
  topics: Topic[];
  nameOf: (email: string) => string;
  onOpen: (meeting: Meeting) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [keyword, setKeyword] = useState("");

  const rows = useMemo(() => {
    const term = keyword.trim().toLowerCase();

    return [...meetings]
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
      .filter((meeting) => {
        if (from && meeting.date < from) return false;
        if (to && meeting.date > to) return false;
        if (!term) return true;

        const haystack = [
          meeting.title,
          htmlToText(meeting.content),
          ...meeting.memberEmails.map(nameOf),
          ...meeting.topicIds.map((id) => topics.find((topic) => topic.id === id)?.title ?? ""),
          ...meeting.results.map((result) => result.note ?? "")
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      });
  }, [from, keyword, meetings, nameOf, to, topics]);

  const hasFilter = Boolean(from || to || keyword);

  return (
    <div className="mt-section">
      <div className="mt-filters">
        <label className="mt-search">
          <Search size={16} />
          <input onChange={(event) => setKeyword(event.target.value)} placeholder="Buscar por palavra-chave (título, anotações, participantes, tópicos)" value={keyword} />
        </label>
        <label className="mt-field inline">
          De
          <input max={to || undefined} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label className="mt-field inline">
          Até
          <input min={from || undefined} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </label>
        {hasFilter && (
          <button className="mt-btn ghost small" onClick={() => { setFrom(""); setTo(""); setKeyword(""); }} type="button">
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {rows.length === 0 && (
        <p className="mt-empty">{meetings.length === 0 ? "Nenhuma reunião registrada ainda. Clique em “Nova reunião” para começar." : "Nenhuma reunião encontrada com esses filtros."}</p>
      )}

      <ul className="mt-list">
        {rows.map((meeting) => {
          const resolved = meeting.results.filter((result) => result.outcome === "resolved").length;
          const postponed = meeting.results.filter((result) => result.outcome === "postponed").length;
          const snippet = htmlToText(meeting.content);

          return (
            <li key={meeting.id}>
              <button className="mt-meeting-card" onClick={() => onOpen(meeting)} type="button">
                <span className="mt-date-badge">
                  <CalendarDays size={16} />
                  {formatDate(meeting.date)}
                </span>
                <span className="mt-meeting-main">
                  <strong>{meeting.title}</strong>
                  <small>{meeting.memberEmails.map(nameOf).join(", ") || "Sem participantes"}</small>
                  {snippet && <em>{snippet.slice(0, 160)}{snippet.length > 160 ? "…" : ""}</em>}
                </span>
                <span className="mt-meeting-meta">
                  <span className={`mt-chip ${meeting.status}`}>{meeting.status === "finished" ? "Finalizada" : "Em andamento"}</span>
                  <small>{resolved} resolvido{resolved === 1 ? "" : "s"} · {postponed} adiado{postponed === 1 ? "" : "s"}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MeetingDetail({
  meeting,
  topics,
  nameOf,
  onBack
}: {
  meeting: Meeting;
  topics: Topic[];
  nameOf: (email: string) => string;
  onBack: () => void;
}) {
  return (
    <div className="mt-detail">
      <header className="mt-room-header">
        <button className="mt-btn ghost" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Reuniões
        </button>
        <div className="mt-room-title static">
          <h1>{meeting.title}</h1>
          <span>
            {formatDate(meeting.date)} · {meeting.memberEmails.map(nameOf).join(", ") || "Sem participantes"}
            {meeting.finishedAt ? ` · finalizada em ${formatDateTime(meeting.finishedAt)}` : ""}
          </span>
        </div>
      </header>

      <div className="mt-detail-body">
        <section className="mt-detail-notes">
          <h2>Anotações</h2>
          <RichEditor key={meeting.id} readOnly value={meeting.content || "<p><em>Sem anotações.</em></p>"} />
        </section>

        <aside className="mt-detail-topics">
          <h2>Tópicos da reunião</h2>
          {meeting.topicIds.length === 0 && <p className="mt-empty">Nenhum tópico pendente nesta reunião.</p>}
          <ul className="mt-agenda">
            {meeting.topicIds.map((id) => {
              const topic = topics.find((item) => item.id === id);
              const result = meeting.results.find((entry) => entry.topicId === id);

              return (
                <li className={`mt-agenda-item ${result?.outcome ?? ""}`} key={id}>
                  <div className="mt-agenda-head">
                    {result?.outcome === "resolved" ? (
                      <span className="mt-check done"><CheckSquare size={20} /></span>
                    ) : (
                      <span className="mt-check postponed"><Clock size={20} /></span>
                    )}
                    <div>
                      <strong>{topic?.title ?? "Tópico removido"}</strong>
                      <small>Responsável: {topic?.ownerName ?? "—"}</small>
                    </div>
                  </div>
                  {result?.outcome === "resolved" && <p className="mt-agenda-result"><b>Resolução:</b> {result.note || "—"}</p>}
                  {result?.outcome === "postponed" && (
                    <p className="mt-agenda-result">
                      <b>Adiado</b> para {result.postponeTo === "undefined" ? "data indefinida" : "a próxima reunião"}
                      {result.auto ? " (automático ao finalizar)" : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------ Nova reunião ------------------------------ */

function NewMeetingModal({
  members,
  currentEmail,
  pendingCount,
  onClose,
  onStart
}: {
  members: MemberLite[];
  currentEmail?: string;
  pendingCount: number;
  onClose: () => void;
  onStart: (input: { date: string; title: string; memberEmails: string[] }) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>(currentEmail ? [currentEmail] : []);
  const [error, setError] = useState("");

  function submit() {
    if (!date) {
      setError("Informe o dia da reunião.");
      return;
    }

    if (selected.length === 0) {
      setError("Selecione pelo menos um membro.");
      return;
    }

    onStart({ date, title, memberEmails: selected });
  }

  return (
    <Modal
      footer={
        <>
          <button className="mt-btn ghost" onClick={onClose} type="button">Cancelar</button>
          <button className="mt-btn primary" onClick={submit} type="button">Iniciar reunião</button>
        </>
      }
      onClose={onClose}
      title="Nova reunião"
    >
      <div className="mt-form">
        <label className="mt-field">
          Dia da reunião *
          <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>

        <label className="mt-field">
          Título (opcional)
          <input onChange={(event) => setTitle(event.target.value)} placeholder={defaultMeetingTitle(date || todayIso())} value={title} />
        </label>

        <fieldset className="mt-field">
          <legend>Membros *</legend>
          <div className="mt-chips">
            {members.map((member) => {
              const on = selected.includes(member.email);
              return (
                <label className={`mt-chip-check ${on ? "on" : ""}`} key={member.id}>
                  <input
                    checked={on}
                    onChange={() => setSelected((current) => (on ? current.filter((email) => email !== member.email) : [...current, member.email]))}
                    type="checkbox"
                  />
                  {member.name}
                </label>
              );
            })}
            {members.length === 0 && <span className="mt-empty">Nenhum membro cadastrado no produto.</span>}
          </div>
        </fieldset>

        <p className="mt-hint">
          {pendingCount > 0
            ? (pendingCount === 1 ? "1 tópico pendente será levado para esta reunião." : `${pendingCount} tópicos pendentes serão levados para esta reunião.`)
            : "Não há tópicos pendentes para esta reunião."}
        </p>
        {error && <p className="mt-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/* ------------------------------ Tópicos ------------------------------ */

type TopicFilter = "all" | "open" | "pending" | "postponed" | "resolved";

function topicStatusLabel(topic: Topic) {
  if (topic.status === "resolved") return "Resolvido";
  if (topic.status === "postponed") return "Adiado";
  return "Aberto";
}

function TopicsTab({
  topics,
  members,
  currentMember,
  onTopicsChange
}: {
  topics: Topic[];
  members: MemberLite[];
  currentMember?: MemberLite;
  onTopicsChange: (topics: Topic[]) => void;
}) {
  const [filter, setFilter] = useState<TopicFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<Topic | "new" | null>(null);
  const [deleting, setDeleting] = useState<Topic | null>(null);

  const counts = {
    all: topics.length,
    open: topics.filter((topic) => topic.status === "open").length,
    pending: pendingTopicsForNextMeeting(topics).length,
    postponed: topics.filter((topic) => topic.status === "postponed").length,
    resolved: topics.filter((topic) => topic.status === "resolved").length
  };

  const rows = useMemo(() => {
    const term = keyword.trim().toLowerCase();

    return [...topics]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((topic) => {
        if (filter === "open" && topic.status !== "open") return false;
        if (filter === "pending" && !(topic.status !== "resolved" && topic.presentOn === "next")) return false;
        if (filter === "postponed" && topic.status !== "postponed") return false;
        if (filter === "resolved" && topic.status !== "resolved") return false;
        return !term || `${topic.title} ${topic.description} ${topic.ownerName} ${topic.resolution?.text ?? ""}`.toLowerCase().includes(term);
      });
  }, [filter, keyword, topics]);

  function save(input: { title: string; description: string; presentOn: TopicPresent; ownerEmail: string }) {
    const owner = members.find((member) => member.email === input.ownerEmail);
    const ownerName = owner?.name ?? input.ownerEmail;

    if (editing && editing !== "new") {
      onTopicsChange(
        topics.map((topic) =>
          topic.id === editing.id
            ? { ...topic, title: input.title.trim(), description: input.description.trim(), presentOn: input.presentOn, ownerEmail: input.ownerEmail, ownerName }
            : topic
        )
      );
    } else {
      onTopicsChange([
        {
          id: newId(),
          title: input.title.trim(),
          description: input.description.trim(),
          presentOn: input.presentOn,
          status: "open",
          ownerEmail: input.ownerEmail,
          ownerName,
          createdAt: new Date().toISOString(),
          createdBy: currentMember?.name ?? "",
          history: []
        },
        ...topics
      ]);
    }

    setEditing(null);
  }

  const filters: Array<{ id: TopicFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "open", label: "Abertos" },
    { id: "pending", label: "Pendentes" },
    { id: "postponed", label: "Adiados" },
    { id: "resolved", label: "Resolvidos" }
  ];

  return (
    <div className="mt-section">
      <div className="mt-filters">
        <label className="mt-search">
          <Search size={16} />
          <input onChange={(event) => setKeyword(event.target.value)} placeholder="Buscar tópicos" value={keyword} />
        </label>
        <div className="mt-segment" role="group" aria-label="Filtrar por status">
          {filters.map((item) => (
            <button className={filter === item.id ? "active" : ""} key={item.id} onClick={() => setFilter(item.id)} type="button">
              {item.label} <span className="mt-count">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <button className="mt-btn primary" onClick={() => setEditing("new")} type="button">
          <Plus size={16} /> Novo tópico
        </button>
      </div>

      {rows.length === 0 && (
        <p className="mt-empty">{topics.length === 0 ? "Nenhum tópico criado ainda. Adicione tópicos para levar à próxima reunião." : "Nenhum tópico com esses filtros."}</p>
      )}

      <ul className="mt-list">
        {rows.map((topic) => (
          <li className={`mt-topic ${topic.status}`} key={topic.id}>
            <div className="mt-topic-main">
              <div className="mt-topic-title">
                <strong>{topic.title}</strong>
                <span className={`mt-chip ${topic.status}`}>{topicStatusLabel(topic)}</span>
                {topic.status !== "resolved" && <span className="mt-chip soft">{presentLabel(topic.presentOn)}</span>}
              </div>
              {topic.description && <p>{topic.description}</p>}
              <small>
                Responsável: {topic.ownerName} · criado em {formatDateTime(topic.createdAt)}
              </small>

              {topic.status === "resolved" && topic.resolution && (
                <p className="mt-topic-resolution">
                  <CheckSquare size={16} /> Resolvido na reunião <b>{topic.resolution.meetingTitle}</b> em {formatDate(topic.resolution.date)}
                  {topic.resolution.text ? <> — {topic.resolution.text}</> : null}
                </p>
              )}

              {topic.status !== "resolved" && topic.history.filter((event) => event.type === "postponed").length > 0 && (
                <small className="mt-topic-postponed">
                  <Clock size={14} /> Adiado {topic.history.filter((event) => event.type === "postponed").length}x — última vez em {formatDate(topic.history.filter((event) => event.type === "postponed").at(-1)!.at)}
                </small>
              )}
            </div>
            <div className="mt-topic-actions">
              <button aria-label={`Editar ${topic.title}`} className="mt-icon-button" onClick={() => setEditing(topic)} title="Editar" type="button">
                <Pencil size={16} />
              </button>
              <button aria-label={`Excluir ${topic.title}`} className="mt-icon-button danger" onClick={() => setDeleting(topic)} title="Excluir" type="button">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <TopicModal
          currentEmail={currentMember?.email}
          members={members}
          onClose={() => setEditing(null)}
          onSave={save}
          topic={editing === "new" ? undefined : editing}
        />
      )}

      {deleting && (
        <ConfirmModal
          confirmLabel="Excluir"
          danger
          message={<>O tópico <strong>{deleting.title}</strong> será excluído. Esta ação não pode ser desfeita.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onTopicsChange(topics.filter((topic) => topic.id !== deleting.id));
            setDeleting(null);
          }}
          title="Excluir tópico"
        />
      )}
    </div>
  );
}

function TopicModal({
  topic,
  members,
  currentEmail,
  onClose,
  onSave
}: {
  topic?: Topic;
  members: MemberLite[];
  currentEmail?: string;
  onClose: () => void;
  onSave: (input: { title: string; description: string; presentOn: TopicPresent; ownerEmail: string }) => void;
}) {
  const [title, setTitle] = useState(topic?.title ?? "");
  const [description, setDescription] = useState(topic?.description ?? "");
  const [presentOn, setPresentOn] = useState<TopicPresent>(topic?.presentOn ?? "next");
  const [ownerEmail, setOwnerEmail] = useState(topic?.ownerEmail ?? currentEmail ?? members[0]?.email ?? "");
  const [error, setError] = useState("");

  function submit() {
    if (!title.trim()) {
      setError("O título é obrigatório.");
      return;
    }

    onSave({ title, description, presentOn, ownerEmail });
  }

  return (
    <Modal
      footer={
        <>
          <button className="mt-btn ghost" onClick={onClose} type="button">Cancelar</button>
          <button className="mt-btn primary" onClick={submit} type="button">{topic ? "Salvar" : "Criar tópico"}</button>
        </>
      }
      onClose={onClose}
      title={topic ? "Editar tópico" : "Novo tópico"}
    >
      <form className="mt-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="mt-field">
          Título *
          <input autoFocus maxLength={160} onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label className="mt-field">
          Descrição
          <textarea onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
        </label>
        <label className="mt-field">
          Data de apresentação
          <select onChange={(event) => setPresentOn(event.target.value as TopicPresent)} value={presentOn}>
            <option value="next">Próxima reunião</option>
            <option value="undefined">Indefinido</option>
          </select>
        </label>
        <label className="mt-field">
          Responsável
          <select onChange={(event) => setOwnerEmail(event.target.value)} value={ownerEmail}>
            {members.map((member) => (
              <option key={member.id} value={member.email}>{member.name}</option>
            ))}
          </select>
        </label>
        {error && <p className="mt-error" role="alert">{error}</p>}
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}
