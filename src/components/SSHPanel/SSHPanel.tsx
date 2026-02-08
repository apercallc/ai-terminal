import { useState, useMemo } from "react";
import type { SSHConnection } from "@/types";
import { getSSHManager } from "@/lib/ssh/manager";
import "./SSHPanel.css";

interface SSHPanelProps {
  onClose: () => void;
  onConnect: (command: string) => void;
}

export function SSHPanel({ onClose, onConnect }: SSHPanelProps) {
  const manager = useMemo(() => getSSHManager(), []);
  const [connections, setConnections] = useState(manager.getAll());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SSHConnection>>({
    name: "",
    host: "",
    port: 22,
    username: "",
    authMethod: "key",
    privateKeyPath: "",
  });

  const handleSave = () => {
    if (!form.name?.trim() || !form.host?.trim() || !form.username?.trim()) return;

    if (editingId) {
      manager.update(editingId, form);
    } else {
      manager.add({
        name: form.name!.trim(),
        host: form.host!.trim(),
        port: form.port || 22,
        username: form.username!.trim(),
        authMethod: form.authMethod || "key",
        privateKeyPath: form.privateKeyPath?.trim(),
      });
    }

    setConnections(manager.getAll());
    resetForm();
  };

  const resetForm = () => {
    setForm({
      name: "",
      host: "",
      port: 22,
      username: "",
      authMethod: "key",
      privateKeyPath: "",
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (conn: SSHConnection) => {
    setForm({
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authMethod: conn.authMethod,
      privateKeyPath: conn.privateKeyPath,
    });
    setEditingId(conn.id);
    setShowAddForm(true);
  };

  const handleDelete = (id: string) => {
    manager.remove(id);
    setConnections(manager.getAll());
  };

  const handleConnect = (conn: SSHConnection) => {
    const cmd = manager.buildConnectCommand(conn);
    if (cmd) {
      onConnect(cmd);
      onClose();
    }
  };

  const handleExport = () => {
    const data = manager.export();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ssh-connections-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        manager.import(reader.result as string);
        setConnections(manager.getAll());
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="ssh-overlay" onClick={onClose}>
      <div className="ssh-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ssh-header">
          <h2>SSH Connections</h2>
          <div className="ssh-header-actions">
            <button className="text-btn" onClick={() => setShowAddForm(!showAddForm)}>
              + Add
            </button>
            <button className="text-btn" onClick={handleImport}>
              Import
            </button>
            <button className="text-btn" onClick={handleExport}>
              Export
            </button>
            <button className="settings-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
                />
              </svg>
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="ssh-add-form">
            <div className="ssh-form-grid">
              <div className="settings-field">
                <label>Name</label>
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Production Server"
                />
              </div>
              <div className="settings-field">
                <label>Host</label>
                <input
                  type="text"
                  value={form.host || ""}
                  onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                  placeholder="e.g. 192.168.1.100"
                />
              </div>
              <div className="settings-field">
                <label>Port</label>
                <input
                  type="number"
                  value={form.port || 22}
                  onChange={(e) => setForm((p) => ({ ...p, port: parseInt(e.target.value) || 22 }))}
                />
              </div>
              <div className="settings-field">
                <label>Username</label>
                <input
                  type="text"
                  value={form.username || ""}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. root"
                />
              </div>
              <div className="settings-field full-width">
                <label>Private Key Path (optional)</label>
                <input
                  type="text"
                  value={form.privateKeyPath || ""}
                  onChange={(e) => setForm((p) => ({ ...p, privateKeyPath: e.target.value }))}
                  placeholder="e.g. ~/.ssh/id_rsa"
                />
              </div>
              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={form.authMethod === "key"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, authMethod: e.target.checked ? "key" : "password" }))
                  }
                />
                <span>Use SSH Key Authentication</span>
              </label>
            </div>
            <div className="ssh-form-actions">
              <button className="settings-btn" onClick={handleSave}>
                {editingId ? "Update" : "Save Connection"}
              </button>
              <button className="text-btn" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="ssh-body">
          {connections.length === 0 ? (
            <div className="ssh-empty">No SSH connections saved. Add one to get started.</div>
          ) : (
            <div className="ssh-list">
              {connections.map((conn) => (
                <div key={conn.id} className="ssh-item">
                  <div className="ssh-info">
                    <div className="ssh-item-header">
                      <span className="ssh-name">{conn.name}</span>
                      {conn.lastConnected && (
                        <span className="ssh-last-connected">
                          Last: {new Date(conn.lastConnected).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <code className="ssh-connection-string">
                      {conn.username}@{conn.host}
                      {conn.port !== 22 ? `:${conn.port}` : ""}
                    </code>
                  </div>
                  <div className="ssh-actions">
                    <button
                      className="ssh-connect-btn"
                      onClick={() => handleConnect(conn)}
                      title="Connect"
                    >
                      ▶ Connect
                    </button>
                    <button className="rec-btn" onClick={() => handleEdit(conn)} title="Edit">
                      ✎
                    </button>
                    <button
                      className="rec-btn delete"
                      onClick={() => handleDelete(conn.id)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
