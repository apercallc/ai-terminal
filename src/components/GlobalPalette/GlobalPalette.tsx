import { useState, useEffect, useRef, useCallback } from "react";
import "./GlobalPalette.css";

interface PaletteAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

interface GlobalPaletteProps {
  onClose: () => void;
  actions: PaletteAction[];
}

export type { PaletteAction };

export function GlobalPalette({ onClose, actions }: GlobalPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : actions;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeAction = useCallback(
    (action: PaletteAction) => {
      onClose();
      action.action();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            executeAction(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, executeAction, onClose],
  );

  return (
    <div className="global-palette-overlay" onClick={onClose}>
      <div
        className="global-palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="global-palette-input-wrapper">
          <input
            ref={inputRef}
            className="global-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            aria-label="Search commands"
          />
        </div>
        <div className="global-palette-list" role="listbox">
          {filtered.length === 0 && (
            <div className="global-palette-empty">No matching commands</div>
          )}
          {filtered.map((action, index) => (
            <div
              key={action.id}
              className={`global-palette-item ${index === selectedIndex ? "selected" : ""}`}
              onClick={() => executeAction(action)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className="global-palette-item-icon">{action.icon}</span>
              <span className="global-palette-item-label">{action.label}</span>
              {action.shortcut && (
                <span className="global-palette-item-shortcut">{action.shortcut}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
