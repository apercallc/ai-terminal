import { describe, it, expect, beforeEach } from "vitest";
import { RecordingManager, RecordingPlayer } from "@/lib/recording/manager";

const META = { shell: "/bin/zsh", cols: 80, rows: 24, cwd: "/tmp" };

describe("RecordingManager", () => {
  let manager: RecordingManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new RecordingManager();
  });

  describe("start/stop", () => {
    it("starts recording", () => {
      manager.startRecording({ name: "Test Recording", ...META });
      expect(manager.isRecording()).toBe(true);
    });

    it("stops recording", () => {
      manager.startRecording({ name: "Test Recording", ...META });
      manager.stopRecording();
      expect(manager.isRecording()).toBe(false);
    });

    it("saves recording on stop", () => {
      manager.startRecording({ name: "Test Recording", ...META });
      manager.stopRecording();
      const recordings = manager.getAll();
      expect(recordings.length).toBe(1);
      expect(recordings[0].name).toBe("Test Recording");
    });
  });

  describe("recordOutput/recordInput", () => {
    it("adds events while recording", () => {
      manager.startRecording({ name: "Test", ...META });
      manager.recordOutput("hello");
      manager.recordInput("ls");
      manager.stopRecording();
      const recordings = manager.getAll();
      // getAll() returns events: [] for performance, use getById
      const full = manager.getById(recordings[0].id);
      expect(full!.events.length).toBe(2);
    });

    it("ignores events when not recording", () => {
      manager.recordOutput("hello");
      expect(manager.getAll()).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("deletes a recording", () => {
      manager.startRecording({ name: "To Delete", ...META });
      manager.stopRecording();
      const id = manager.getAll()[0].id;
      manager.delete(id);
      expect(manager.getAll()).toHaveLength(0);
    });
  });

  describe("export/import", () => {
    it("exports a recording as JSON", () => {
      manager.startRecording({ name: "Export Test", ...META });
      manager.recordOutput("test");
      manager.stopRecording();
      const id = manager.getAll()[0].id;
      const exported = manager.export(id);
      expect(exported).toBeTruthy();
      expect(() => JSON.parse(exported!)).not.toThrow();
    });

    it("imports a recording from JSON", () => {
      manager.startRecording({ name: "Import Source", ...META });
      manager.stopRecording();
      const exported = manager.export(manager.getAll()[0].id)!;
      const beforeCount = manager.getAll().length;
      manager.import(exported);
      expect(manager.getAll().length).toBe(beforeCount + 1);
    });
  });
});

describe("RecordingPlayer", () => {
  it("initializes with recording", () => {
    const recording = {
      id: "test-rec",
      name: "Test",
      startTime: Date.now(),
      endTime: Date.now() + 5000,
      events: [{ type: "output" as const, data: "hello", timestamp: Date.now() }],
      metadata: { shell: "zsh", cols: 80, rows: 24, cwd: "~" },
    };
    const player = new RecordingPlayer(recording);
    expect(player).toBeDefined();
  });

  it("supports speed changes", () => {
    const recording = {
      id: "test-rec",
      name: "Test",
      startTime: Date.now(),
      endTime: Date.now() + 5000,
      events: [],
      metadata: { shell: "zsh", cols: 80, rows: 24, cwd: "~" },
    };
    const player = new RecordingPlayer(recording);
    player.setSpeed(2);
    // No error means success
  });
});
