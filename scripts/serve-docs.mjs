import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

// Very small in-memory rate limit (sufficient for a single-node deployment).
// For multi-node production, enforce at the edge (CDN/WAF) instead.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_GENERAL = 300; // requests/minute/ip
const RATE_LIMIT_DOWNLOAD = 30; // downloads/minute/ip
const rateState = new Map();

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  const ip = (raw ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
  return ip || "unknown";
}

function checkRateLimit(req, limit) {
  const ip = getClientIp(req);
  const now = Date.now();
  const cur = rateState.get(ip);
  if (!cur || now >= cur.resetAt) {
    rateState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, remaining: limit - 1 };
  }
  if (cur.count >= limit) {
    return { ok: false, remaining: 0, resetAt: cur.resetAt };
  }
  cur.count += 1;
  return { ok: true, remaining: limit - cur.count };
}

function withSecurityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  const forwardedProtoRaw = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoRaw)
    ? forwardedProtoRaw[0]
    : forwardedProtoRaw;
  const proto = (forwardedProto ?? "http").split(",")[0].trim();
  if (proto === "https") {
    // HSTS must only be set over HTTPS.
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
      "script-src 'self' https://cdn.tailwindcss.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".ico":
      return "image/x-icon";
    case ".dmg":
      return "application/x-apple-diskimage";
    default:
      return "application/octet-stream";
  }
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const clean = decoded.split("?")[0].split("#")[0];
  const normalized = path.posix.normalize(clean).replace(/^\/+/, "");
  const joined = path.join(root, normalized);
  const relative = path.relative(root, joined);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return joined;
}

async function sendFile(res, filePath) {
  const body = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypeFor(filePath));
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(body);
}

function sendText(res, body, contentType) {
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(body);
}

function getRequestOrigin(req) {
  const configured = process.env.SITE_URL;
  if (configured && configured.startsWith("http")) {
    return configured.replace(/\/$/, "");
  }

  const host = req.headers.host ?? "localhost";
  const forwardedProtoRaw = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoRaw)
    ? forwardedProtoRaw[0]
    : forwardedProtoRaw;
  const proto = (forwardedProto ?? "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

function buildSitemapXml(origin) {
  const urls = [
    { path: "/", changefreq: "weekly", priority: 1.0 },
    { path: "/privacy/", changefreq: "yearly", priority: 0.3 },
    { path: "/terms/", changefreq: "yearly", priority: 0.3 },
    { path: "/setup.md", changefreq: "monthly", priority: 0.4 },
    { path: "/troubleshooting.md", changefreq: "monthly", priority: 0.4 },
    { path: "/architecture.md", changefreq: "monthly", priority: 0.2 },
  ];

  const now = new Date().toISOString();
  const body = urls
    .map(
      (u) => `  <url>\n    <loc>${origin}${u.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function parseHostAllowlist(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedDownloadUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    const allow = parseHostAllowlist(process.env.AI_TERMINAL_DOWNLOAD_ALLOW_HOSTS);
    if (allow.length === 0) return true;
    return allow.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    // General request rate limiting.
    const rl = checkRateLimit(req, RATE_LIMIT_GENERAL);
    if (!rl.ok) {
      res.statusCode = 429;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Too many requests");
      return;
    }

    withSecurityHeaders(req, res);

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    if (pathname === "/robots.txt") {
      const origin = getRequestOrigin(req);
      sendText(
        res,
        [`User-agent: *`, `Allow: /`, `Sitemap: ${origin}/sitemap.xml`, ``].join("\n"),
        "text/plain; charset=utf-8",
      );
      return;
    }

    if (pathname === "/sitemap.xml") {
      const origin = getRequestOrigin(req);
      sendText(res, buildSitemapXml(origin), "application/xml; charset=utf-8");
      return;
    }

    // Stable download URL while keeping hrefs pinned to /downloads/ai-terminal-macos.dmg
    if (pathname === "/downloads/ai-terminal-macos.dmg") {
      const dl = checkRateLimit(req, RATE_LIMIT_DOWNLOAD);
      if (!dl.ok) {
        res.statusCode = 429;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Too many download requests");
        return;
      }

      const configured = process.env.AI_TERMINAL_DMG_URL;
      if (configured && configured.startsWith("http")) {
        if (!isAllowedDownloadUrl(configured)) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Download misconfigured. AI_TERMINAL_DMG_URL must be https:// and match allowlist.");
          return;
        }
        redirect(res, configured);
        return;
      }

      // If you want to ship the dmg alongside the site, place it in docs/downloads/.
      const localPath = path.join(docsRoot, "downloads", "ai-terminal-macos.dmg");
      try {
        const st = await stat(localPath);
        if (st.isFile()) {
          res.setHeader("Content-Disposition", "attachment; filename=ai-terminal-macos.dmg");
          await sendFile(res, localPath);
          return;
        }
      } catch {
        // fall through
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "Download not configured. Set AI_TERMINAL_DMG_URL or place docs/downloads/ai-terminal-macos.dmg",
      );
      return;
    }

    // Optional checksum endpoint for manual verification.
    if (pathname === "/downloads/ai-terminal-macos.dmg.sha256") {
      const checksum = process.env.AI_TERMINAL_DMG_SHA256;
      if (!checksum) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Checksum not configured");
        return;
      }
      sendText(res, `${checksum}  ai-terminal-macos.dmg\n`, "text/plain; charset=utf-8");
      return;
    }

    // Serve the docs marketing site with sane directory behavior.
    // Handle common routes with or without trailing slash.
    if (pathname === "/" || pathname === "/index.html") {
      await sendFile(res, path.join(docsRoot, "index.html"));
      return;
    }

    if (pathname === "/privacy" || pathname === "/privacy/") {
      await sendFile(res, path.join(docsRoot, "privacy", "index.html"));
      return;
    }

    if (pathname === "/terms" || pathname === "/terms/") {
      await sendFile(res, path.join(docsRoot, "terms", "index.html"));
      return;
    }

    // Try to serve any other static asset under docs/
    const candidate = safeJoin(docsRoot, pathname);
    if (!candidate) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Bad request");
      return;
    }

    try {
      const st = await stat(candidate);
      if (st.isDirectory()) {
        await sendFile(res, path.join(candidate, "index.html"));
        return;
      }
      if (st.isFile()) {
        await sendFile(res, candidate);
        return;
      }
    } catch {
      // fall through
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal server error");
    console.error(err);
  }
});

server.listen(port, "0.0.0.0", () => {
  // Railway picks up PORT; binding to 0.0.0.0 is required.
  console.log(`Serving docs/ on http://0.0.0.0:${port}`);
});
