#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number.parseInt(process.env.LH_PORT || '4174', 10);
const PERF_THRESHOLD = Number.parseFloat(process.env.LH_PERF_THRESHOLD || '0.90');
const A11Y_THRESHOLD = Number.parseFloat(process.env.LH_A11Y_THRESHOLD || '0.90');
const URLS = (process.env.LH_URLS || '/index.html')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => (item.startsWith('http') ? item : `http://127.0.0.1:${PORT}${item.startsWith('/') ? '' : '/'}${item}`));

function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${PORT}/index.html`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for local server on port ${PORT}`));
          return;
        }
        setTimeout(check, 250);
      });
    };
    check();
  });
}

function runLighthouse(url, outputPath) {
  const args = [
    '--yes',
    'lighthouse',
    url,
    '--quiet',
    '--output=json',
    `--output-path=${outputPath}`,
    '--preset=desktop',
    '--only-categories=performance,accessibility',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu'
  ];
  execFileSync('npx', args, { stdio: 'inherit', cwd: ROOT });

  const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const performance = Number(report.categories.performance && report.categories.performance.score);
  const accessibility = Number(report.categories.accessibility && report.categories.accessibility.score);

  return {
    performance,
    accessibility
  };
}

async function main() {
  if (URLS.length === 0) {
    throw new Error('No Lighthouse URLs configured.');
  }

  const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore'
  });

  let failed = false;
  try {
    await waitForServer();

    console.log('=== Lighthouse Gate ===');
    console.log(`Thresholds: performance >= ${PERF_THRESHOLD}, accessibility >= ${A11Y_THRESHOLD}`);

    for (const url of URLS) {
      const outputPath = path.join(
        os.tmpdir(),
        `lighthouse-${Buffer.from(url).toString('base64url').slice(0, 24)}.json`
      );
      const scores = runLighthouse(url, outputPath);
      const perfPct = Math.round(scores.performance * 100);
      const a11yPct = Math.round(scores.accessibility * 100);

      console.log(`${url}`);
      console.log(`  performance: ${perfPct}`);
      console.log(`  accessibility: ${a11yPct}`);

      if (scores.performance < PERF_THRESHOLD || scores.accessibility < A11Y_THRESHOLD) {
        failed = true;
      }
    }
  } finally {
    server.kill('SIGTERM');
  }

  if (failed) {
    throw new Error('Lighthouse score gate failed.');
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
