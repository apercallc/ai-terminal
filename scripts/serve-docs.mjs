import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

function withSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
      "script-src 'self' https://cdn.tailwindcss.com",
      "connect-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
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

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    withSecurityHeaders(res);

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    // Stable download URL while keeping hrefs pinned to /downloads/ai-terminal-macos.dmg
    if (pathname === "/downloads/ai-terminal-macos.dmg") {
      const configured = process.env.AI_TERMINAL_DMG_URL;
      if (configured && configured.startsWith("http")) {
        redirect(res, configured);
        return;
      }

      // If you want to ship the dmg alongside the site, place it in docs/downloads/.
      const localPath = path.join(docsRoot, "downloads", "ai-terminal-macos.dmg");
      try {
        const st = await stat(localPath);
        if (st.isFile()) {
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
