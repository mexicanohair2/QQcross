const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json"
};

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(file, (statError, stat) => {
    const target = !statError && stat.isDirectory() ? path.join(file, "index.html") : file;
    fs.readFile(target, (error, data) => {
      if (error) {
        res.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(data);
    });
  });
}).listen(port, "127.0.0.1", () => {
  console.log("QQCross test server listening on http://127.0.0.1:" + port);
});
