#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".tex": "text/plain",
  ".txt": "text/plain",
  ".xml": "application/xml"
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    // 体检 D-8：decodeURIComponent 对畸形百分号编码（如 "/%"）会抛 URIError，
    // 而请求处理器里的未捕获异常会直接终止进程 —— 单个畸形请求即可打挂服务器
    // （本机跑测试时无所谓，但 docs/MACMINI.md 里它被用作局域网预览）。
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }
  if (urlPath === "/") {
    urlPath = "/index.html";
  }
  // 体检 D-8：原判定是 `!filePath.startsWith(ROOT)`，用字符串前缀冒充目录包含判定，
  // 于是与仓库同前缀的兄弟目录（如 ../homepage-secret）会被判为合法而读到。
  // 改为 path.relative 做真正的包含判定；前置 "." 也顺带堵掉
  // path.resolve(ROOT, "/etc/passwd") 这类「绝对路径覆盖根」的写法。
  const filePath = path.resolve(ROOT, "." + urlPath);
  const rel = path.relative(ROOT, filePath);
  const escapesRoot = rel.startsWith("..") || path.isAbsolute(rel);
  if (escapesRoot || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
  const stream = fs.createReadStream(filePath);
  // 读流失败（权限、文件被并发改动/删除）时若不挂 error 处理器，
  // 会以未捕获异常的形式终止进程。
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
    }
    res.end("Internal error");
  });
  stream.pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Static server running at http://127.0.0.1:${PORT}`);
});
