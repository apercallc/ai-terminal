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

const server = http.createServer(async (req, res) => {
  try {
    withSecurityHeaders(res);

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
