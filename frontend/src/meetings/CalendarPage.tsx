import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Modal } from "./ui";
import { agendaLines, formatDate, statusLabel } from "./types";
import type { MemberLite, Meeting } from "./types";
import "./meetings.css";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_CHIPS = 3;

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function CalendarPage({
  topbar,
  meetings,
  members,
  onOpenMeeting,
  onStartMeeting
}: {
  topbar: ReactNode;
  meetings: Meeting[];
  members: MemberLite[];
  onOpenMeeting: (meeting: Meeting) => void;
  onStartMeeting: (meeting: Meeting) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [dayList, setDayList] = useState<string | null>(null);

  const nameOf = (email: string) => members.find((member) => member.email === email)?.name ?? email;

  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();

    for (const meeting of meetings) {
      map.set(meeting.date, [...(map.get(meeting.date) ?? []), meeting]);
    }

    return map;
  }, [meetings]);

  // 6 semanas a partir do domingo da semana do dia 1.
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const start = new Date(cursor.year, cursor.month, 1 - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { date, key: dateKey(date), inMonth: date.getMonth() === cursor.month };
    });
  }, [cursor]);

  const rawTitle = new Date(cursor.year, cursor.month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const todayKey = dateKey(today);
  const upcoming = [...meetings]
    .filter((meeting) => meeting.status === "scheduled" && meeting.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);
  const openMeeting = meetings.find((meeting) => meeting.id === openId);

  function shift(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  function chip(meeting: Meeting) {
    return (
      <button
        className={`mt-cal-chip ${meeting.status}`}
        key={meeting.id}
        onClick={() => setOpenId(meeting.id)}
        title={`${meeting.title} · ${statusLabel(meeting.status)}`}
        type="button"
      >
        <span className="dot" />
        <span className="label">{meeting.title}</span>
      </button>
    );
  }

  return (
    <main className="dashboard calendar-page mt">
      {topbar}
      <section className="mt-panel">
        <div className="mt-cal-toolbar">
          <div className="mt-cal-nav">
            <button aria-label="Mês anterior" className="mt-icon-button" onClick={() => shift(-1)} type="button">
              <ChevronLeft size={18} />
            </button>
            <h2 aria-live="polite">{title}</h2>
            <button aria-label="Próximo mês" className="mt-icon-button" onClick={() => shift(1)} type="button">
              <ChevronRight size={18} />
            </button>
            <button
              className="mt-btn small"
              onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
              type="button"
            >
              Hoje
            </button>
          </div>
          <div className="mt-cal-legend" aria-label="Legenda">
            <span><i className="dot scheduled" /> Agendada</span>
            <span><i className="dot in_progress" /> Em andamento</span>
            <span><i className="dot finished" /> Finalizada</span>
          </div>
        </div>

        <div className="mt-cal-layout">
          <div className="mt-cal" role="grid" aria-label={title}>
            {WEEKDAYS.map((day) => (
              <div className="mt-cal-weekday" key={day} role="columnheader">{day}</div>
            ))}
            {cells.map(({ date, key, inMonth }) => {
              const list = byDay.get(key) ?? [];
              const extra = list.length - MAX_CHIPS;

              return (
                <div className={`mt-cal-day ${inMonth ? "" : "outside"} ${key === todayKey ? "today" : ""}`} key={key} role="gridcell">
                  <span className="mt-cal-number">{date.getDate()}</span>
                  <div className="mt-cal-chips">
                    {list.slice(0, MAX_CHIPS).map(chip)}
                    {extra > 0 && (
                      <button className="mt-cal-more" onClick={() => setDayList(key)} type="button">
                        +{extra} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="mt-cal-upcoming">
            <h3>Próximas reuniões</h3>
            {upcoming.length === 0 && <p className="mt-empty">Nenhuma reunião agendada. Use “Nova reunião” → “Iniciar depois”.</p>}
            <ul>
              {upcoming.map((meeting) => (
                <li key={meeting.id}>
                  <button onClick={() => setOpenId(meeting.id)} type="button">
                    <strong>{meeting.title}</strong>
                    <small>{formatDate(meeting.date)} · {meeting.memberEmails.length} membro{meeting.memberEmails.length === 1 ? "" : "s"}</small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {dayList && (
        <Modal onClose={() => setDayList(null)} title={`Reuniões de ${formatDate(dayList)}`}>
          <div className="mt-cal-daylist">{(byDay.get(dayList) ?? []).map(chip)}</div>
        </Modal>
      )}

      {openMeeting && (
        <Modal
          footer={
            openMeeting.status === "scheduled" ? (
              <>
                <button className="mt-btn ghost" onClick={() => onOpenMeeting(openMeeting)} type="button">Abrir em Reuniões</button>
                <button className="mt-btn primary" onClick={() => onStartMeeting(openMeeting)} type="button">
                  <Play size={16} /> Iniciar reunião
                </button>
              </>
            ) : (
              <button className="mt-btn primary" onClick={() => onOpenMeeting(openMeeting)} type="button">
                {openMeeting.status === "in_progress" ? "Voltar à reunião" : "Ver anotações"}
              </button>
            )
          }
          onClose={() => setOpenId(null)}
          title={openMeeting.title}
        >
          <dl className="mt-info">
            <div>
              <dt>Título</dt>
              <dd>{openMeeting.title}</dd>
            </div>
            <div>
              <dt>Dia</dt>
              <dd>
                {formatDate(openMeeting.date)} <span className={`mt-chip ${openMeeting.status}`}>{statusLabel(openMeeting.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Pautas</dt>
              <dd>
                {agendaLines(openMeeting.agenda).length === 0 ? (
                  <span className="mt-muted">Nenhuma pauta informada.</span>
                ) : (
                  <ul className="mt-agenda-list">
                    {agendaLines(openMeeting.agenda).map((line, index) => (
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt>Membros</dt>
              <dd>
                <div className="mt-chips">
                  {openMeeting.memberEmails.length === 0 && <span className="mt-muted">Sem participantes.</span>}
                  {openMeeting.memberEmails.map((email) => (
                    <span className="mt-chip soft" key={email}>{nameOf(email)}</span>
                  ))}
                </div>
              </dd>
            </div>
          </dl>
        </Modal>
      )}
    </main>
  );
}
