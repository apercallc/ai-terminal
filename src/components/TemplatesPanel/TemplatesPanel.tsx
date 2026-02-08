import { useState, useMemo } from "react";
import type { CommandTemplate } from "@/types";
import { getTemplateManager } from "@/lib/templates/manager";
import "./TemplatesPanel.css";

interface TemplatesPanelProps {
  onClose: () => void;
  onExecute: (steps: string[]) => void;
}

export function TemplatesPanel({ onClose, onExecute }: TemplatesPanelProps) {
  const manager = useMemo(() => getTemplateManager(), []);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<CommandTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const categories = useMemo(() => manager.getCategories(), [manager]);

  const templates = useMemo(() => {
    let items = search ? manager.search(search) : manager.getAll();
    if (selectedCategory) {
      items = items.filter((t) => t.category === selectedCategory);
    }
    return items;
  }, [manager, search, selectedCategory]);

  const handleSelectTemplate = (template: CommandTemplate) => {
    setActiveTemplate(template);
    const defaults: Record<string, string> = {};
    for (const v of template.variables) {
      defaults[v.name] = v.defaultValue;
    }
    setVariables(defaults);
  };

  const handleExecute = () => {
    if (!activeTemplate) return;
    const resolvedSteps = manager.resolveSteps(activeTemplate, variables);
    onExecute(resolvedSteps);
    onClose();
  };

  return (
    <div className="templates-overlay" onClick={onClose}>
      <div className="templates-panel" onClick={(e) => e.stopPropagation()}>
        <div className="templates-header">
          <h2>Command Templates</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
              />
            </svg>
          </button>
        </div>

        <div className="templates-toolbar">
          <input
            type="text"
            className="templates-search"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="templates-categories">
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

        <div className="templates-body">
          {activeTemplate ? (
            <TemplateDetail
              template={activeTemplate}
              variables={variables}
              onVariableChange={(name, value) =>
                setVariables((prev) => ({ ...prev, [name]: value }))
              }
              onExecute={handleExecute}
              onBack={() => setActiveTemplate(null)}
              resolvedSteps={manager.resolveSteps(activeTemplate, variables)}
            />
          ) : (
            <div className="templates-list">
              {templates.length === 0 ? (
                <div className="templates-empty">No templates found.</div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="template-card"
                    onClick={() => handleSelectTemplate(template)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleSelectTemplate(template)}
                  >
                    <div className="template-card-header">
                      <span className="template-name">{template.name}</span>
                      <span className="template-category">{template.category}</span>
                    </div>
                    <p className="template-desc">{template.description}</p>
                    <span className="template-steps-count">
                      {template.steps.length} step{template.steps.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateDetail({
  template,
  variables,
  onVariableChange,
  onExecute,
  onBack,
  resolvedSteps,
}: {
  template: CommandTemplate;
  variables: Record<string, string>;
  onVariableChange: (name: string, value: string) => void;
  onExecute: () => void;
  onBack: () => void;
  resolvedSteps: string[];
}) {
  return (
    <div className="template-detail">
      <button className="template-back" onClick={onBack}>
        ← Back to templates
      </button>

      <h3>{template.name}</h3>
      <p className="template-desc">{template.description}</p>

      {template.variables.length > 0 && (
        <div className="template-variables">
          <h4>Variables</h4>
          {template.variables.map((v) => (
            <div key={v.name} className="settings-field">
              <label>{v.label}</label>
              <input
                type="text"
                value={variables[v.name] || ""}
                onChange={(e) => onVariableChange(v.name, e.target.value)}
                placeholder={v.placeholder}
              />
            </div>
          ))}
        </div>
      )}

      <div className="template-preview">
        <h4>Commands to Execute</h4>
        <div className="template-steps">
          {resolvedSteps.map((step, i) => (
            <div key={i} className="template-step">
              <span className="step-number">{i + 1}</span>
              <code>{step}</code>
            </div>
          ))}
        </div>
      </div>

      <button className="settings-btn template-execute-btn" onClick={onExecute}>
        Execute Template
      </button>
    </div>
  );
}
