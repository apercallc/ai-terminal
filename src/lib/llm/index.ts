export { type LLMProvider, estimateTokens, buildHeaders, parseSSEStream } from "./provider";
export { OpenAIProvider } from "./openai";
export { AnthropicProvider } from "./anthropic";
export { LocalProvider } from "./local";

import type { ProviderSettings } from "@/types";
import type { LLMProvider } from "./provider";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { LocalProvider } from "./local";

/**
 * Factory: create an LLMProvider from application settings.
 */
export function createProvider(settings: ProviderSettings): LLMProvider {
  switch (settings.type) {
    case "openai":
      return new OpenAIProvider(settings.apiKey, settings.model, settings.baseUrl);
    case "anthropic":
      return new AnthropicProvider(settings.apiKey, settings.model, settings.baseUrl);
    case "local":
      return new LocalProvider(settings.baseUrl, settings.model, settings.apiKey);
    default:
      throw new Error(`Unknown provider type: ${settings.type}`);
  }
}

/**
 * Validate that provider settings have required fields.
 */
export function validateProviderSettings(settings: ProviderSettings): string[] {
  const errors: string[] = [];

  if (!settings.type) {
    errors.push("Provider type is required");
  }

  if (settings.type !== "local" && !settings.apiKey) {
    errors.push("API key is required for cloud providers");
  }

  if (!settings.baseUrl) {
    errors.push("Base URL is required");
  }

  if (!settings.model) {
    errors.push("Model name is required");
  }

  try {
    const url = new URL(settings.baseUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      errors.push("Base URL must be http(s)");
    }

    if (url.username || url.password) {
      errors.push("Base URL must not include credentials");
    }

    if (settings.type !== "local") {
      if (url.protocol !== "https:") {
        errors.push("Cloud providers require https:// Base URL");
      }
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        errors.push("Cloud providers must not use localhost Base URL");
      }
    }
  } catch {
    errors.push("Base URL is not a valid URL");
  }

  return errors;
}
