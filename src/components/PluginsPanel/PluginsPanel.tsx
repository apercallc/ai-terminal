import { useState, useMemo, useCallback } from "react";
import type { PluginManifest } from "@/types";
import { getPluginManager } from "@/lib/plugins/manager";
import "./PluginsPanel.css";

interface PluginsPanelProps {
  onClose: () => void;
}

export function PluginsPanel({ onClose }: PluginsPanelProps) {
  const manager = useMemo(() => getPluginManager(), []);
  const [plugins, setPlugins] = useState(manager.getAll());
  const [showInstall, setShowInstall] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setPlugins(manager.getAll());
  }, [manager]);

  const handleToggle = (id: string, enabled: boolean) => {
    manager.setEnabled(id, enabled);
    refresh();
  };

  const handleUninstall = (id: string) => {
    manager.unregister(id);
    refresh();
  };

  const handleInstall = () => {
    setError(null);
    try {
      const manifest: PluginManifest = JSON.parse(jsonInput);
      if (!manifest.id || !manifest.name || !manifest.version) {
        setError("Plugin must have id, name, and version fields.");
        return;
      }
      manager.register(manifest, {});
      refresh();
      setShowInstall(false);
      setJsonInput("");
    } catch {
      setError("Invalid JSON. Please check the plugin manifest.");
    }
  };

  return (
    <div className="plugins-overlay" onClick={onClose}>
      <div className="plugins-panel" onClick={(e) => e.stopPropagation()}>
        <div className="plugins-header">
          <h2>Plugins</h2>
          <div className="plugins-header-actions">
            <button
              className="text-btn"
              onClick={() => setShowInstall(!showInstall)}
            >
              + Install
            </button>
            <button className="settings-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
              </svg>
            </button>
          </div>
        </div>

        {showInstall && (
          <div className="plugin-install-form">
            <label>Plugin Manifest (JSON)</label>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"id": "my-plugin", "name": "My Plugin", "version": "1.0.0", "hooks": [...]}'
              rows={6}
            />
            {error && <p className="plugin-error">{error}</p>}
            <div className="plugin-install-actions">
              <button className="settings-btn" onClick={handleInstall}>
                Install
              </button>
              <button
                className="text-btn"
                onClick={() => {
                  setShowInstall(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="plugins-body">
          {plugins.length === 0 ? (
            <div className="plugins-empty">
              No plugins installed. Install one to extend functionality.
            </div>
          ) : (
            <div className="plugins-list">
              {plugins.map((plugin: PluginManifest) => (
                <PluginItem
                  key={plugin.id}
                  plugin={plugin}
                  onToggle={(enabled) => handleToggle(plugin.id, enabled)}
                  onUninstall={() => handleUninstall(plugin.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PluginItem({
  plugin,
  onToggle,
  onUninstall,
}: {
  plugin: PluginManifest;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
}) {
  return (
    <div className={`plugin-item ${!plugin.enabled ? "disabled" : ""}`}>
      <div className="plugin-info">
        <div className="plugin-header">
          <span className="plugin-name">{plugin.name}</span>
          <span className="plugin-version">v{plugin.version}</span>
        </div>
        {plugin.description && (
          <p className="plugin-desc">{plugin.description}</p>
        )}
        {plugin.hooks && plugin.hooks.length > 0 && (
          <div className="plugin-hooks">
            {plugin.hooks.map((h, i) => (
              <span key={i} className="plugin-hook-badge">
                {h.type}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="plugin-actions">
        <label className="shortcut-toggle">
          <input
            type="checkbox"
            checked={plugin.enabled !== false}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
        {(
          <button className="plugin-uninstall" onClick={onUninstall}>
            Uninstall
          </button>
        )}
      </div>
    </div>
  );
}
