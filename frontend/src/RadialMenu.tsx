import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import "./radial-menu.css";

type RadialLink = { id: string; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> };
type RadialGroup = RadialLink & { children: RadialLink[] };
type RadialEntry = RadialLink | RadialGroup;

const isGroup = (entry: RadialEntry): entry is RadialGroup => "children" in entry;

// Geometria (meia-roda voltada para cima; o centro fica na borda inferior da tela).
const CX = 270;
const CY = 262;
const HOLE = 46;
const INNER_OUT = 150;
const GAP = 8;
const OUTER_IN = INNER_OUT + GAP;
const OUTER_OUT = 252;

const point = (radius: number, angle: number) => ({
  x: CX + radius * Math.cos(angle),
  y: CY - radius * Math.sin(angle)
});

function sectorPath(rIn: number, rOut: number, a0: number, a1: number) {
  const o0 = point(rOut, a0);
  const o1 = point(rOut, a1);
  const i1 = point(rIn, a1);
  const i0 = point(rIn, a0);
  return `M ${o0.x} ${o0.y} A ${rOut} ${rOut} 0 0 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${rIn} ${rIn} 0 0 0 ${i0.x} ${i0.y} Z`;
}

function Ring<T extends RadialLink>({
  items,
  rIn,
  rOut,
  isActive,
  onPick,
  className
}: {
  items: T[];
  rIn: number;
  rOut: number;
  isActive: (item: T) => boolean;
  onPick: (item: T) => void;
  className: string;
}) {
  const step = Math.PI / items.length;

  return (
    <g className={className}>
      {items.map((item, index) => {
        // Da esquerda (180°) para a direita (0°).
        const a0 = Math.PI - index * step;
        const a1 = Math.PI - (index + 1) * step;
        const mid = point((rIn + rOut) / 2, (a0 + a1) / 2);
        const Icon = item.icon;

        return (
          <g
            aria-label={item.label}
            className={`radial-sector ${isActive(item) ? "active" : ""}`}
            key={item.id}
            onClick={() => onPick(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPick(item);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <path d={sectorPath(rIn, rOut, a0 - 0.006, a1 + 0.006)} />
            <foreignObject height={64} width={84} x={mid.x - 42} y={mid.y - 30}>
              <div className="radial-label">
                <span className="radial-icon"><Icon size={20} strokeWidth={2} /></span>
                <span className="radial-text">{item.label}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}

export function RadialMenu({ activePage, entries, onNavigate }: { activePage: string; entries: RadialEntry[]; onNavigate: (page: never) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const navigate = onNavigate as (page: string) => void;

  const openGroup = entries.find((entry): entry is RadialGroup => isGroup(entry) && entry.id === openGroupId);
  const activeGroupId = entries.find((entry) => isGroup(entry) && entry.children.some((child) => child.id === activePage))?.id;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setOpenGroupId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    setOpenGroupId(null);
  }

  function pickEntry(entry: RadialEntry) {
    if (isGroup(entry)) {
      setOpenGroupId((current) => (current === entry.id ? null : entry.id));
      return;
    }
    navigate(entry.id);
    close();
  }

  return (
    <div className={`radial-menu ${isOpen ? "open" : ""}`}>
      {isOpen && <button aria-label="Fechar menu" className="radial-backdrop" onClick={close} type="button" />}
      <svg aria-hidden={!isOpen} className="radial-svg" viewBox={`0 0 ${CX * 2} ${CY}`}>
        {isOpen && (
          <>
            {openGroup && (
              <Ring
                className="radial-ring radial-ring-outer"
                isActive={(item) => item.id === activePage}
                items={openGroup.children}
                key={openGroup.id}
                onPick={(item) => {
                  navigate(item.id);
                  close();
                }}
                rIn={OUTER_IN}
                rOut={OUTER_OUT}
              />
            )}
            <Ring
              className="radial-ring radial-ring-inner"
              isActive={(entry) => (isGroup(entry) ? entry.id === openGroupId || entry.id === activeGroupId : entry.id === activePage)}
              items={entries}
              onPick={pickEntry}
              rIn={HOLE + GAP}
              rOut={INNER_OUT}
            />
          </>
        )}
      </svg>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        className="radial-toggle"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        type="button"
      >
        <tna-logo animate="none" variant="symbol" style={{ width: 34 }} />
      </button>
    </div>
  );
}
