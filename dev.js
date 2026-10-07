const http = require("http"),
  fs = require("fs"),
  path = require("path");
try {
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .forEach((l) => {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
} catch (e) {}
let pakaiDefault = false;
if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = "admin12345";
  pakaiDefault = true;
}
if (!process.env.SESSION_SECRET)
  process.env.SESSION_SECRET = "dev-secret-lokal";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
http
  .createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname.startsWith("/api/")) {
      const name = u.pathname.slice(5).replace(/[^a-z]/g, "");
      let h;
      try {
        h = require("./api/" + name + ".js");
      } catch (e) {
        res.statusCode = 404;
        return res.end();
      }
      req.query = Object.fromEntries(u.searchParams);
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      try {
        req.body =
          raw && /json/.test(req.headers["content-type"] || "")
            ? JSON.parse(raw)
            : raw || undefined;
      } catch (e) {
        req.body = {};
      }
      res.status = (n) => {
        res.statusCode = n;
        return res;
      };
      res.json = (o) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(o));
      };
      return h(req, res);
    }
    const rel = path.normalize(
      u.pathname === "/"
        ? "index.html"
        : decodeURIComponent(u.pathname).replace(/^[/\\]+/, ""),
    );
    if (
      rel.startsWith("..") ||
      rel.split(path.sep).some((s) => s.startsWith(".")) ||
      rel.startsWith("api") ||
      rel.startsWith("node_modules") ||
      rel === "dev.js" ||
      rel === "package.json"
    ) {
      res.statusCode = 404;
      return res.end("404");
    }
    fs.readFile(path.join(__dirname, rel), (e, d) => {
      if (e) {
        res.statusCode = 404;
        return res.end("404");
      }
      res.setHeader(
        "Content-Type",
        mime[path.extname(rel)] || "application/octet-stream",
      );
      res.end(d);
    });
  })
  .listen(3000, () => {
    console.log("\nWebsite jalan di: http://localhost:3000");
    console.log(
      process.env.MONGODB_URI
        ? "Database: MongoDB (dari .env)"
        : "Database: file lokal di folder .localdb (tanpa MongoDB)",
    );
    if (pakaiDefault) console.log("Password login lokal: admin12345");
    console.log("Hentikan dengan Ctrl+C\n");
  });
