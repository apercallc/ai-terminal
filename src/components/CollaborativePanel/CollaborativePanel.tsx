import { useState, useMemo, useEffect } from "react";
import type { CollaborativeSession, CollaborativeMessage } from "@/types";
import { getCollaborativeManager } from "@/lib/collaboration/manager";
import "./CollaborativePanel.css";

interface CollaborativePanelProps {
  onClose: () => void;
  onExecute: (command: string) => void;
}

export function CollaborativePanel({ onClose, onExecute }: CollaborativePanelProps) {
  const manager = useMemo(() => getCollaborativeManager(), []);
  const [session, setSession] = useState<CollaborativeSession | null>(manager.getSession());
  const [joinToken, setJoinToken] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const interval = setInterval(() => {
      const next = manager.getSession();
      setSession((prev) => {
        // Only update if the session data actually changed
        if (!next && !prev) return prev;
        if (!next || !prev) return next ? { ...next } : null;
        if (next.participants.length === prev.participants.length && next.isHost === prev.isHost) {
          return prev;
        }
        return { ...next };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [manager]);

  const handleCreate = () => {
    manager.setName(userName);
    manager.createSession();
    setSession(manager.getSession());
  };

  const handleJoin = () => {
    if (!joinToken.trim()) return;
    manager.setName(userName);
    manager.joinSession(joinToken.trim());
    setSession(manager.getSession());
    setJoinToken("");
  };

  const handleLeave = () => {
    manager.leaveSession();
    setSession(null);
  };

  const handleChat = () => {
    if (!chatInput.trim() || !session) return;
    manager.sendMessage(chatInput.trim());
    setChatInput("");
    setSession({ ...manager.getSession()! });
  };

  const handleShareCommand = (cmd: string) => {
    manager.shareCommand(cmd);
    setSession({ ...manager.getSession()! });
  };

  const shareToken = session ? manager.getShareToken() : null;

  return (
    <div className="collab-overlay" onClick={onClose}>
      <div className="collab-panel" onClick={(e) => e.stopPropagation()}>
        <div className="collab-header">
          <h2>Collaborative Session</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
              />
            </svg>
          </button>
        </div>

        {!session ? (
          <div className="collab-setup">
            <div className="settings-field">
              <label>Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="collab-actions-section">
              <h3>Create New Session</h3>
              <button className="settings-btn" onClick={handleCreate}>
                Create Session
              </button>
            </div>

            <div className="collab-divider">
              <span>or</span>
            </div>

            <div className="collab-actions-section">
              <h3>Join Existing Session</h3>
              <div className="collab-join-row">
                <input
                  type="text"
                  value={joinToken}
                  onChange={(e) => setJoinToken(e.target.value)}
                  placeholder="Paste session token..."
                  className="collab-token-input"
                />
                <button className="settings-btn" onClick={handleJoin}>
                  Join
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="collab-active">
            <div className="collab-info-bar">
              <div className="collab-session-info">
                <span className="collab-status-dot" />
                <span>Session Active</span>
                <span className="collab-participant-count">
                  {session.participants.length} participant
                  {session.participants.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="collab-info-actions">
                {shareToken && (
                  <button
                    className="text-btn"
                    onClick={() => navigator.clipboard.writeText(shareToken)}
                    title="Copy session token"
                  >
                    Copy Token
                  </button>
                )}
                <button className="text-btn danger" onClick={handleLeave}>
                  Leave
                </button>
              </div>
            </div>

            <div className="collab-participants">
              {session.participants.map((p) => (
                <div key={p.id} className="collab-participant">
                  <span className="collab-avatar" style={{ background: stringToColor(p.name) }}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="collab-name">{p.name}</span>
                  <span className="collab-role">{p.role}</span>
                </div>
              ))}
            </div>

            <div className="collab-chat">
              <div className="collab-messages">
                {manager.getMessages().length === 0 ? (
                  <div className="collab-empty-chat">No messages yet. Start chatting!</div>
                ) : (
                  manager.getMessages().map((msg: CollaborativeMessage) => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      onExecute={() => {
                        if (msg.type === "command") {
                          onExecute(msg.content);
                          onClose();
                        }
                      }}
                    />
                  ))
                )}
              </div>
              <div className="collab-chat-input">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChat()}
                  placeholder="Type a message..."
                />
                <button
                  className="text-btn"
                  onClick={() => {
                    const cmd = prompt("Share a command:");
                    if (cmd) handleShareCommand(cmd);
                  }}
                >
                  Share Cmd
                </button>
                <button className="settings-btn" onClick={handleChat}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  onExecute,
}: {
  message: CollaborativeMessage;
  onExecute: () => void;
}) {
  return (
    <div className={`collab-message collab-message-${message.type}`}>
      <div className="collab-message-header">
        <span
          className="collab-avatar small"
          style={{ background: stringToColor(message.participantName) }}
        >
          {message.participantName.charAt(0).toUpperCase()}
        </span>
        <span className="collab-message-sender">{message.participantName}</span>
        <span className="collab-message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {message.type === "command" ? (
        <div className="collab-shared-command" onClick={onExecute}>
          <code>{message.content}</code>
          <span className="collab-run-hint">Click to run</span>
        </div>
      ) : (
        <p className="collab-message-text">{message.content}</p>
      )}
    </div>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 60%, 50%)`;
}
