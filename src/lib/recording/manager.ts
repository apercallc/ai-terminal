import type { TerminalRecording, RecordingEvent } from "@/types";

const RECORDINGS_STORAGE_KEY = "ai_terminal_recordings";
const MAX_RECORDING_EVENTS = 50000;

/**
 * Terminal recording and playback manager.
 * Records terminal input/output events with timestamps for faithful replay.
 */
export class RecordingManager {
  private recordings: TerminalRecording[] = [];
  private activeRecording: TerminalRecording | null = null;
  private startTime = 0;

  constructor() {
    this.loadRecordings();
  }

  /** Check if currently recording. */
  isRecording(): boolean {
    return this.activeRecording !== null;
  }

  /** Get the active recording. */
  getActiveRecording(): TerminalRecording | null {
    return this.activeRecording;
  }

  /** Start a new recording. */
  startRecording(metadata: {
    name?: string;
    shell: string;
    cols: number;
    rows: number;
    cwd: string;
  }): TerminalRecording {
    if (this.activeRecording) {
      this.stopRecording();
    }

    this.startTime = Date.now();
    this.activeRecording = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: metadata.name || `Recording ${new Date().toLocaleString()}`,
      startTime: this.startTime,
      endTime: null,
      events: [],
      metadata: {
        shell: metadata.shell,
        cols: metadata.cols,
        rows: metadata.rows,
        cwd: metadata.cwd,
      },
    };

    return this.activeRecording;
  }

  /** Record an input event. */
  recordInput(data: string): void {
    if (!this.activeRecording) return;
    this.addEvent("input", data);
  }

  /** Record an output event. */
  recordOutput(data: string): void {
    if (!this.activeRecording) return;
    this.addEvent("output", data);
  }

  /** Record a resize event. */
  recordResize(cols: number, rows: number): void {
    if (!this.activeRecording) return;
    this.addEvent("resize", `${cols}x${rows}`);
  }

  /** Stop the current recording. */
  stopRecording(): TerminalRecording | null {
    if (!this.activeRecording) return null;

    this.activeRecording.endTime = Date.now();
    const recording = { ...this.activeRecording };

    this.recordings.unshift(recording);
    this.saveRecordings();
    this.activeRecording = null;

    return recording;
  }

  /** Get all saved recordings. */
  getAll(): TerminalRecording[] {
    return this.recordings.map((r) => ({
      ...r,
      events: [], // Don't return events in list view for performance
    }));
  }

  /** Get a recording with full events. */
  getById(id: string): TerminalRecording | undefined {
    return this.recordings.find((r) => r.id === id);
  }

  /** Delete a recording. */
  delete(id: string): boolean {
    const idx = this.recordings.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.recordings.splice(idx, 1);
    this.saveRecordings();
    return true;
  }

  /** Rename a recording. */
  rename(id: string, name: string): boolean {
    const recording = this.recordings.find((r) => r.id === id);
    if (!recording) return false;
    recording.name = name;
    this.saveRecordings();
    return true;
  }

  /** Get the duration of a recording in milliseconds. */
  getDuration(recording: TerminalRecording): number {
    if (recording.events.length === 0) return 0;
    if (recording.endTime) return recording.endTime - recording.startTime;
    const lastEvent = recording.events[recording.events.length - 1];
    return lastEvent.timestamp;
  }

  /** Format a duration in ms to a human-readable string. */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /** Create a playback controller for a recording. */
  createPlayer(recording: TerminalRecording): RecordingPlayer {
    return new RecordingPlayer(recording);
  }

  /** Export a recording as JSON. */
  export(id: string): string | null {
    const recording = this.recordings.find((r) => r.id === id);
    if (!recording) return null;
    return JSON.stringify(recording, null, 2);
  }

  /** Import a recording from JSON. */
  import(json: string): TerminalRecording | null {
    try {
      const recording: TerminalRecording = JSON.parse(json);
      if (!recording.id || !recording.events) return null;

      recording.id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.recordings.unshift(recording);
      this.saveRecordings();
      return recording;
    } catch {
      return null;
    }
  }

  private addEvent(type: RecordingEvent["type"], data: string): void {
    if (!this.activeRecording) return;
    if (this.activeRecording.events.length >= MAX_RECORDING_EVENTS) return;

    this.activeRecording.events.push({
      timestamp: Date.now() - this.startTime,
      type,
      data,
    });
  }

  private loadRecordings(): void {
    try {
      const stored = localStorage.getItem(RECORDINGS_STORAGE_KEY);
      if (stored) {
        this.recordings = JSON.parse(stored);
      }
    } catch {
      this.recordings = [];
    }
  }

  private saveRecordings(): void {
    try {
      localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(this.recordings));
    } catch {
      // Storage full — remove oldest recordings
      while (this.recordings.length > 5) {
        this.recordings.pop();
      }
      try {
        localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(this.recordings));
      } catch {
        // Give up
      }
    }
  }
}

/**
 * Playback controller for a terminal recording.
 */
export class RecordingPlayer {
  private recording: TerminalRecording;
  private currentIndex = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private speed = 1;
  private paused = false;
  private onOutput: ((data: string) => void) | null = null;
  private onComplete: (() => void) | null = null;
  private onProgress: ((progress: number) => void) | null = null;

  constructor(recording: TerminalRecording) {
    this.recording = recording;
  }

  /** Set output handler. */
  setOutputHandler(handler: (data: string) => void): void {
    this.onOutput = handler;
  }

  /** Set completion handler. */
  setCompleteHandler(handler: () => void): void {
    this.onComplete = handler;
  }

  /** Set progress handler (0-1). */
  setProgressHandler(handler: (progress: number) => void): void {
    this.onProgress = handler;
  }

  /** Set playback speed (1 = normal, 2 = 2x, etc). */
  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(16, speed));
  }

  /** Get current playback speed. */
  getSpeed(): number {
    return this.speed;
  }

  /** Start or resume playback. */
  play(): void {
    this.paused = false;
    this.scheduleNext();
  }

  /** Pause playback. */
  pause(): void {
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Stop playback and reset to start. */
  stop(): void {
    this.pause();
    this.currentIndex = 0;
  }

  /** Seek to a specific position (0-1). */
  seek(position: number): void {
    const targetIndex = Math.floor(position * this.recording.events.length);
    this.currentIndex = Math.max(0, Math.min(targetIndex, this.recording.events.length - 1));
  }

  /** Get current progress (0-1). */
  getProgress(): number {
    if (this.recording.events.length === 0) return 0;
    return this.currentIndex / this.recording.events.length;
  }

  /** Check if playback is paused. */
  isPaused(): boolean {
    return this.paused;
  }

  /** Check if playback is done. */
  isComplete(): boolean {
    return this.currentIndex >= this.recording.events.length;
  }

  private scheduleNext(): void {
    if (this.paused || this.currentIndex >= this.recording.events.length) {
      if (this.currentIndex >= this.recording.events.length) {
        this.onComplete?.();
      }
      return;
    }

    const event = this.recording.events[this.currentIndex];
    const nextEvent = this.recording.events[this.currentIndex + 1];

    // Process the current event
    if (event.type === "output" && this.onOutput) {
      this.onOutput(event.data);
    }

    // Report progress
    this.onProgress?.(this.currentIndex / this.recording.events.length);

    this.currentIndex++;

    if (nextEvent) {
      const delay = (nextEvent.timestamp - event.timestamp) / this.speed;
      // Cap delays to avoid long pauses
      const cappedDelay = Math.min(delay, 2000 / this.speed);
      this.timer = setTimeout(() => this.scheduleNext(), Math.max(1, cappedDelay));
    } else {
      this.scheduleNext();
    }
  }
}

/** Singleton instance */
let _manager: RecordingManager | null = null;

export function getRecordingManager(): RecordingManager {
  if (!_manager) {
    _manager = new RecordingManager();
  }
  return _manager;
}
