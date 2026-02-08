import { useState, useMemo } from "react";
import { getShortcutManager } from "@/lib/shortcuts/manager";
import "./ShortcutsPanel.css";

interface ShortcutsPanelProps {
  onClose: () => void;
}

export function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  const manager = useMemo(() => getShortcutManager(), []);
  const [shortcuts, setShortcuts] = useState(manager.getAll());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(shortcuts.map((s) => s.category));
    return Array.from(cats).sort();
  }, [shortcuts]);

  const filtered = useMemo(() => {
    let items = shortcuts;
    if (search) {
      items = items.filter(
        (s) =>
          s.label.toLowerCase().includes(search.toLowerCase()) ||
          s.action.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (selectedCategory) {
      items = items.filter((s) => s.category === selectedCategory);
    }
    return items;
  }, [shortcuts, search, selectedCategory]);

  const handleRecordKey = (shortcutId: string) => {
    setEditingId(shortcutId);
    setRecording(true);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Shift"
      ) {
        return;
      }

      const keys: string[] = [];
      if (e.metaKey) keys.push("Meta");
      if (e.ctrlKey) keys.push("Control");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      keys.push(e.key);

      manager.updateBinding(shortcutId, keys);
      setShortcuts(manager.getAll());
      setEditingId(null);
      setRecording(false);
      window.removeEventListener("keydown", handler, true);
    };

    window.addEventListener("keydown", handler, true);
  };

  const handleReset = () => {
    manager.resetAll();
    setShortcuts(manager.getAll());
  };

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <div className="shortcuts-header-actions">
            <button className="text-btn" onClick={handleReset}>
              Reset All
            </button>
            <button className="settings-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="shortcuts-toolbar">
          <input
            type="text"
            className="shortcuts-search"
            placeholder="Search shortcuts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="shortcuts-categories">
            <button
              className={`filter-btn ${!selectedCategory ? "active" : ""}`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`filter-btn ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="shortcuts-body">
          {filtered.map((shortcut) => (
            <div
              key={shortcut.id}
              className={`shortcut-item ${!shortcut.editable ? "disabled" : ""}`}
            >
              <div className="shortcut-info">
                <span className="shortcut-label">{shortcut.label}</span>
                <span className="shortcut-desc">{shortcut.action}</span>
              </div>

              <div className="shortcut-actions">
                {editingId === shortcut.id && recording ? (
                  <span className="shortcut-recording">Press keys…</span>
                ) : (
                  <button
                    className="shortcut-keybinding"
                    onClick={() => shortcut.editable && handleRecordKey(shortcut.id)}
                    title="Click to change shortcut"
                    disabled={!shortcut.editable}
                  >
                    {manager.formatKeys(shortcut.keys)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
