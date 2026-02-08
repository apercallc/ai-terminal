import { useState, useMemo } from "react";
import type { CustomTool } from "@/types";
import { getToolManager } from "@/lib/tools/manager";
import "./ToolsPanel.css";

interface ToolsPanelProps {
  onClose: () => void;
  onExecute: (command: string) => void;
}

export function ToolsPanel({ onClose, onExecute }: ToolsPanelProps) {
  const manager = useMemo(() => getToolManager(), []);
  const [tools, setTools] = useState(manager.getAll());
  const [search, setSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<CustomTool | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTool, setNewTool] = useState({
    name: "",
    description: "",
    command: "",
    category: "custom",
    variables: "",
  });

  const filtered = useMemo(() => {
    if (!search) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tools, search]);

  const handleSelectTool = (tool: CustomTool) => {
    setSelectedTool(tool);
    const defaults: Record<string, string> = {};
    tool.variables?.forEach((v) => {
      defaults[v.name] = v.defaultValue || "";
    });
    setVariableValues(defaults);
  };

  const handleExecute = () => {
    if (!selectedTool) return;
    const resolved = manager.resolveCommand(selectedTool, variableValues);
    if (resolved) {
      onExecute(resolved);
      onClose();
    }
  };

  const handleAdd = () => {
    if (!newTool.name.trim() || !newTool.command.trim()) return;
    const variables = newTool.variables
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((name) => ({ name, label: name, type: "text" as const, defaultValue: "" }));

    manager.add({
      name: newTool.name.trim(),
      description: newTool.description.trim(),
      command: newTool.command.trim(),
      icon: "🔧",
      category: newTool.category,
      variables,
    });
    setTools(manager.getAll());
    setNewTool({ name: "", description: "", command: "", category: "custom", variables: "" });
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    manager.remove(id);
    setTools(manager.getAll());
    if (selectedTool?.id === id) setSelectedTool(null);
  };

  return (
    <div className="tools-overlay" onClick={onClose}>
      <div className="tools-panel" onClick={(e) => e.stopPropagation()}>
        <div className="tools-header">
          <h2>Tools</h2>
          <div className="tools-header-actions">
            <button className="text-btn" onClick={() => setShowAddForm(!showAddForm)}>
              + New Tool
            </button>
            <button className="settings-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
              </svg>
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="tool-add-form">
            <div className="settings-field">
              <label>Tool Name</label>
              <input type="text" value={newTool.name} onChange={(e) => setNewTool((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Port Check" />
            </div>
            <div className="settings-field">
              <label>Command (use {"{{var}}"} for variables)</label>
              <input type="text" value={newTool.command} onChange={(e) => setNewTool((p) => ({ ...p, command: e.target.value }))} placeholder="lsof -i :{{port}}" />
            </div>
            <div className="settings-field">
              <label>Description</label>
              <input type="text" value={newTool.description} onChange={(e) => setNewTool((p) => ({ ...p, description: e.target.value }))} placeholder="What does this tool do?" />
            </div>
            <div className="settings-field">
              <label>Variables (comma-separated)</label>
              <input type="text" value={newTool.variables} onChange={(e) => setNewTool((p) => ({ ...p, variables: e.target.value }))} placeholder="port, host" />
            </div>
            <div className="tool-add-actions">
              <button className="settings-btn" onClick={handleAdd}>Create Tool</button>
              <button className="text-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="tools-content">
          <div className="tools-sidebar">
            <input type="text" className="tools-search" placeholder="Search tools..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="tools-list">
              {filtered.map((tool) => (
                <div
                  key={tool.id}
                  className={`tool-list-item ${selectedTool?.id === tool.id ? "active" : ""}`}
                  onClick={() => handleSelectTool(tool)}
                >
                  <span className="tool-list-name">{tool.name}</span>
                  <span className="tool-list-category">{tool.category}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="tools-detail">
            {selectedTool ? (
              <>
                <h3>{selectedTool.name}</h3>
                <p className="tool-detail-desc">{selectedTool.description}</p>
                <code className="tool-detail-cmd">{selectedTool.command}</code>

                {selectedTool.variables && selectedTool.variables.length > 0 && (
                  <div className="tool-variables">
                    <h4>Variables</h4>
                    {selectedTool.variables.map((v) => (
                      <div key={v.name} className="settings-field">
                        <label>{v.name}</label>
                        <input
                          type="text"
                          value={variableValues[v.name] || ""}
                          onChange={(e) => setVariableValues((p) => ({ ...p, [v.name]: e.target.value }))}
                          placeholder={v.label || v.name}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="tool-detail-actions">
                  <button className="settings-btn" onClick={handleExecute}>Run Tool</button>
                  <button className="text-btn danger" onClick={() => handleDelete(selectedTool.id)}>Delete</button>
                </div>
              </>
            ) : (
              <div className="tools-placeholder">Select a tool to view details and configure variables.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
