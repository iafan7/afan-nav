"use client";

import { useEffect, useRef, useState } from "react";
import { EngineBrandIcon, IconChevron } from "@/components/icons";

export type EngineOption = {
  id: string;
  name: string;
  urlTemplate: string;
  isDefault: boolean;
};

type Props = {
  engines: EngineOption[];
  value: string;
  onChange: (id: string) => void;
};

export function EngineSelect({ engines, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = engines.find((e) => e.id === value) ?? engines[0];

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!current) return null;

  return (
    <div className={`mn-engine${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="mn-engine-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="选择搜索引擎"
        onClick={() => setOpen((v) => !v)}
      >
        <EngineBrandIcon name={current.name} size={18} />
        <span className="mn-engine-name">{current.name}</span>
        <IconChevron size={14} direction="down" className="mn-engine-chevron" />
      </button>
      {open ? (
        <ul className="mn-engine-menu" role="listbox">
          {engines.map((engine) => (
            <li key={engine.id} role="option" aria-selected={engine.id === current.id}>
              <button
                type="button"
                className={`mn-engine-option${engine.id === current.id ? " is-active" : ""}`}
                onClick={() => {
                  onChange(engine.id);
                  setOpen(false);
                }}
              >
                <EngineBrandIcon name={engine.name} size={18} />
                <span>{engine.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
