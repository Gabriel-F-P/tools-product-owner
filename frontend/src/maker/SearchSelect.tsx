import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface SearchOption {
  value: string;
  label: string;
  /** Texto de apoio à direita (ex.: preço). */
  hint?: string;
}

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Campo de seleção com busca: digite para filtrar a lista (útil com muitos clientes e modelos). */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder,
  emptyText = "Nada encontrado.",
  ariaLabel
}: {
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  placeholder: string;
  emptyText?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = plain(query.trim());
    return term ? options.filter((option) => plain(option.label).includes(term)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(option: SearchOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="search-select" ref={root}>
      <input
        aria-autocomplete="list"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        className="search-select-input"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((current) => Math.min(current + 1, filtered.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (filtered[active]) pick(filtered[active]);
          } else if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
            setQuery("");
          }
        }}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={open ? query : selected?.label ?? ""}
      />
      <ChevronDown className="search-select-chevron" size={16} />
      {open && (
        <ul className="search-select-list" role="listbox">
          {filtered.length === 0 && <li className="search-select-empty">{emptyText}</li>}
          {filtered.map((option, index) => (
            <li
              aria-selected={option.value === value}
              className={`${index === active ? "active" : ""} ${option.value === value ? "selected" : ""}`}
              key={option.value}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              <span>{option.label}</span>
              {option.hint && <small>{option.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
