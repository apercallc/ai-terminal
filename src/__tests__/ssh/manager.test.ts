import { describe, it, expect, beforeEach } from "vitest";
import { SSHManager } from "@/lib/ssh/manager";

describe("SSHManager", () => {
  let manager: SSHManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new SSHManager();
  });

  describe("add", () => {
    it("adds a new SSH connection", () => {
      const conn = manager.add({
        name: "Dev Server",
        host: "dev.example.com",
        port: 22,
        username: "admin",
        authMethod: "key",
        privateKeyPath: "~/.ssh/id_rsa",
      });

      expect(conn.id).toBeTruthy();
      expect(conn.name).toBe("Dev Server");
      expect(conn.host).toBe("dev.example.com");
      expect(conn.isConnected).toBe(false);
    });

    it("assigns unique IDs", () => {
      const c1 = manager.add({
        name: "Server 1",
        host: "s1.example.com",
        port: 22,
        username: "root",
        authMethod: "password",
      });
      const c2 = manager.add({
        name: "Server 2",
        host: "s2.example.com",
        port: 22,
        username: "root",
        authMethod: "password",
      });

      expect(c1.id).not.toBe(c2.id);
    });
  });

  describe("getAll", () => {
    it("returns all connections", () => {
      manager.add({
        name: "S1",
        host: "s1.test",
        port: 22,
        username: "user",
        authMethod: "password",
      });
      manager.add({
        name: "S2",
        host: "s2.test",
        port: 2222,
        username: "user",
        authMethod: "key",
      });

      expect(manager.getAll()).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("finds a connection by ID", () => {
      const conn = manager.add({
        name: "Test",
        host: "test.local",
        port: 22,
        username: "admin",
        authMethod: "password",
      });

      const found = manager.getById(conn.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe("Test");
    });

    it("returns undefined for unknown ID", () => {
      expect(manager.getById("nonexistent")).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("removes a connection", () => {
      const conn = manager.add({
        name: "ToDelete",
        host: "del.test",
        port: 22,
        username: "x",
        authMethod: "password",
      });

      expect(manager.remove(conn.id)).toBe(true);
      expect(manager.getAll()).toHaveLength(0);
    });

    it("returns false for unknown ID", () => {
      expect(manager.remove("nope")).toBe(false);
    });
  });

  describe("update", () => {
    it("updates connection properties", () => {
      const conn = manager.add({
        name: "Original",
        host: "old.test",
        port: 22,
        username: "user",
        authMethod: "password",
      });

      manager.update(conn.id, { name: "Updated", port: 2222 });
      const updated = manager.getById(conn.id);
      expect(updated!.name).toBe("Updated");
      expect(updated!.port).toBe(2222);
    });
  });

  describe("buildConnectCommand", () => {
    it("builds basic SSH command", () => {
      const cmd = manager.buildConnectCommand({
        id: "test",
        name: "Test",
        host: "example.com",
        port: 22,
        username: "admin",
        authMethod: "password",
        isConnected: false,
        lastConnected: null,
      });

      expect(cmd).toContain("ssh");
      expect(cmd).toContain("admin@example.com");
    });

    it("includes port flag for non-default port", () => {
      const cmd = manager.buildConnectCommand({
        id: "test",
        name: "Test",
        host: "example.com",
        port: 2222,
        username: "admin",
        authMethod: "password",
        isConnected: false,
        lastConnected: null,
      });

      expect(cmd).toContain("-p");
      expect(cmd).toContain("2222");
    });

    it("includes key flag for key auth", () => {
      const cmd = manager.buildConnectCommand({
        id: "test",
        name: "Test",
        host: "example.com",
        port: 22,
        username: "admin",
        authMethod: "key",
        privateKeyPath: "~/.ssh/id_rsa",
        isConnected: false,
        lastConnected: null,
      });

      expect(cmd).toContain("-i");
      expect(cmd).toContain("~/.ssh/id_rsa");
    });
  });

  describe("export/import", () => {
    it("exports connections as JSON", () => {
      manager.add({
        name: "Export Test",
        host: "export.test",
        port: 22,
        username: "user",
        authMethod: "password",
      });

      const exported = manager.export();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Export Test");
    });

    it("imports connections from JSON", () => {
      const json = JSON.stringify([
        {
          name: "Imported",
          host: "import.test",
          port: 22,
          username: "admin",
          authMethod: "key",
        },
      ]);

      const count = manager.import(json);
      expect(count).toBe(1);
      expect(manager.getAll()).toHaveLength(1);
    });

    it("returns 0 for invalid JSON", () => {
      expect(manager.import("not json")).toBe(0);
    });
  });

  describe("testConnection", () => {
    it("validates required fields", async () => {
      const result = await manager.testConnection({
        id: "test",
        name: "Test",
        host: "",
        port: 22,
        username: "user",
        authMethod: "password",
        isConnected: false,
        lastConnected: null,
      });

      expect(result.success).toBe(false);
    });

    it("validates port range", async () => {
      const result = await manager.testConnection({
        id: "test",
        name: "Test",
        host: "example.com",
        port: 99999,
        username: "user",
        authMethod: "password",
        isConnected: false,
        lastConnected: null,
      });

      expect(result.success).toBe(false);
    });

    it("succeeds for valid connection params", async () => {
      const result = await manager.testConnection({
        id: "test",
        name: "Test",
        host: "example.com",
        port: 22,
        username: "user",
        authMethod: "password",
        isConnected: false,
        lastConnected: null,
      });

      expect(result.success).toBe(true);
    });
  });
});
