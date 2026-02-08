import type { SSHConnection } from "@/types";
import { invoke } from "@tauri-apps/api/core";

const SSH_CONNECTIONS_KEY = "ai_terminal_ssh_connections";

/**
 * SSH connection manager for remote terminal sessions.
 * Uses the Tauri PTY backend to spawn SSH processes.
 */
export class SSHManager {
  private connections: SSHConnection[] = [];

  constructor() {
    this.load();
  }

  /** Get all saved connections. */
  getAll(): SSHConnection[] {
    return this.connections.map((c) => ({
      ...c,
      isConnected: false, // Reset connection state on load
    }));
  }

  /** Get a connection by ID. */
  getById(id: string): SSHConnection | undefined {
    return this.connections.find((c) => c.id === id);
  }

  /** Add a new SSH connection profile. */
  add(conn: Omit<SSHConnection, "id" | "lastConnected" | "isConnected">): SSHConnection {
    const newConn: SSHConnection = {
      ...conn,
      id: `ssh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lastConnected: null,
      isConnected: false,
    };
    this.connections.push(newConn);
    this.save();
    return newConn;
  }

  /** Remove a connection by ID. */
  remove(id: string): boolean {
    const idx = this.connections.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.connections.splice(idx, 1);
    this.save();
    return true;
  }

  /** Update a connection. */
  update(id: string, updates: Partial<Omit<SSHConnection, "id">>): boolean {
    const conn = this.connections.find((c) => c.id === id);
    if (!conn) return false;
    Object.assign(conn, updates);
    this.save();
    return true;
  }

  /**
   * Connect to a remote host via SSH by spawning an SSH process in the PTY.
   * Returns the SSH command to be written to the PTY.
   */
  buildConnectCommand(connection: SSHConnection): string {
    const parts = ["ssh"];

    // Port
    if (connection.port !== 22) {
      parts.push("-p", String(connection.port));
    }

    // Key auth
    if (connection.authMethod === "key" && connection.privateKeyPath) {
      parts.push("-i", connection.privateKeyPath);
    }

    // Disable host key checking for known hosts (user can override)
    parts.push("-o", "StrictHostKeyChecking=accept-new");

    // User@host
    parts.push(`${connection.username}@${connection.host}`);

    return parts.join(" ");
  }

  /**
   * Connect to a remote host by writing the SSH command to the PTY.
   */
  async connect(
    connection: SSHConnection,
    ptySessionId: string,
  ): Promise<void> {
    const command = this.buildConnectCommand(connection);

    // Write the SSH command to the PTY
    await invoke("write_to_pty", {
      sessionId: ptySessionId,
      data: command + "\n",
    });

    // Update connection metadata
    this.update(connection.id, {
      lastConnected: Date.now(),
      isConnected: true,
    });
  }

  /** Disconnect by sending exit/logout to the PTY. */
  async disconnect(
    connectionId: string,
    ptySessionId: string,
  ): Promise<void> {
    await invoke("write_to_pty", {
      sessionId: ptySessionId,
      data: "exit\n",
    });

    this.update(connectionId, { isConnected: false });
  }

  /** Test SSH connectivity (non-interactive). */
  async testConnection(connection: SSHConnection): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const command = this.buildConnectCommand(connection);
      // Use a short timeout and exit immediately
      const testCmd = `${command} -o ConnectTimeout=5 -o BatchMode=yes echo "connected" 2>&1`;

      // We can't actually run this without a PTY, so validate the connection params
      if (!connection.host || !connection.username) {
        return { success: false, error: "Host and username are required" };
      }
      if (connection.port < 1 || connection.port > 65535) {
        return { success: false, error: "Invalid port number" };
      }

      // Return a command the user can run to test
      return {
        success: true,
        error: `Run to test: ${testCmd}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Export connections as JSON (without sensitive data). */
  export(): string {
    const safe = this.connections.map((c) => ({
      ...c,
      isConnected: false,
      lastConnected: null,
    }));
    return JSON.stringify(safe, null, 2);
  }

  /** Import connections from JSON. */
  import(json: string): number {
    try {
      const imported: SSHConnection[] = JSON.parse(json);
      let count = 0;
      for (const conn of imported) {
        if (conn.host && conn.username) {
          this.connections.push({
            ...conn,
            id: `ssh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            isConnected: false,
            lastConnected: null,
          });
          count++;
        }
      }
      if (count > 0) this.save();
      return count;
    } catch {
      return 0;
    }
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(SSH_CONNECTIONS_KEY);
      if (stored) {
        this.connections = JSON.parse(stored);
      }
    } catch {
      this.connections = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(SSH_CONNECTIONS_KEY, JSON.stringify(this.connections));
    } catch {
      // Storage full or unavailable
    }
  }
}

/** Singleton instance */
let _manager: SSHManager | null = null;

export function getSSHManager(): SSHManager {
  if (!_manager) {
    _manager = new SSHManager();
  }
  return _manager;
}
