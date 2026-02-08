import type { CommandTemplate } from "@/types";

/**
 * Built-in command templates for common development workflows.
 */

const BUILTIN_TEMPLATES: CommandTemplate[] = [
  {
    id: "setup-python",
    name: "Setup Python Project",
    description: "Create a new Python project with virtual environment and common tooling",
    category: "Python",
    steps: [
      "mkdir -p {{projectName}} && cd {{projectName}}",
      "python3 -m venv venv",
      "source venv/bin/activate",
      "pip install --upgrade pip setuptools wheel",
      "pip install {{packages}}",
      "touch requirements.txt && pip freeze > requirements.txt",
      "echo '# {{projectName}}' > README.md",
    ],
    variables: [
      { name: "projectName", label: "Project Name", defaultValue: "my-python-project", placeholder: "my-python-project" },
      { name: "packages", label: "Packages", defaultValue: "pytest black flake8", placeholder: "pytest flask requests" },
    ],
  },
  {
    id: "setup-node",
    name: "Setup Node.js Project",
    description: "Create a new Node.js project with npm and common configuration",
    category: "Node.js",
    steps: [
      "mkdir -p {{projectName}} && cd {{projectName}}",
      "npm init -y",
      "npm install {{packages}}",
      "npm install -D {{devPackages}}",
      "echo 'node_modules/' > .gitignore",
      "echo '# {{projectName}}' > README.md",
    ],
    variables: [
      { name: "projectName", label: "Project Name", defaultValue: "my-node-project", placeholder: "my-node-project" },
      { name: "packages", label: "Dependencies", defaultValue: "express", placeholder: "express cors dotenv" },
      { name: "devPackages", label: "Dev Dependencies", defaultValue: "typescript @types/node", placeholder: "typescript eslint prettier" },
    ],
  },
  {
    id: "setup-react",
    name: "Setup React App",
    description: "Create a new React application with Vite",
    category: "Frontend",
    steps: [
      "npm create vite@latest {{projectName}} -- --template {{template}}",
      "cd {{projectName}}",
      "npm install",
      "npm install -D {{devPackages}}",
    ],
    variables: [
      { name: "projectName", label: "Project Name", defaultValue: "my-react-app", placeholder: "my-react-app" },
      { name: "template", label: "Template", defaultValue: "react-ts", placeholder: "react-ts" },
      { name: "devPackages", label: "Dev Dependencies", defaultValue: "eslint prettier", placeholder: "eslint prettier vitest" },
    ],
  },
  {
    id: "setup-docker",
    name: "Dockerize Application",
    description: "Add Docker configuration to an existing project",
    category: "DevOps",
    steps: [
      "cat > Dockerfile << 'EOF'\nFROM {{baseImage}}\nWORKDIR /app\nCOPY . .\nRUN {{installCmd}}\nEXPOSE {{port}}\nCMD {{runCmd}}\nEOF",
      "echo 'node_modules\n.git\n*.md' > .dockerignore",
      "docker build -t {{imageName}} .",
    ],
    variables: [
      { name: "baseImage", label: "Base Image", defaultValue: "node:20-alpine", placeholder: "node:20-alpine" },
      { name: "installCmd", label: "Install Command", defaultValue: "npm ci --production", placeholder: "npm ci --production" },
      { name: "port", label: "Port", defaultValue: "3000", placeholder: "3000" },
      { name: "runCmd", label: "Run Command", defaultValue: '["node", "index.js"]', placeholder: '["node", "index.js"]' },
      { name: "imageName", label: "Image Name", defaultValue: "my-app", placeholder: "my-app" },
    ],
  },
  {
    id: "setup-git",
    name: "Initialize Git Repository",
    description: "Set up a new Git repository with standard configuration",
    category: "Git",
    steps: [
      "git init",
      "git branch -M main",
      "echo '# Ignore files\\nnode_modules/\\n.env\\n*.log\\n.DS_Store\\ndist/\\nbuild/' > .gitignore",
      'git add . && git commit -m "{{commitMessage}}"',
      "git remote add origin {{remoteUrl}}",
    ],
    variables: [
      { name: "commitMessage", label: "Initial Commit Message", defaultValue: "Initial commit", placeholder: "Initial commit" },
      { name: "remoteUrl", label: "Remote URL", defaultValue: "", placeholder: "https://github.com/user/repo.git" },
    ],
  },
  {
    id: "setup-go",
    name: "Setup Go Project",
    description: "Create a new Go module with standard project structure",
    category: "Go",
    steps: [
      "mkdir -p {{projectName}} && cd {{projectName}}",
      "go mod init {{modulePath}}",
      "mkdir -p cmd/{{projectName}} internal pkg",
      'echo \'package main\\n\\nimport "fmt"\\n\\nfunc main() {\\n\\tfmt.Println("Hello, World!")\\n}\' > cmd/{{projectName}}/main.go',
      "go build ./...",
    ],
    variables: [
      { name: "projectName", label: "Project Name", defaultValue: "my-go-project", placeholder: "my-go-project" },
      { name: "modulePath", label: "Module Path", defaultValue: "github.com/user/my-go-project", placeholder: "github.com/user/my-go-project" },
    ],
  },
  {
    id: "setup-rust",
    name: "Setup Rust Project",
    description: "Create a new Rust project with Cargo",
    category: "Rust",
    steps: [
      "cargo new {{projectName}} --{{projectType}}",
      "cd {{projectName}}",
      "cargo build",
      "cargo test",
    ],
    variables: [
      { name: "projectName", label: "Project Name", defaultValue: "my-rust-project", placeholder: "my-rust-project" },
      { name: "projectType", label: "Type (bin or lib)", defaultValue: "bin", placeholder: "bin" },
    ],
  },
  {
    id: "deploy-ssh",
    name: "Deploy via SSH",
    description: "Deploy application to a remote server via SSH",
    category: "DevOps",
    steps: [
      "ssh {{user}}@{{host}} 'mkdir -p {{deployDir}}'",
      "rsync -avz --exclude 'node_modules' --exclude '.git' . {{user}}@{{host}}:{{deployDir}}/",
      "ssh {{user}}@{{host}} 'cd {{deployDir}} && {{installCmd}}'",
      "ssh {{user}}@{{host}} 'cd {{deployDir}} && {{restartCmd}}'",
    ],
    variables: [
      { name: "user", label: "SSH User", defaultValue: "", placeholder: "deploy" },
      { name: "host", label: "Host", defaultValue: "", placeholder: "example.com" },
      { name: "deployDir", label: "Deploy Directory", defaultValue: "/opt/app", placeholder: "/opt/app" },
      { name: "installCmd", label: "Install Command", defaultValue: "npm ci --production", placeholder: "npm ci --production" },
      { name: "restartCmd", label: "Restart Command", defaultValue: "pm2 restart all", placeholder: "pm2 restart all" },
    ],
  },
  {
    id: "db-backup",
    name: "Database Backup",
    description: "Create a backup of a database",
    category: "Database",
    steps: [
      "mkdir -p {{backupDir}}",
      "{{dumpCmd}} > {{backupDir}}/{{dbName}}_$(date +%Y%m%d_%H%M%S).sql",
      "ls -la {{backupDir}}/",
    ],
    variables: [
      { name: "dumpCmd", label: "Dump Command", defaultValue: "pg_dump -U postgres mydb", placeholder: "pg_dump -U postgres mydb" },
      { name: "backupDir", label: "Backup Directory", defaultValue: "./backups", placeholder: "./backups" },
      { name: "dbName", label: "Database Name", defaultValue: "mydb", placeholder: "mydb" },
    ],
  },
  {
    id: "ssl-cert",
    name: "Generate SSL Certificate",
    description: "Create a self-signed SSL certificate for development",
    category: "Security",
    steps: [
      "mkdir -p {{certDir}}",
      "openssl req -x509 -newkey rsa:4096 -keyout {{certDir}}/key.pem -out {{certDir}}/cert.pem -days {{days}} -nodes -subj '/CN={{domain}}'",
      "ls -la {{certDir}}/",
    ],
    variables: [
      { name: "certDir", label: "Certificate Directory", defaultValue: "./certs", placeholder: "./certs" },
      { name: "days", label: "Validity (days)", defaultValue: "365", placeholder: "365" },
      { name: "domain", label: "Domain", defaultValue: "localhost", placeholder: "localhost" },
    ],
  },
];

const CUSTOM_TEMPLATES_KEY = "ai_terminal_custom_templates";

export class TemplateManager {
  private customTemplates: CommandTemplate[] = [];

  constructor() {
    this.loadCustomTemplates();
  }

  /** Get all templates (built-in + custom). */
  getAll(): CommandTemplate[] {
    return [...BUILTIN_TEMPLATES, ...this.customTemplates];
  }

  /** Get a template by ID. */
  getById(id: string): CommandTemplate | undefined {
    return this.getAll().find((t) => t.id === id);
  }

  /** Get templates by category. */
  getByCategory(category: string): CommandTemplate[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /** Get all categories. */
  getCategories(): string[] {
    const cats = new Set<string>();
    for (const t of this.getAll()) {
      cats.add(t.category);
    }
    return Array.from(cats).sort();
  }

  /** Search templates by name or description. */
  search(query: string): CommandTemplate[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }

  /** Add a custom template. */
  addCustom(template: Omit<CommandTemplate, "id">): CommandTemplate {
    const newTemplate: CommandTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    this.customTemplates.push(newTemplate);
    this.saveCustomTemplates();
    return newTemplate;
  }

  /** Remove a custom template. */
  removeCustom(id: string): boolean {
    const idx = this.customTemplates.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.customTemplates.splice(idx, 1);
    this.saveCustomTemplates();
    return true;
  }

  /** Resolve a template's steps by substituting variables. */
  resolveSteps(
    template: CommandTemplate,
    values: Record<string, string>,
  ): string[] {
    return template.steps.map((step) => {
      let resolved = step;
      for (const v of template.variables) {
        const val = values[v.name] || v.defaultValue;
        resolved = resolved.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), val);
      }
      return resolved;
    });
  }

  private loadCustomTemplates(): void {
    try {
      const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (stored) {
        this.customTemplates = JSON.parse(stored);
      }
    } catch {
      this.customTemplates = [];
    }
  }

  private saveCustomTemplates(): void {
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(this.customTemplates));
    } catch {
      // Storage full or unavailable
    }
  }
}

/** Singleton instance */
let _manager: TemplateManager | null = null;

export function getTemplateManager(): TemplateManager {
  if (!_manager) {
    _manager = new TemplateManager();
  }
  return _manager;
}
