#!/usr/bin/env node

function hexToRgb(hex) {
  const value = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function channelToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

function contrastRatio(foreground, background) {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const checks = [
  {
    scope: "home.light",
    fg: "#1b2430",
    bg: "#f4f6f9",
    min: 4.5,
    label: "Primary text on homepage background"
  },
  {
    scope: "home.light",
    fg: "#204c8b",
    bg: "#ffffff",
    min: 4.5,
    label: "Link color on white card"
  },
  {
    scope: "home.dark",
    fg: "#eef4ff",
    bg: "#131e2f",
    min: 4.5,
    label: "Primary text in dark mode card"
  },
  {
    scope: "home.dark",
    fg: "#84b1f2",
    bg: "#131e2f",
    min: 4.5,
    label: "Link color in dark mode card"
  },
  {
    scope: "reader.light",
    fg: "#1b2430",
    bg: "#ffffff",
    min: 4.5,
    label: "Reader text on page background"
  },
  {
    scope: "reader.light",
    fg: "#204c8b",
    bg: "#ffffff",
    min: 4.5,
    label: "Reader TOC link on panel background"
  },
  {
    scope: "reader.dark",
    fg: "#eef4ff",
    bg: "#132033",
    min: 4.5,
    label: "Reader text in dark side panel"
  },
  {
    scope: "reader.dark",
    fg: "#90bdff",
    bg: "#132033",
    min: 4.5,
    label: "Reader TOC link in dark side panel"
  },
  {
    scope: "ui",
    fg: "#ffffff",
    bg: "#204c8b",
    min: 4.5,
    label: "Primary button text on blue background"
  }
];

let failed = false;
console.log("=== WCAG Contrast Checks ===");
checks.forEach((item) => {
  const ratio = contrastRatio(item.fg, item.bg);
  const ok = ratio >= item.min;
  const ratioText = ratio.toFixed(2);
  const status = ok ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${item.scope} ${item.label}: ${item.fg} on ${item.bg} -> ${ratioText} (min ${item.min})`
  );
  if (!ok) {
    failed = true;
  }
});

if (failed) {
  process.exitCode = 1;
  console.error("ERROR: One or more contrast pairs do not satisfy WCAG AA.");
} else {
  console.log("OK: All configured color pairs satisfy WCAG AA.");
}
