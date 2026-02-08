import { describe, it, expect, beforeEach, vi } from "vitest";
import { VoiceInputManager } from "@/lib/voice/manager";

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

// Set up global SpeechRecognition mock before class instantiation
Object.defineProperty(window, "webkitSpeechRecognition", {
  value: MockSpeechRecognition,
  writable: true,
  configurable: true,
});

describe("VoiceInputManager", () => {
  let manager: VoiceInputManager;

  beforeEach(() => {
    manager = new VoiceInputManager();
  });

  describe("support detection", () => {
    it("detects browser support", () => {
      expect(manager.supported).toBe(true);
    });

    it("returns support status in state", () => {
      const state = manager.getState();
      expect(state.isSupported).toBe(true);
    });
  });

  describe("state management", () => {
    it("has correct initial state", () => {
      const state = manager.getState();
      expect(state.isListening).toBe(false);
      expect(state.transcript).toBe("");
      expect(state.confidence).toBe(0);
      expect(state.error).toBeNull();
    });

    it("updates state on start", () => {
      manager.start();
      const state = manager.getState();
      expect(state.isListening).toBe(true);
    });

    it("updates state on stop", () => {
      manager.start();
      manager.stop();
      const state = manager.getState();
      expect(state.isListening).toBe(false);
    });
  });

  describe("toggle", () => {
    it("toggles listening on", () => {
      manager.toggle();
      expect(manager.getState().isListening).toBe(true);
    });

    it("toggles listening off", () => {
      manager.start();
      manager.toggle();
      expect(manager.getState().isListening).toBe(false);
    });
  });

  describe("subscribe", () => {
    it("notifies subscribers on state changes", () => {
      const handler = vi.fn();
      manager.subscribe(handler);
      manager.start();
      expect(handler).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ isListening: true }),
      );
    });

    it("returns an unsubscribe function", () => {
      const handler = vi.fn();
      const unsub = manager.subscribe(handler);
      unsub();
      manager.start();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("cleans up resources", () => {
      const handler = vi.fn();
      manager.subscribe(handler);
      manager.start();
      handler.mockClear();
      manager.destroy();
      // After destroy, no more notifications
      expect(manager.getState().isListening).toBe(false);
    });
  });
});
