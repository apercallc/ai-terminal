import { useState, useCallback, useRef, useMemo } from "react";
import type { AgentState, CommandSuggestion, DirectoryEntry } from "@/types";
import { getSuggestionEngine } from "@/lib/suggestions/engine";
import { CommandPalette } from "@/components/CommandPalette/CommandPalette";
import { VoiceButton } from "@/components/VoiceButton/VoiceButton";
import "./GoalInput.css";

interface GoalInputProps {
  onSubmit: (goal: string) => void;
  onCancel: () => void;
  agentState: AgentState;
  disabled: boolean;
  ptySessionId?: string | null;
}

export function GoalInput({ onSubmit, onCancel, agentState, disabled, ptySessionId: _ptySessionId }: GoalInputProps) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathRequestRef = useRef(0); // track stale async requests
  const engine = useMemo(() => getSuggestionEngine(), []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      engine.recordCommand(trimmed);
      onSubmit(trimmed);
      setValue("");
      setShowSuggestions(false);
    },
    [value, disabled, onSubmit, engine],
  );

  const fetchPathSuggestions = useCallback(
    async (input: string) => {
      const parsed = engine.parsePathInput(input);
      if (!parsed) return null;

      const requestId = ++pathRequestRef.current;

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke("list_directory", { path: parsed.dirToList }) as {
          entries: DirectoryEntry[];
          path: string;
        };

        // Check if this request is still current
        if (pathRequestRef.current !== requestId) return null;

        const pathSuggestions = engine.buildPathSuggestions(
          result.entries,
          parsed.baseCommand,
          parsed.dirToList === "." ? "" : parsed.dirToList,
          parsed.prefix,
          parsed.prefix.startsWith("."),
          12,
        );
        return pathSuggestions;
      } catch {
        // Tauri not available (tests) or directory read failed
        return null;
      }
    },
    [engine],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      if (newValue.trim().length < 1) {
        setShowSuggestions(false);
        return;
      }

      // Check if this is a path-aware command
      const parsed = engine.parsePathInput(newValue);
      if (parsed) {
        // Async path completion
        fetchPathSuggestions(newValue).then((pathResults) => {
          if (pathResults && pathResults.length > 0) {
            setSuggestions(pathResults);
            setShowSuggestions(true);
          } else {
            // Fall back to regular suggestions
            const results = engine.getSuggestions(newValue.trim(), 8);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
          }
        });
      } else {
        // Regular command suggestions
        const results = engine.getSuggestions(newValue.trim(), 8);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      }
    },
    [engine, fetchPathSuggestions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else if (agentState !== "idle") {
          onCancel();
        } else {
          setValue("");
        }
      }
    },
    [agentState, onCancel, showSuggestions],
  );

  const handleSelectSuggestion = useCallback((suggestion: CommandSuggestion) => {
    setValue(suggestion.command);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setValue((prev) => (prev ? prev + " " + text : text));
    inputRef.current?.focus();
  }, []);

  const isWorking = ["planning", "executing", "analyzing", "retrying"].includes(agentState);

  const placeholder = (() => {
    switch (agentState) {
      case "planning": return "Generating plan...";
      case "executing": return "Executing commands...";
      case "analyzing": return "Analyzing output...";
      case "retrying": return "Retrying...";
      case "awaiting_approval": return "Waiting for approval...";
      default: return 'Enter a goal (e.g., "install node")';
    }
  })();

  return (
    <form className="goal-input-form" onSubmit={handleSubmit}>
      <div className="goal-input-wrapper">
        <span className="goal-input-icon">
          {isWorking ? (
            <span className="spinner" aria-label="Loading" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L3 5h3v6h4V5h3L8 1z"
                fill="currentColor"
                transform="rotate(90 8 8)"
              />
            </svg>
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          className="goal-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.trim().length >= 1 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled || isWorking}
          aria-label="Goal input"
          autoFocus
        />
        <VoiceButton onTranscript={handleVoiceTranscript} />
        {isWorking ? (
          <button
            type="button"
            className="goal-btn goal-btn-cancel"
            onClick={onCancel}
            aria-label="Cancel"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="goal-btn goal-btn-submit"
            disabled={!value.trim() || disabled}
            aria-label="Submit goal"
          >
            Run
          </button>
        )}
      </div>
      {showSuggestions && (
        <CommandPalette
          suggestions={suggestions}
          onSelect={handleSelectSuggestion}
          onClose={() => setShowSuggestions(false)}
        />
      )}
    </form>
  );
}
