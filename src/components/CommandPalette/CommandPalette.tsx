import { useState, useEffect } from "react";
import type { CommandSuggestion } from "@/types";
import "./CommandPalette.css";

interface CommandPaletteProps {
  suggestions: CommandSuggestion[];
  onSelect: (suggestion: CommandSuggestion) => void;
  onClose?: () => void;
}

export function CommandPalette({
  suggestions,
  onSelect,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <div className="command-palette">
      <div className="palette-list" role="listbox">
        {suggestions.map((suggestion, index) => (
          <PaletteItem
            key={suggestion.id}
            suggestion={suggestion}
            isSelected={index === selectedIndex}
            onSelect={() => onSelect(suggestion)}
            onHover={() => setSelectedIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}

function PaletteItem({
  suggestion,
  isSelected,
  onSelect,
  onHover,
}: {
  suggestion: CommandSuggestion;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <div
      className={`palette-item ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
      onMouseEnter={onHover}
      role="option"
      aria-selected={isSelected}
    >
      <span className="palette-icon">{getIcon(suggestion.icon)}</span>
      <div className="palette-item-main">
        <code className="palette-command">{suggestion.command}</code>
        {suggestion.frequency > 0 && (
          <span className="palette-freq" title={`Used ${suggestion.frequency} times`}>
            ×{suggestion.frequency}
          </span>
        )}
      </div>
      <span className="palette-desc">{suggestion.description}</span>
      <span className="palette-category">{suggestion.category}</span>
    </div>
  );
}

function getIcon(icon?: "folder" | "file" | "command"): string {
  switch (icon) {
    case "folder": return "📁";
    case "file": return "📄";
    case "command": return "›";
    default: return "›";
  }
}
