import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ProviderType } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { createProvider, validateProviderSettings } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm/provider";

const SETTINGS_STORAGE_KEY = "ai_terminal_settings";

interface UseSettingsReturn {
  settings: AppSettings;
  provider: LLMProvider | null;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updateProvider: (partial: Partial<AppSettings["provider"]>) => void;
  saveApiKey: () => Promise<void>;
  loadApiKey: () => Promise<void>;
  deleteApiKey: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  validationErrors: string[];
  isLoading: boolean;
  connectionStatus: "untested" | "testing" | "connected" | "failed";
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to pick up any new fields
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Fall through to defaults
    }
    return { ...DEFAULT_SETTINGS };
  });

  const [provider, setProviderState] = useState<LLMProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "untested" | "testing" | "connected" | "failed"
  >("untested");

  const validationErrors = validateProviderSettings(settings.provider);

  // Persist settings to localStorage on change (without API key)
  useEffect(() => {
    const toStore = {
      ...settings,
      provider: {
        ...settings.provider,
        apiKey: "", // Never store API key in localStorage
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toStore));
  }, [settings]);

  // Create provider whenever settings change and are valid
  useEffect(() => {
    if (validationErrors.length === 0 && settings.provider.apiKey) {
      try {
        const p = createProvider(settings.provider);
        setProviderState(p);
      } catch {
        setProviderState(null);
      }
    } else if (settings.provider.type === "local" && settings.provider.baseUrl) {
      // Local providers don't need an API key
      try {
        const p = createProvider(settings.provider);
        setProviderState(p);
      } catch {
        setProviderState(null);
      }
    }
  }, [settings.provider, validationErrors.length]);

  // Load API key from keychain on mount
  useEffect(() => {
    loadApiKeyFromKeychain(settings.provider.type);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadApiKeyFromKeychain = async (providerType: ProviderType) => {
    try {
      const key = await invoke<string | null>("get_api_key", {
        provider: providerType,
      });
      if (key) {
        setSettings((prev) => ({
          ...prev,
          provider: { ...prev.provider, apiKey: key },
        }));
      }
    } catch {
      // No key stored — that's fine
    }
  };

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    setConnectionStatus("untested");
  }, []);

  const updateProvider = useCallback(
    (partial: Partial<AppSettings["provider"]>) => {
      setSettings((prev) => ({
        ...prev,
        provider: { ...prev.provider, ...partial },
      }));
      setConnectionStatus("untested");

      // If provider type changed, load the key for the new type
      if (partial.type) {
        loadApiKeyFromKeychain(partial.type);
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const saveApiKey = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke("store_api_key", {
        provider: settings.provider.type,
        apiKey: settings.provider.apiKey,
      });
    } finally {
      setIsLoading(false);
    }
  }, [settings.provider.type, settings.provider.apiKey]);

  const loadApiKey = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadApiKeyFromKeychain(settings.provider.type);
    } finally {
      setIsLoading(false);
    }
  }, [settings.provider.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteApiKey = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke("delete_api_key", { provider: settings.provider.type });
      setSettings((prev) => ({
        ...prev,
        provider: { ...prev.provider, apiKey: "" },
      }));
    } finally {
      setIsLoading(false);
    }
  }, [settings.provider.type]);

  const testConnection = useCallback(async () => {
    if (!provider) return false;
    setConnectionStatus("testing");
    try {
      const ok = await provider.testConnection();
      setConnectionStatus(ok ? "connected" : "failed");
      return ok;
    } catch {
      setConnectionStatus("failed");
      return false;
    }
  }, [provider]);

  return {
    settings,
    provider,
    updateSettings,
    updateProvider,
    saveApiKey,
    loadApiKey,
    deleteApiKey,
    testConnection,
    validationErrors,
    isLoading,
    connectionStatus,
  };
}
