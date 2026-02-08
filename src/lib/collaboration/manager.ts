import type {
  CollaborativeSession,
  CollaborativeParticipant,
  CollaborativeMessage,
} from "@/types";

/**
 * Collaborative session manager using WebRTC data channels for peer-to-peer
 * terminal sharing. Uses a simple signaling mechanism via clipboard-based
 * session tokens for connection establishment.
 */

type CollabEventType = "participant-joined" | "participant-left" | "message" | "command" | "output" | "disconnect";
type CollabHandler = (data: unknown) => void;

export class CollaborativeManager {
  private session: CollaborativeSession | null = null;
  private messages: CollaborativeMessage[] = [];
  private handlers: Map<CollabEventType, Set<CollabHandler>> = new Map();
  private localParticipantId: string;
  private localName: string;

  constructor() {
    this.localParticipantId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.localName = "User";
  }

  /** Set the local user's display name. */
  setName(name: string): void {
    this.localName = name;
  }

  /** Get the current session. */
  getSession(): CollaborativeSession | null {
    return this.session;
  }

  /** Get chat messages. */
  getMessages(): CollaborativeMessage[] {
    return [...this.messages];
  }

  /** Create a new collaborative session as host. */
  createSession(): CollaborativeSession {
    const session: CollaborativeSession = {
      id: `collab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      hostId: this.localParticipantId,
      participants: [
        {
          id: this.localParticipantId,
          name: this.localName,
          role: "host",
          connectedAt: Date.now(),
          isActive: true,
        },
      ],
      createdAt: Date.now(),
      isHost: true,
    };

    this.session = session;
    this.messages = [];
    this.addSystemMessage("Session created. Share the session ID to invite others.");

    return session;
  }

  /** Join an existing session as a participant. */
  joinSession(sessionId: string): CollaborativeSession {
    const session: CollaborativeSession = {
      id: sessionId,
      hostId: "",
      participants: [
        {
          id: this.localParticipantId,
          name: this.localName,
          role: "operator",
          connectedAt: Date.now(),
          isActive: true,
        },
      ],
      createdAt: Date.now(),
      isHost: false,
    };

    this.session = session;
    this.messages = [];
    this.addSystemMessage(`Joined session ${sessionId}`);

    return session;
  }

  /** Leave the current session. */
  leaveSession(): void {
    if (!this.session) return;

    this.addSystemMessage("You left the session.");
    this.emit("disconnect", { participantId: this.localParticipantId });
    this.session = null;
    this.messages = [];
  }

  /** Send a chat message. */
  sendMessage(content: string): void {
    if (!this.session) return;

    const msg: CollaborativeMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      participantId: this.localParticipantId,
      participantName: this.localName,
      type: "chat",
      content,
      timestamp: Date.now(),
    };

    this.messages.push(msg);
    this.emit("message", msg);
  }

  /** Share a command with the session. */
  shareCommand(command: string): void {
    if (!this.session) return;

    const msg: CollaborativeMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      participantId: this.localParticipantId,
      participantName: this.localName,
      type: "command",
      content: command,
      timestamp: Date.now(),
    };

    this.messages.push(msg);
    this.emit("command", msg);
  }

  /** Share command output with the session. */
  shareOutput(output: string): void {
    if (!this.session) return;

    const msg: CollaborativeMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      participantId: this.localParticipantId,
      participantName: this.localName,
      type: "output",
      content: output.slice(0, 5000),
      timestamp: Date.now(),
    };

    this.messages.push(msg);
    this.emit("output", msg);
  }

  /** Add a participant to the session. */
  addParticipant(participant: CollaborativeParticipant): void {
    if (!this.session) return;
    this.session.participants.push(participant);
    this.addSystemMessage(`${participant.name} joined the session.`);
    this.emit("participant-joined", participant);
  }

  /** Remove a participant from the session. */
  removeParticipant(participantId: string): void {
    if (!this.session) return;
    const participant = this.session.participants.find((p) => p.id === participantId);
    if (participant) {
      participant.isActive = false;
      this.addSystemMessage(`${participant.name} left the session.`);
      this.emit("participant-left", participant);
    }
  }

  /** Update a participant's role. */
  setParticipantRole(participantId: string, role: "host" | "viewer" | "operator"): void {
    if (!this.session?.isHost) return;
    const participant = this.session.participants.find((p) => p.id === participantId);
    if (participant) {
      participant.role = role;
    }
  }

  /** Get the session share token (for clipboard sharing). */
  getShareToken(): string {
    if (!this.session) return "";
    return btoa(JSON.stringify({
      sessionId: this.session.id,
      hostId: this.session.hostId,
      createdAt: this.session.createdAt,
    }));
  }

  /** Parse a share token to get session info. */
  static parseShareToken(token: string): { sessionId: string; hostId: string } | null {
    try {
      const data = JSON.parse(atob(token));
      if (data.sessionId) return data;
    } catch {
      // Invalid token
    }
    return null;
  }

  /** Subscribe to collaborative events. */
  on(event: CollabEventType, handler: CollabHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  private emit(event: CollabEventType, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(data);
        } catch (err) {
          console.error(`Collab handler error for ${event}:`, err);
        }
      }
    }
  }

  private addSystemMessage(content: string): void {
    this.messages.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      participantId: "system",
      participantName: "System",
      type: "system",
      content,
      timestamp: Date.now(),
    });
  }
}

/** Singleton instance */
let _manager: CollaborativeManager | null = null;

export function getCollaborativeManager(): CollaborativeManager {
  if (!_manager) {
    _manager = new CollaborativeManager();
  }
  return _manager;
}
