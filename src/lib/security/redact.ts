const SECRET_PATTERNS: RegExp[] = [
  // Authorization: Bearer <token>
  /(Authorization\s*:\s*Bearer\s+)([^\s"']+)/gi,
  // Common API key prefixes
  /\b(sk-[A-Za-z0-9_-]{8,})\b/g,
  /\b(sk-ant-[A-Za-z0-9_-]{8,})\b/g,
  // Query-string-ish
  /(api[_-]?key\s*[=:]\s*)([^\s"']+)/gi,
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (_m, p1, p2) => {
      if (typeof p2 === "string") return `${p1}[REDACTED]`;
      return "[REDACTED]";
    });
  }
  return out;
}

export function redactMaybe(input: string | null | undefined): string | null {
  if (!input) return null;
  return redactSecrets(input);
}
