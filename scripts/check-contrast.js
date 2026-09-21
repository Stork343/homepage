#!/usr/bin/env node
/*
 * WCAG AA 对比度门禁 —— 色值一律从真实 CSS 解析，不再硬编码。
 *
 * 为什么重写（体检 D-5）：
 *   旧版把 14 组色值写死在本文件里，全文件零 IO。改 CSS 调色板不会触发任何
 *   报警，门禁因此永远绿灯；而真实的 .publication-author-link 在浅色 normal /
 *   浅色 focus / 暗色 focus 三个状态下都只有 3.1~3.9:1，低于 AA 的 4.5。
 *   旧版还完全没覆盖这三个状态——因为 :focus-visible 不重新声明 color，
 *   朴素的「按选择器配对」扫描根本配不出这一对。
 *
 * 现在的规则：
 *   1. 每个待检色对只声明「色值来自哪个 CSS 文件、哪个变量或哪个选择器+属性」，
 *      具体色值在运行时解析；
 *   2. 级联近似与浏览器一致：同一属性文档顺序后者胜，:root 变量按主题合并；
 *   3. 半透明色必须显式声明 over（它叠在哪个底色上），否则拒绝计算；
 *   4. 解析不到就判红 —— 宁可误报，也不静默放行。
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILES = {
  home: path.join(ROOT, "enhanced-main.css"),
  reader: path.join(ROOT, "papers", "shared", "paper-theme.css"),
  notes: path.join(ROOT, "notes", "style.css")
};

class ResolveError extends Error {}

function fail(message) {
  throw new ResolveError(message);
}

// ---------------------------------------------------------------- 颜色数学

function channelToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToRgb(hex) {
  const value = String(hex).replace(/^#/, "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(foreground, background) {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------------------------------------------------------------- CSS 解析

function normalizeSelector(selector) {
  return String(selector).replace(/\s+/g, " ").trim();
}

function splitSelectors(selectorText) {
  return String(selectorText)
    .split(",")
    .map(normalizeSelector)
    .filter(Boolean);
}

function readDeclarations(body) {
  return String(body)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator < 0) {
        return null;
      }
      const name = part.slice(0, separator).trim().toLowerCase();
      let value = part.slice(separator + 1).trim();
      if (/!important$/i.test(value)) {
        value = value.replace(/!important$/i, "").trim();
      }
      return name ? { name, value } : null;
    })
    .filter(Boolean);
}

/* 极简 CSS 规则解析：按大括号配对切出「选择器 + 声明体」，@ 规则递归下探。
   注意：顶层的 @import / @charset 这类「以分号结束、没有块」的语句必须在此清空缓冲，
   否则它会与紧随其后的选择器拼在一起（"@import url(...); :root"），被误判为 at-rule
   而整块跳过 —— 那会让该文件浅色 :root 里的全部变量凭空消失。 */
function parseRules(css) {
  const clean = String(css).replace(/\/\*[\s\S]*?\*\//g, " ");
  const rules = [];
  const stack = [];
  let buffer = "";
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === "{") {
      const selector = buffer.trim();
      buffer = "";
      if (selector.startsWith("@")) {
        stack.push({ atRule: true });
      } else {
        stack.push({ atRule: false, selector, bodyStart: i + 1 });
      }
    } else if (char === "}") {
      const frame = stack.pop();
      buffer = "";
      if (frame && !frame.atRule) {
        rules.push({
          selectors: splitSelectors(frame.selector),
          body: clean.slice(frame.bodyStart, i)
        });
      }
    } else if (char === ";" && stack.length === 0) {
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return rules;
}

function collectVariables(rules, theme) {
  const wanted = theme === "dark" ? [":root", ':root[data-theme="dark"]'] : [":root"];
  const vars = {};
  rules.forEach((rule) => {
    if (!rule.selectors.some((selector) => wanted.includes(selector))) {
      return;
    }
    readDeclarations(rule.body).forEach(({ name, value }) => {
      if (name.startsWith("--")) {
        vars[name] = value;
      }
    });
  });
  return vars;
}

/* 属性名可传数组表示优先级（例如 ["background-color", "background"]）。
   选择器按 CSS 语义做交集匹配：规则 ".a, .b { color: x }" 对 .a 和 .b 都生效，
   因此待检选择器只要有一个逗号分项命中规则的选择器列表即算匹配。 */
function findDeclaration(rules, selector, property) {
  const targets = splitSelectors(selector);
  const names = (Array.isArray(property) ? property : [property]).map((name) => String(name).toLowerCase());
  for (const name of names) {
    let found = null;
    rules.forEach((rule) => {
      if (!targets.some((target) => rule.selectors.includes(target))) {
        return;
      }
      readDeclarations(rule.body).forEach((declaration) => {
        if (declaration.name === name) {
          found = declaration.value; // 文档顺序后者胜
        }
      });
    });
    if (found !== null) {
      return found;
    }
  }
  return null;
}

const rulesCache = new Map();
const contextCache = new Map();

function loadContext(fileKey, theme) {
  const cacheKey = `${fileKey}:${theme}`;
  if (contextCache.has(cacheKey)) {
    return contextCache.get(cacheKey);
  }
  const filePath = FILES[fileKey];
  if (!filePath) {
    fail(`未知的 CSS 文件键：${fileKey}`);
  }
  if (!fs.existsSync(filePath)) {
    fail(`CSS 文件不存在：${filePath}`);
  }
  if (!rulesCache.has(fileKey)) {
    rulesCache.set(fileKey, parseRules(fs.readFileSync(filePath, "utf8")));
  }
  const rules = rulesCache.get(fileKey);
  const context = { fileKey, theme, rules, vars: collectVariables(rules, theme) };
  contextCache.set(cacheKey, context);
  return context;
}

function normalizeHex(value) {
  const raw = String(value).trim().toLowerCase();
  const shorthand = raw.match(/^#([0-9a-f]{3})$/);
  if (shorthand) {
    return `#${shorthand[1].split("").map((char) => char + char).join("")}`;
  }
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

function parseColorValue(raw, spec, context, depth = 0) {
  if (depth > 5) {
    fail(`色值解析递归过深：${raw}`);
  }
  const direct = normalizeHex(raw);
  if (direct) {
    return direct;
  }

  const varMatch = raw.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/i);
  if (varMatch) {
    const name = varMatch[1];
    if (context.vars[name] !== undefined) {
      return parseColorValue(String(context.vars[name]).trim(), spec, context, depth + 1);
    }
    if (varMatch[2] !== undefined) {
      return parseColorValue(String(varMatch[2]).trim(), spec, context, depth + 1);
    }
    fail(`CSS 变量 ${name} 在 ${context.fileKey}（${context.theme}）中未定义，且没有回退值`);
  }

  const rgbMatch = raw.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*(%)?\s*)?\)$/i);
  if (rgbMatch) {
    const channels = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((value) =>
      Math.max(0, Math.min(255, Math.round(Number(value))))
    );
    let alpha = 1;
    if (rgbMatch[4] !== undefined) {
      alpha = Number(rgbMatch[4]);
      if (rgbMatch[5] === "%" || alpha > 1) {
        alpha /= 100; // 百分比写法
      }
    }
    if (alpha >= 1) {
      return rgbToHex(channels);
    }
    if (!spec.over) {
      fail(
        `"${raw}" 是半透明色，必须用 over 声明它叠在哪个底色上` +
          `（选择器 "${spec.selector || spec.variable || "-"}"）—— 拒绝凭空假设白底`
      );
    }
    const base = resolveColor(spec.over, context.theme);
    const baseChannels = hexToRgb(base);
    return rgbToHex(channels.map((channel, index) => channel * alpha + baseChannels[index] * (1 - alpha)));
  }

  fail(
    `无法解析的色值 "${raw}"（来自 ${context.fileKey} 的 ` +
      `"${spec.selector || spec.variable || spec.hex || "-"}"）—— 门禁拒绝猜测，请显式声明`
  );
}

/* spec 自带 file，因此 over 可以指向另一个 CSS 文件；theme 由所属色对传入。 */
function resolveColor(spec, theme) {
  if (!spec || typeof spec !== "object") {
    fail(`色值声明必须是对象，收到：${JSON.stringify(spec)}`);
  }
  const context = loadContext(spec.file || "home", theme);
  if (spec.hex) {
    const hex = normalizeHex(spec.hex);
    if (!hex) {
      fail(`非法字面色值：${spec.hex}`);
    }
    return hex;
  }
  if (spec.variable) {
    const value = context.vars[spec.variable];
    if (value === undefined) {
      fail(`CSS 变量 ${spec.variable} 在 ${context.fileKey}（${context.theme}）中未定义`);
    }
    return parseColorValue(String(value).trim(), spec, context);
  }
  if (spec.selector) {
    const property = spec.property || "color";
    const value = findDeclaration(context.rules, spec.selector, property);
    if (value === null) {
      fail(
        `在 ${context.fileKey} 中解析不到 "${spec.selector}" 的 ` +
          `${Array.isArray(property) ? property.join("/") : property}`
      );
    }
    return parseColorValue(String(value).trim(), spec, context);
  }
  fail("色值声明必须提供 hex / variable / selector 之一");
}

// ---------------------------------------------------------------- 待检色对

const DARK = ':root[data-theme="dark"]';
const AUTHOR_LINK = ".publication-author-link,.publication-author-link:visited";
const AUTHOR_LINK_DARK = `${DARK} .publication-author-link,${DARK} .publication-author-link:visited`;
const CARD_BG = { file: "home", selector: ".publication-card", property: ["background-color", "background"] };
const CARD_BG_DARK = {
  file: "home",
  selector: `${DARK} .publication-card`,
  property: ["background-color", "background"]
};
const NOTES_PAGE = ".book .book-body .page-wrapper";
const NOTES_SIDEBAR = ".book .book-summary";
const NOTES_SECTION = `${NOTES_PAGE} .page-inner section.normal`;

function authorLink(state, { dark = false } = {}) {
  const selector = dark ? `${DARK} .publication-author-link${state}` : `.publication-author-link${state}`;
  return {
    fg: { file: "home", selector: state ? selector : dark ? AUTHOR_LINK_DARK : AUTHOR_LINK, property: "color" },
    bg: {
      file: "home",
      selector: state ? selector : dark ? AUTHOR_LINK_DARK : AUTHOR_LINK,
      property: ["background-color", "background"],
      over: dark ? CARD_BG_DARK : CARD_BG
    }
  };
}

const CHECKS = [
  // ---- 首页 / 浅色 ----
  {
    scope: "home.light",
    theme: "light",
    min: 4.5,
    label: "Primary text on homepage background",
    fg: { file: "home", variable: "--tf-ink" },
    bg: { file: "home", variable: "--tf-bg" }
  },
  {
    scope: "home.light",
    theme: "light",
    min: 4.5,
    label: "Link color on white card",
    fg: { file: "home", variable: "--tf-link" },
    bg: { file: "home", variable: "--tf-paper" }
  },
  {
    scope: "ui",
    theme: "light",
    min: 4.5,
    label: "Primary button text on blue background",
    fg: { file: "home", hex: "#ffffff" },
    bg: { file: "home", variable: "--tf-btn" }
  },
  {
    scope: "home.light",
    theme: "light",
    min: 4.5,
    label: "Publication author link (normal) on its tinted pill",
    ...authorLink("")
  },
  {
    scope: "home.light",
    theme: "light",
    min: 4.5,
    label: "Publication author link (hover) on its tinted pill",
    ...authorLink(":hover")
  },
  {
    scope: "home.light",
    theme: "light",
    min: 4.5,
    label: "Publication author link (focus-visible) on its tinted pill",
    ...authorLink(":focus-visible")
  },

  // ---- 首页 / 暗色 ----
  {
    scope: "home.dark",
    theme: "dark",
    min: 4.5,
    label: "Primary text in dark mode card",
    fg: { file: "home", variable: "--tf-ink" },
    bg: { file: "home", variable: "--tf-paper" }
  },
  {
    scope: "home.dark",
    theme: "dark",
    min: 4.5,
    label: "Link color in dark mode card",
    fg: { file: "home", variable: "--tf-link" },
    bg: { file: "home", variable: "--tf-paper" }
  },
  {
    scope: "home.dark",
    theme: "dark",
    min: 4.5,
    label: "Publication author link (normal, dark) on its tinted pill",
    ...authorLink("", { dark: true })
  },
  {
    scope: "home.dark",
    theme: "dark",
    min: 4.5,
    label: "Publication author link (hover, dark) on its tinted pill",
    ...authorLink(":hover", { dark: true })
  },
  {
    scope: "home.dark",
    theme: "dark",
    min: 4.5,
    label: "Publication author link (focus-visible, dark) on its tinted pill",
    ...authorLink(":focus-visible", { dark: true })
  },

  // ---- 论文阅读页 ----
  {
    scope: "reader.light",
    theme: "light",
    min: 4.5,
    label: "Reader text on page background",
    fg: { file: "reader", variable: "--tf-ink" },
    bg: { file: "reader", variable: "--tf-paper" }
  },
  {
    scope: "reader.light",
    theme: "light",
    min: 4.5,
    label: "Reader TOC link on panel background",
    fg: { file: "reader", variable: "--tf-link" },
    bg: { file: "reader", variable: "--tf-paper" }
  },
  {
    scope: "reader.dark",
    theme: "dark",
    min: 4.5,
    label: "Reader text in dark side panel",
    fg: { file: "reader", variable: "--tf-ink" },
    bg: { file: "reader", variable: "--tf-paper" }
  },
  {
    scope: "reader.dark",
    theme: "dark",
    min: 4.5,
    label: "Reader TOC link in dark side panel",
    fg: { file: "reader", variable: "--tf-link" },
    bg: { file: "reader", variable: "--tf-paper" }
  },

  // ---- Bookdown 阅读页 ----
  {
    scope: "notes.sidebar",
    theme: "light",
    min: 4.5,
    label: "Bookdown sidebar text on Taylor & Francis blue",
    fg: { file: "notes", selector: NOTES_SIDEBAR, property: "color" },
    bg: { file: "notes", selector: NOTES_SIDEBAR, property: ["background-color", "background"] }
  },
  {
    scope: "notes.sidebar",
    theme: "light",
    min: 4.5,
    label: "Bookdown sidebar TOC links on Taylor & Francis blue",
    fg: { file: "notes", selector: ".book .book-summary ul.summary li a", property: "color" },
    bg: { file: "notes", selector: NOTES_SIDEBAR, property: ["background-color", "background"] }
  },
  {
    scope: "notes.sidebar",
    theme: "light",
    min: 4.5,
    label: "Bookdown sidebar active entry on its translucent highlight",
    fg: { file: "notes", selector: ".book .book-summary ul.summary li.active > a", property: "color" },
    bg: {
      file: "notes",
      selector: ".book .book-summary ul.summary li.active > a",
      property: ["background-color", "background"],
      over: { file: "notes", selector: NOTES_SIDEBAR, property: ["background-color", "background"] }
    }
  },
  {
    scope: "notes.sidebar",
    theme: "light",
    min: 4.5,
    label: "Bookdown sidebar hovered entry on its translucent highlight",
    fg: { file: "notes", selector: ".book .book-summary ul.summary li a:hover", property: "color" },
    bg: {
      file: "notes",
      selector: ".book .book-summary ul.summary li a:hover",
      property: ["background-color", "background"],
      over: { file: "notes", selector: NOTES_SIDEBAR, property: ["background-color", "background"] }
    }
  },
  {
    scope: "notes.body",
    theme: "light",
    min: 4.5,
    label: "Bookdown body text on page background",
    fg: { file: "notes", selector: NOTES_PAGE, property: "color" },
    bg: { file: "notes", selector: NOTES_PAGE, property: ["background-color", "background"] }
  },
  {
    scope: "notes.body",
    theme: "light",
    min: 4.5,
    label: "Bookdown headings on white background",
    fg: { file: "notes", selector: `${NOTES_SECTION} h1`, property: "color" },
    bg: { file: "notes", selector: NOTES_PAGE, property: ["background-color", "background"] }
  },
  {
    scope: "notes.body",
    theme: "light",
    min: 4.5,
    label: "Bookdown body links on white background",
    fg: { file: "notes", selector: `${NOTES_SECTION} a`, property: "color" },
    bg: { file: "notes", selector: NOTES_PAGE, property: ["background-color", "background"] }
  },
  {
    scope: "notes.body",
    theme: "light",
    min: 4.5,
    label: "Bookdown hovered body links on white background",
    fg: { file: "notes", selector: `${NOTES_SECTION} a:hover`, property: "color" },
    bg: { file: "notes", selector: NOTES_PAGE, property: ["background-color", "background"] }
  },
  {
    scope: "notes.body",
    theme: "light",
    min: 4.5,
    label: "Bookdown code text on code block background",
    fg: { file: "notes", selector: NOTES_PAGE, property: "color" },
    bg: { file: "notes", selector: `${NOTES_SECTION} pre`, property: ["background-color", "background"] }
  }
];

// ---------------------------------------------------------------- 执行

console.log("=== WCAG Contrast Checks (resolved from real CSS) ===");

let failures = 0;
let resolved = 0;

CHECKS.forEach((check) => {
  const prefix = `[${check.scope}] ${check.label}`;
  try {
    const fg = resolveColor(check.fg, check.theme);
    const bg = resolveColor(check.bg, check.theme);
    const ratio = contrastRatio(fg, bg);
    resolved += 1;
    if (ratio >= check.min) {
      console.log(`[PASS] ${prefix}: ${fg} on ${bg} -> ${ratio.toFixed(2)} (min ${check.min})`);
    } else {
      failures += 1;
      console.log(`[FAIL] ${prefix}: ${fg} on ${bg} -> ${ratio.toFixed(2)} (min ${check.min})`);
    }
  } catch (error) {
    // 解析失败等于门禁失效：一律判红，绝不静默跳过。
    failures += 1;
    const reason = error instanceof ResolveError ? error.message : error.message;
    console.log(`[FAIL] ${prefix}: 无法解析色值 —— ${reason}`);
  }
});

console.log(`\n解析成功 ${resolved}/${CHECKS.length} 组，失败 ${failures} 组。`);

if (failures > 0 || resolved !== CHECKS.length) {
  process.exitCode = 1;
  console.error("ERROR: 对比度门禁未通过（存在不达标的色对，或有色值解析不到）。");
} else {
  console.log("OK: 所有从 CSS 解析出的色对均满足 WCAG AA。");
}
