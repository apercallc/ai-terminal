/* eslint-disable @typescript-eslint/no-explicit-any */
import type { VoiceInputState } from "@/types";

type VoiceEventHandler = (state: VoiceInputState) => void;

// Web Speech API types (not in all TypeScript DOM libs)
interface SpeechRecognitionAPI {
  new (): SpeechRecognitionInstance;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/**
 * Voice input manager using the Web Speech API (SpeechRecognition).
 * Provides continuous speech-to-text transcription for terminal goal input.
 */
export class VoiceInputManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private state: VoiceInputState;
  private listeners: Set<VoiceEventHandler> = new Set();
  private isSupported: boolean;

  constructor() {
    this.isSupported = this.checkSupport();
    this.state = {
      isListening: false,
      transcript: "",
      confidence: 0,
      error: null,
      isSupported: this.isSupported,
    };

    if (this.isSupported) {
      this.initRecognition();
    }
  }

  /** Get current voice input state. */
  getState(): VoiceInputState {
    return { ...this.state };
  }

  /** Check if voice input is supported. */
  get supported(): boolean {
    return this.isSupported;
  }

  /** Start listening for voice input. */
  start(): void {
    if (!this.recognition || this.state.isListening) return;

    this.updateState({
      isListening: true,
      transcript: "",
      confidence: 0,
      error: null,
    });

    try {
      this.recognition.start();
    } catch (err) {
      this.updateState({
        isListening: false,
        error: err instanceof Error ? err.message : "Failed to start voice input",
      });
    }
  }

  /** Stop listening. */
  stop(): void {
    if (!this.recognition || !this.state.isListening) return;
    this.recognition.stop();
    this.updateState({ isListening: false });
  }

  /** Toggle listening state. */
  toggle(): void {
    if (this.state.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }

  /** Subscribe to state changes. */
  subscribe(handler: VoiceEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /** Clean up resources. */
  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.recognition = null;
  }

  private checkSupport(): boolean {
    return typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }

  private initRecognition(): void {
    const SpeechRecognitionCtor: SpeechRecognitionAPI | undefined =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      let transcript = "";
      let confidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        transcript += result[0].transcript;
        confidence = Math.max(confidence, result[0].confidence);
      }

      this.updateState({ transcript, confidence });
    };

    this.recognition.onerror = (event: any) => {
      let errorMsg = "Voice input error";
      switch (event.error) {
        case "no-speech":
          errorMsg = "No speech detected. Try again.";
          break;
        case "audio-capture":
          errorMsg = "No microphone found. Check your audio settings.";
          break;
        case "not-allowed":
          errorMsg = "Microphone access denied. Allow access to use voice input.";
          break;
        case "network":
          errorMsg = "Network error. Check your connection.";
          break;
        case "aborted":
          errorMsg = "";
          break;
        default:
          errorMsg = `Voice input error: ${event.error}`;
      }

      this.updateState({
        isListening: false,
        error: errorMsg || null,
      });
    };

    this.recognition.onend = () => {
      if (this.state.isListening) {
        // Restart if we're supposed to still be listening
        try {
          this.recognition?.start();
        } catch {
          this.updateState({ isListening: false });
        }
      }
    };
  }

  private updateState(partial: Partial<VoiceInputState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

/** Singleton instance */
let _manager: VoiceInputManager | null = null;

export function getVoiceInputManager(): VoiceInputManager {
  if (!_manager) {
    _manager = new VoiceInputManager();
  }
  return _manager;
}
