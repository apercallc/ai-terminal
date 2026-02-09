import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@tauri-apps/api/core": resolve(__dirname, "src/__tests__/__mocks__/tauri-core.ts"),
      "@tauri-apps/api": resolve(__dirname, "src/__tests__/__mocks__/tauri.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Coverage in CI is intended to reflect the unit-tested library surface.
      // UI + runtime entrypoints are covered by e2e/manual testing instead.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/__tests__/**",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "src/App.tsx",
        "src/components/**",
        "src/hooks/**",
        // Integration-heavy modules (require a real Tauri runtime/PTY).
        "src/lib/agent/executor.ts",
        "src/lib/analytics/crash-reporter.ts",
      ],
      thresholds: {
        branches: 28,
        functions: 29,
        lines: 33,
        statements: 32,
      },
    },
  },
});
