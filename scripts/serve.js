#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  // 2026-10-03：papers/shared/vendor/（自托管 PDF.js）与 fonts/（自托管字体）上线后，
  // serve.js 必须正确伺服这些类型——模块脚本与 module worker 对 MIME 做严格校验，
  // application/octet-stream 会被浏览器直接拒绝执行（动态 import 与 Worker 均失败，
  // 症状为阅读页 16 个用例集体超时）。GitHub Pages 对这些扩展名本就返回正确 MIME，
  // 此处补齐只是让本地/CI 预览与生产行为一致。
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
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
