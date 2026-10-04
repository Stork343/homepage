// 测试与第三方端点解耦的共享夹具（封闭网络策略）。
//
// 背景（2026-09-28 实测）：busuanzi 的 JSONP 回调脚本在 defer 阶段插入文档，
// 会推迟 window load；其数据端点间歇性挂起（8 次首屏加载 6 次 load >15s），
// 而 page.goto / page.reload 默认等待 load，导致本地回归结构性超时、CI 偶发红。
// 产品侧已把计数器改为 window load 之后注入（见 index.html 内联脚本）。
//
// 2026-10-03 起字体（fonts/）与 PDF.js（papers/shared/vendor/）均已自托管，
// 站点运行时不再依赖任何第三方子资源（仅剩 plausible 统计与 busuanzi 计数器，
// 二者均不参与断言）。因此这里改为**拦截一切非本机请求**：
//   · UI 测试彻底封闭，不受任何外网端点可用性影响；
//   · 若未来有代码重新引入 CDN 依赖，测试会立刻以 requestfailed 的形式暴露，
//     而不是静默通过后在生产环境听天由命。
// 页面里指向外部的普通 <a href> 不受影响（route 只拦子资源请求）。
const { test: base, expect } = require('@playwright/test');

const LOCAL_ORIGIN = /^https?:\/\/127\.0\.0\.1:/;

const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(
      (url) => !LOCAL_ORIGIN.test(url),
      (route) => route.abort()
    );
    await use(context);
  }
});

module.exports = { test, expect };
