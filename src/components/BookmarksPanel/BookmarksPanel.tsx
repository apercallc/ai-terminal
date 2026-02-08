import { useState, useMemo } from "react";
import type { CommandBookmark } from "@/types";
import { getBookmarkManager } from "@/lib/bookmarks/manager";
import "./BookmarksPanel.css";

interface BookmarksPanelProps {
  onClose: () => void;
  onExecute: (command: string) => void;
}

export function BookmarksPanel({ onClose, onExecute }: BookmarksPanelProps) {
  const manager = useMemo(() => getBookmarkManager(), []);
  const [bookmarks, setBookmarks] = useState(manager.getAll());
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({
    command: "",
    name: "",
    description: "",
    tags: "",
  });

  const tags = useMemo(() => manager.getTags(), [bookmarks]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let items = bookmarks;
    if (search) {
      items = items.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.command.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (selectedTag) {
      items = items.filter((b) => b.tags.includes(selectedTag));
    }
    return items;
  }, [bookmarks, search, selectedTag]);

  const handleAdd = () => {
    if (!newBookmark.command.trim() || !newBookmark.name.trim()) return;
    manager.add({
      command: newBookmark.command.trim(),
      name: newBookmark.name.trim(),
      description: newBookmark.description.trim(),
      tags: newBookmark.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setBookmarks(manager.getAll());
    setNewBookmark({ command: "", name: "", description: "", tags: "" });
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    manager.remove(id);
    setBookmarks(manager.getAll());
  };

  const handleExport = () => {
    const data = manager.export();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bookmarks-overlay" onClick={onClose}>
      <div className="bookmarks-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bookmarks-header">
          <h2>Bookmarks</h2>
          <div className="bookmarks-header-actions">
            <button
              className="text-btn"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              + Add
            </button>
            <button className="text-btn" onClick={handleExport}>
              Export
            </button>
            <button className="settings-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
              </svg>
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="bookmark-add-form">
            <div className="settings-field">
              <label>Name</label>
              <input
                type="text"
                value={newBookmark.name}
                onChange={(e) => setNewBookmark((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Start Dev Server"
              />
            </div>
            <div className="settings-field">
              <label>Command</label>
              <input
                type="text"
                value={newBookmark.command}
                onChange={(e) => setNewBookmark((p) => ({ ...p, command: e.target.value }))}
                placeholder="e.g. npm run dev"
              />
            </div>
            <div className="settings-field">
              <label>Description (optional)</label>
              <input
                type="text"
                value={newBookmark.description}
                onChange={(e) => setNewBookmark((p) => ({ ...p, description: e.target.value }))}
                placeholder="What does this command do?"
              />
            </div>
            <div className="settings-field">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={newBookmark.tags}
                onChange={(e) => setNewBookmark((p) => ({ ...p, tags: e.target.value }))}
                placeholder="dev, server, node"
              />
            </div>
            <div className="bookmark-add-actions">
              <button className="settings-btn" onClick={handleAdd}>
                Save Bookmark
              </button>
              <button className="text-btn" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bookmarks-toolbar">
          <input
            type="text"
            className="bookmarks-search"
            placeholder="Search bookmarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tags.length > 0 && (
            <div className="bookmarks-tags">
              <button
                className={`filter-btn ${!selectedTag ? "active" : ""}`}
                onClick={() => setSelectedTag(null)}
              >
                All
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={`filter-btn ${selectedTag === tag ? "active" : ""}`}
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bookmarks-body">
          {filtered.length === 0 ? (
            <div className="bookmarks-empty">
              {bookmarks.length === 0
                ? "No bookmarks yet. Add your first bookmark!"
                : "No bookmarks match your search."}
            </div>
          ) : (
            <div className="bookmarks-list">
              {filtered.map((bookmark) => (
                <BookmarkItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  onExecute={() => {
                    onExecute(bookmark.command);
                    onClose();
                  }}
                  onDelete={() => handleDelete(bookmark.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookmarkItem({
  bookmark,
  onExecute,
  onDelete,
}: {
  bookmark: CommandBookmark;
  onExecute: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bookmark-item">
      <div className="bookmark-info">
        <div className="bookmark-header">
          <span className="bookmark-name">{bookmark.name}</span>
          {bookmark.tags.map((tag) => (
            <span key={tag} className="bookmark-tag">{tag}</span>
          ))}
        </div>
        <code className="bookmark-command">{bookmark.command}</code>
        {bookmark.description && (
          <p className="bookmark-desc">{bookmark.description}</p>
        )}
      </div>
      <div className="bookmark-actions">
        <button className="bookmark-run" onClick={onExecute} title="Execute command">
          ▶
        </button>
        <button className="bookmark-delete" onClick={onDelete} title="Delete bookmark">
          ×
        </button>
      </div>
    </div>
  );
}
