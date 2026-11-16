import { useMemo, useState } from "react";
import { ArrowLeft, CheckSquare, Clock, Square } from "lucide-react";
import { RichEditor } from "./RichEditor";
import { ConfirmModal } from "./ui";
import { formatDate, formatDateTime } from "./types";
import type { MemberLite, Meeting, MeetingTopicResult, Topic, TopicPresent } from "./types";

type SidePanel = "topics" | "people";

/**
 * Tela da reunião em andamento: editor de texto rico + painel de tópicos pendentes.
 * Cada tópico pode ser resolvido (com texto de resolução) ou adiado (próxima reunião / indefinido).
 */
export function MeetingRoom({
  meeting,
  topics,
  members,
  onMeetingChange,
  onTopicsChange,
  onExit
}: {
  meeting: Meeting;
  topics: Topic[];
  members: MemberLite[];
  onMeetingChange: (meeting: Meeting) => void;
  onTopicsChange: (topics: Topic[]) => void;
  onExit: () => void;
}) {
  const [panel, setPanel] = useState<SidePanel>("topics");
  const [answering, setAnswering] = useState<string | null>(null);
  const [isConfirmingFinish, setIsConfirmingFinish] = useState(false);

  const agenda = useMemo(
    () => meeting.topicIds.map((id) => topics.find((topic) => topic.id === id)).filter((topic): topic is Topic => Boolean(topic)),
    [meeting.topicIds, topics]
  );
  const resultOf = (topicId: string) => meeting.results.find((result) => result.topicId === topicId);
  const unanswered = agenda.filter((topic) => !resultOf(topic.id)?.outcome);
  const participants = meeting.memberEmails.map((email) => members.find((member) => member.email === email)?.name ?? email);

  /** Registra a resposta de um tópico no tópico e na reunião. */
  function applyOutcome(topicId: string, result: Omit<MeetingTopicResult, "topicId">) {
    const now = new Date().toISOString();
    const nextTopics = topics.map((topic) => {
      if (topic.id !== topicId) {
        return topic;
      }

      const history = topic.history.filter((event) => event.meetingId !== meeting.id);

      if (result.outcome === "resolved") {
        return {
          ...topic,
          status: "resolved" as const,
          resolution: { meetingId: meeting.id, meetingTitle: meeting.title, date: meeting.date, text: result.note ?? "", at: now },
          history: [...history, { at: now, meetingId: meeting.id, meetingTitle: meeting.title, type: "resolved" as const, note: result.note }]
        };
      }

      return {
        ...topic,
        status: "postponed" as const,
        presentOn: result.postponeTo ?? "next",
        resolution: undefined,
        history: [
          ...history,
          { at: now, meetingId: meeting.id, meetingTitle: meeting.title, type: "postponed" as const, to: result.postponeTo ?? "next", auto: result.auto }
        ]
      };
    });

    const otherResults = meeting.results.filter((entry) => entry.topicId !== topicId);
    return { topics: nextTopics, results: [...otherResults, { topicId, ...result }] };
  }

  function answer(topicId: string, result: Omit<MeetingTopicResult, "topicId">) {
    const next = applyOutcome(topicId, result);
    onTopicsChange(next.topics);
    onMeetingChange({ ...meeting, results: next.results });
    setAnswering(null);
  }

  function finish(autoPostpone: boolean) {
    let nextTopics = topics;
    let results = meeting.results;

    if (autoPostpone) {
      for (const topic of unanswered) {
        const now = new Date().toISOString();
        nextTopics = nextTopics.map((current) =>
          current.id === topic.id
            ? {
                ...current,
                status: "postponed" as const,
                presentOn: "next" as const,
                history: [
                  ...current.history.filter((event) => event.meetingId !== meeting.id),
                  { at: now, meetingId: meeting.id, meetingTitle: meeting.title, type: "postponed" as const, to: "next" as const, auto: true }
                ]
              }
            : current
        );
        results = [...results.filter((entry) => entry.topicId !== topic.id), { topicId: topic.id, outcome: "postponed", postponeTo: "next", auto: true }];
      }
    }

    onTopicsChange(nextTopics);
    onMeetingChange({ ...meeting, results, status: "finished", finishedAt: new Date().toISOString() });
    setIsConfirmingFinish(false);
    onExit();
  }

  return (
    <div className="mt-room">
      <header className="mt-room-header">
        <button className="mt-btn ghost" onClick={onExit} type="button">
          <ArrowLeft size={16} /> Reuniões
        </button>
        <div className="mt-room-title">
          <input
            aria-label="Título da reunião"
            onChange={(event) => onMeetingChange({ ...meeting, title: event.target.value })}
            value={meeting.title}
          />
          <span>{formatDate(meeting.date)} · {participants.length} participante{participants.length === 1 ? "" : "s"}</span>
        </div>
        <button
          className="mt-btn primary"
          onClick={() => (unanswered.length > 0 ? setIsConfirmingFinish(true) : finish(false))}
          type="button"
        >
          Finalizar Reunião
        </button>
      </header>

      <div className="mt-room-body">
        <section className="mt-room-editor" aria-label="Anotações da reunião">
          <RichEditor
            onChange={(content) => onMeetingChange({ ...meeting, content })}
            placeholder="Registre aqui o que foi discutido, decisões, checklists, prints..."
            value={meeting.content}
          />
        </section>

        <aside className="mt-room-side">
          <div className="mt-tabs" role="tablist">
            <button aria-selected={panel === "topics"} className={panel === "topics" ? "active" : ""} onClick={() => setPanel("topics")} role="tab" type="button">
              Tópicos pendentes <span className="mt-count">{unanswered.length}</span>
            </button>
            <button aria-selected={panel === "people"} className={panel === "people" ? "active" : ""} onClick={() => setPanel("people")} role="tab" type="button">
              Participantes
            </button>
          </div>

          {panel === "people" && (
            <ul className="mt-people">
              {participants.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}

          {panel === "topics" && (
            <div className="mt-agenda">
              {agenda.length === 0 && <p className="mt-empty">Nenhum tópico pendente para esta reunião.</p>}
              {agenda.map((topic) => {
                const result = resultOf(topic.id);
                return (
                  <TopicAnswerItem
                    key={topic.id}
                    isOpen={answering === topic.id}
                    onCancel={() => setAnswering(null)}
                    onOpen={() => setAnswering(topic.id)}
                    onSave={(value) => answer(topic.id, value)}
                    result={result}
                    topic={topic}
                  />
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {isConfirmingFinish && (
        <ConfirmModal
          cancelLabel="Voltar à reunião"
          confirmLabel="Finalizar e adiar"
          message={
            <>
              Ainda há <strong>{unanswered.length}</strong> tópico{unanswered.length === 1 ? "" : "s"} em aberto
              (sem resolução ou adiamento). Se finalizar agora, {unanswered.length === 1 ? "ele será adiado" : "eles serão adiados"} para a próxima reunião.
              Deseja realmente finalizar?
            </>
          }
          onCancel={() => setIsConfirmingFinish(false)}
          onConfirm={() => finish(true)}
          title="Finalizar reunião"
        />
      )}
    </div>
  );
}

function TopicAnswerItem({
  topic,
  result,
  isOpen,
  onOpen,
  onCancel,
  onSave
}: {
  topic: Topic;
  result?: MeetingTopicResult;
  isOpen: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSave: (result: Omit<MeetingTopicResult, "topicId">) => void;
}) {
  const [mode, setMode] = useState<"resolved" | "postponed">(result?.outcome ?? "resolved");
  const [note, setNote] = useState(result?.note ?? "");
  const [postponeTo, setPostponeTo] = useState<TopicPresent>(result?.postponeTo ?? "next");

  const icon =
    result?.outcome === "resolved" ? (
      <span className="mt-check done" title="Resolvido"><CheckSquare size={20} /></span>
    ) : result?.outcome === "postponed" ? (
      <span className="mt-check postponed" title="Adiado"><Clock size={20} /></span>
    ) : (
      <span className="mt-check" title="Pendente"><Square size={20} /></span>
    );

  return (
    <article className={`mt-agenda-item ${result?.outcome ?? ""}`}>
      <div className="mt-agenda-head">
        {icon}
        <div>
          <strong>{topic.title}</strong>
          <small>Responsável: {topic.ownerName}</small>
        </div>
        {!isOpen && (
          <button className="mt-btn small" onClick={onOpen} type="button">
            {result?.outcome ? "Editar resposta" : "Responder"}
          </button>
        )}
      </div>

      {topic.description && <p className="mt-agenda-desc">{topic.description}</p>}

      {result?.outcome === "resolved" && !isOpen && <p className="mt-agenda-result"><b>Resolução:</b> {result.note || "—"}</p>}
      {result?.outcome === "postponed" && !isOpen && (
        <p className="mt-agenda-result">
          <b>Adiado</b> para {result.postponeTo === "undefined" ? "data indefinida" : "a próxima reunião"}
          {result.auto ? " (automático ao finalizar)" : ""}
        </p>
      )}

      {isOpen && (
        <form
          className="mt-answer"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(mode === "resolved" ? { outcome: "resolved", note: note.trim() } : { outcome: "postponed", postponeTo });
          }}
        >
          <div className="mt-segment" role="radiogroup" aria-label="Tipo de resposta">
            <button aria-checked={mode === "resolved"} className={mode === "resolved" ? "active" : ""} onClick={() => setMode("resolved")} role="radio" type="button">
              Resolver
            </button>
            <button aria-checked={mode === "postponed"} className={mode === "postponed" ? "active" : ""} onClick={() => setMode("postponed")} role="radio" type="button">
              Adiar
            </button>
          </div>

          {mode === "resolved" ? (
            <textarea
              autoFocus
              onChange={(event) => setNote(event.target.value)}
              placeholder="Indique a resolução..."
              rows={3}
              value={note}
            />
          ) : (
            <label className="mt-field">
              Adiar para
              <select onChange={(event) => setPostponeTo(event.target.value as TopicPresent)} value={postponeTo}>
                <option value="next">Próxima reunião</option>
                <option value="undefined">Indefinido</option>
              </select>
            </label>
          )}

          <div className="mt-answer-actions">
            <button className="mt-btn ghost small" onClick={onCancel} type="button">Cancelar</button>
            <button className="mt-btn primary small" type="submit">Salvar</button>
          </div>
        </form>
      )}

      {result?.outcome && !isOpen && (
        <small className="mt-agenda-foot">
          {result.outcome === "resolved" ? "Resolvido" : "Adiado"} em {formatDateTime(topic.history.at(-1)?.at ?? new Date().toISOString())}
        </small>
      )}
    </article>
  );
}
