import { useState, useCallback } from "react";
import { getVoiceInputManager } from "@/lib/voice/manager";
import "./VoiceButton.css";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
}

export function VoiceButton({ onTranscript }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(() => {
    const manager = getVoiceInputManager();

    if (listening) {
      manager.stop();
      setListening(false);
      setInterim("");
      return;
    }

    if (!manager.supported) {
      setError("Voice input not supported in this browser");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    const unsubscribe = manager.subscribe((state) => {
      if (state.transcript) {
        onTranscript(state.transcript);
        setListening(false);
        setInterim("");
        unsubscribe();
      } else if (state.error) {
        setError(state.error);
        setListening(false);
        setInterim("");
        setTimeout(() => setError(null), 3000);
        unsubscribe();
      } else if (!state.isListening) {
        setListening(false);
        setInterim("");
        unsubscribe();
      }
    });
    manager.start();
    setListening(true);
  }, [listening, onTranscript]);

  return (
    <div className="voice-button-wrapper">
      <button
        className={`voice-button ${listening ? "active" : ""}`}
        onClick={handleToggle}
        title={listening ? "Stop listening" : "Voice input"}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a2.5 2.5 0 00-2.5 2.5v4a2.5 2.5 0 005 0v-4A2.5 2.5 0 008 1z" />
          <path d="M3.5 7.5a.5.5 0 011 0 3.5 3.5 0 007 0 .5.5 0 011 0 4.5 4.5 0 01-4 4.473V14h2a.5.5 0 010 1h-5a.5.5 0 010-1h2v-2.027A4.5 4.5 0 013.5 7.5z" />
        </svg>
        {listening && <span className="voice-pulse" />}
      </button>

      {interim && <div className="voice-interim">{interim}</div>}

      {error && <div className="voice-error">{error}</div>}
    </div>
  );
}
