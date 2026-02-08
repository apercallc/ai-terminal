import { describe, it, expect, beforeEach } from "vitest";
import { CollaborativeManager } from "@/lib/collaboration/manager";

describe("CollaborativeManager", () => {
  let manager: CollaborativeManager;

  beforeEach(() => {
    manager = new CollaborativeManager();
  });

  describe("createSession", () => {
    it("creates a new session", () => {
      manager.setName("Alice");
      manager.createSession();
      const session = manager.getSession();
      expect(session).not.toBeNull();
      expect(session!.participants.length).toBe(1);
      expect(session!.participants[0].name).toBe("Alice");
      expect(session!.participants[0].role).toBe("host");
    });
  });

  describe("getShareToken", () => {
    it("returns share token for active session", () => {
      manager.createSession();
      const token = manager.getShareToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("returns empty string when no session", () => {
      expect(manager.getShareToken()).toBe("");
    });
  });

  describe("joinSession", () => {
    it("joins with a session id", () => {
      manager.createSession();
      const session = manager.getSession()!;

      const manager2 = new CollaborativeManager();
      manager2.setName("Bob");
      manager2.joinSession(session.id);
      const joined = manager2.getSession();
      expect(joined).not.toBeNull();
    });
  });

  describe("sendMessage", () => {
    it("adds message to session", () => {
      manager.createSession();
      manager.sendMessage("Hello!");
      const messages = manager.getMessages();
      // First message is system "Session created" message, then our message
      const chatMessages = messages.filter((m) => m.type === "chat");
      expect(chatMessages.length).toBe(1);
      expect(chatMessages[0].content).toBe("Hello!");
    });
  });

  describe("shareCommand", () => {
    it("shares command as message", () => {
      manager.createSession();
      manager.shareCommand("ls -la");
      const messages = manager.getMessages();
      const cmdMessages = messages.filter((m) => m.type === "command");
      expect(cmdMessages.length).toBe(1);
      expect(cmdMessages[0].content).toBe("ls -la");
    });
  });

  describe("leaveSession", () => {
    it("clears session", () => {
      manager.createSession();
      manager.leaveSession();
      expect(manager.getSession()).toBeNull();
    });
  });
});
