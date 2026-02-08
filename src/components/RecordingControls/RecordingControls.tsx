import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { TerminalRecording } from "@/types";
import { getRecordingManager, type RecordingPlayer } from "@/lib/recording/manager";
import "./RecordingControls.css";

interface RecordingControlsProps {
  onClose: () => void;
  terminalWrite: (data: string) => void;
}

export function RecordingControls({ onClose, terminalWrite }: RecordingControlsProps) {
  const manager = useMemo(() => getRecordingManager(), []);
  const [recordings, setRecordings] = useState(manager.getAll());
  const [isRecording, setIsRecording] = useState(manager.isRecording());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playerRef = useRef<RecordingPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(() => {
    setRecordings(manager.getAll());
    setIsRecording(manager.isRecording());
  }, [manager]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.stop();
    };
  }, []);

  const handleStartRecording = () => {
    const name = `Recording ${recordings.length + 1}`;
    manager.startRecording({ name, shell: "zsh", cols: 80, rows: 24, cwd: "~" });
    refresh();
  };

  const handleStopRecording = () => {
    manager.stopRecording();
    refresh();
  };

  const handlePlay = (recording: TerminalRecording) => {
    playerRef.current?.stop();
    const player = manager.createPlayer(recording);
    playerRef.current = player;
    player.setSpeed(playbackSpeed);

    player.setOutputHandler((data: string) => {
      terminalWrite(data);
    });

    player.setCompleteHandler(() => {
      setPlayingId(null);
      setPlaybackProgress(100);
      if (intervalRef.current) clearInterval(intervalRef.current);
    });

    setPlayingId(recording.id);
    setPlaybackProgress(0);
    player.play();

    intervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const duration = recording.endTime! - recording.startTime;
        const elapsed = Date.now() - recording.startTime;
        setPlaybackProgress(Math.min(100, (elapsed / duration) * 100));
      }
    }, 100);
  };

  const handleStop = () => {
    playerRef.current?.stop();
    setPlayingId(null);
    setPlaybackProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleDelete = (id: string) => {
    if (playingId === id) handleStop();
    manager.delete(id);
    refresh();
  };

  const handleExport = (recording: TerminalRecording) => {
    const data = manager.export(recording.id);
    if (!data) return;
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recording.name.replace(/\s+/g, "-")}.json`;
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
        const data = reader.result as string;
        manager.import(data);
        refresh();
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="recording-overlay" onClick={onClose}>
      <div className="recording-panel" onClick={(e) => e.stopPropagation()}>
        <div className="recording-header">
          <h2>Terminal Recording</h2>
          <div className="recording-header-actions">
            <button className="text-btn" onClick={handleImport}>
              Import
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

        <div className="recording-controls-bar">
          {isRecording ? (
            <button className="recording-stop-btn" onClick={handleStopRecording}>
              <span className="recording-dot" />
              Stop Recording
            </button>
          ) : (
            <button className="recording-start-btn" onClick={handleStartRecording}>
              ⏺ Start Recording
            </button>
          )}

          <div className="recording-speed">
            <label>Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => {
                const speed = parseFloat(e.target.value);
                setPlaybackSpeed(speed);
                playerRef.current?.setSpeed(speed);
              }}
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
              <option value="8">8x</option>
              <option value="16">16x</option>
            </select>
          </div>
        </div>

        <div className="recording-body">
          {recordings.length === 0 ? (
            <div className="recording-empty">
              No recordings yet. Click &ldquo;Start Recording&rdquo; to begin.
            </div>
          ) : (
            <div className="recording-list">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className={`recording-item ${playingId === rec.id ? "playing" : ""}`}
                >
                  <div className="recording-info">
                    <span className="recording-name">{rec.name}</span>
                    <span className="recording-meta">
                      {new Date(rec.startTime).toLocaleDateString()} · {rec.events.length} events
                      {rec.endTime && <> · {((rec.endTime - rec.startTime) / 1000).toFixed(1)}s</>}
                    </span>
                    {playingId === rec.id && (
                      <div className="recording-progress">
                        <div
                          className="recording-progress-bar"
                          style={{ width: `${playbackProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="recording-actions">
                    {playingId === rec.id ? (
                      <>
                        <button className="rec-btn" onClick={handlePause} title="Pause">
                          ⏸
                        </button>
                        <button className="rec-btn" onClick={handleStop} title="Stop">
                          ⏹
                        </button>
                      </>
                    ) : (
                      <button className="rec-btn play" onClick={() => handlePlay(rec)} title="Play">
                        ▶
                      </button>
                    )}
                    <button className="rec-btn" onClick={() => handleExport(rec)} title="Export">
                      ↓
                    </button>
                    <button
                      className="rec-btn delete"
                      onClick={() => handleDelete(rec.id)}
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
