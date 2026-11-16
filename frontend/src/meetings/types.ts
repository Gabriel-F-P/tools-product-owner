export type TopicPresent = "next" | "undefined";
export type TopicStatus = "open" | "postponed" | "resolved";

export interface TopicEvent {
  at: string;
  meetingId: string;
  meetingTitle: string;
  type: "resolved" | "postponed";
  note?: string;
  to?: TopicPresent;
  auto?: boolean;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  /** Data de apresentação: próxima reunião ou indefinido. */
  presentOn: TopicPresent;
  status: TopicStatus;
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
  createdBy: string;
  resolution?: { meetingId: string; meetingTitle: string; date: string; text: string; at: string };
  history: TopicEvent[];
}

export interface MeetingTopicResult {
  topicId: string;
  outcome?: "resolved" | "postponed";
  note?: string;
  postponeTo?: TopicPresent;
  /** Adiado automaticamente ao finalizar a reunião. */
  auto?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  /** AAAA-MM-DD */
  date: string;
  memberEmails: string[];
  /** scheduled = agendada para depois; in_progress = acontecendo; finished = no histórico. */
  status: "scheduled" | "in_progress" | "finished";
  /** Pautas (uma por linha). */
  agenda?: string;
  /** HTML do editor. */
  content: string;
  /** Tópicos pendentes no momento em que a reunião começou. */
  topicIds: string[];
  results: MeetingTopicResult[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  createdBy: string;
}

export interface MemberLite {
  id: string;
  name: string;
  email: string;
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function formatDate(iso: string) {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function defaultMeetingTitle(date: string) {
  return `Reunião de ${formatDate(date)}`;
}

export function htmlToText(html: string) {
  if (typeof document === "undefined") return html;
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Tópicos que entram na próxima reunião: marcados para "próxima reunião" e ainda não resolvidos. */
export function pendingTopicsForNextMeeting(topics: Topic[]) {
  return topics.filter((t) => t.status !== "resolved" && t.presentOn === "next");
}

export function agendaLines(agenda?: string) {
  return (agenda ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/** Inicia uma reunião (agendada ou nova): captura os tópicos pendentes naquele momento. */
export function beginMeeting(meeting: Meeting, topics: Topic[]): Meeting {
  return {
    ...meeting,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    topicIds: pendingTopicsForNextMeeting(topics).map((topic) => topic.id),
    results: []
  };
}

export const statusLabel = (status: Meeting["status"]) =>
  status === "finished" ? "Finalizada" : status === "scheduled" ? "Agendada" : "Em andamento";
